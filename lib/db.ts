import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { evaluateAbuseSignals } from "./abuse";

const SCRATCH_DIR = path.join(process.cwd(), "scratch");
const EVENTS_FILE = path.join(SCRATCH_DIR, "product_events.jsonl");
const LOGS_FILE = path.join(SCRATCH_DIR, "ai_usage_logs.jsonl");

// Connect to Neon PostgreSQL if DATABASE_URL env variable exists
const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

if (sql) {
  console.log("🔋 Connected to Neon PostgreSQL database telemetry layer.");
} else {
  console.log("📂 DATABASE_URL not set. Running database telemetry layer on local JSONL fallback.");
}

// Ensure directories exist
function ensureScratchDir() {
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }
}

export interface ProductEvent {
  userId: string;
  eventName: string;
  metadata?: any;
  platform?: string;
  appVersion?: string;
  createdAt: string;
}

export interface AiUsageLog {
  userId: string;
  sessionId?: string;
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  createdAt: string;
}

// Helper to append JSONL to local disk
function writeToJsonlFile(filePath: string, record: any) {
  ensureScratchDir();
  const line = JSON.stringify(record) + "\n";
  fs.appendFileSync(filePath, line, "utf8");
}

export async function saveProductEvent(event: Omit<ProductEvent, "createdAt">): Promise<void> {
  const fullEvent: ProductEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  // Log stdout
  console.log(`[PRODUCT_ANALYTICS] ${JSON.stringify(fullEvent)}`);

  // Write to Neon PostgreSQL if active, fallback to JSONL
  if (sql) {
    try {
      await sql`
        INSERT INTO product_events (user_id, event_name, metadata_json, platform, app_version)
        VALUES (${fullEvent.userId}, ${fullEvent.eventName}, ${JSON.stringify(fullEvent.metadata || {})}, ${fullEvent.platform || null}, ${fullEvent.appVersion || null})
      `;
      // Trigger background abuse scanner asynchronously
      evaluateAbuseSignals(fullEvent.userId).catch((err) => {
        console.error("Abuse scanner background execution failed:", err);
      });
      return;
    } catch (dbErr) {
      console.error("Neon PostgreSQL write failed for product event, falling back to JSONL:", dbErr);
    }
  }

  writeToJsonlFile(EVENTS_FILE, fullEvent);

  // Trigger background abuse scanner asynchronously
  evaluateAbuseSignals(fullEvent.userId).catch((err) => {
    console.error("Abuse scanner background execution failed:", err);
  });
}

export async function saveAiUsageLog(log: Omit<AiUsageLog, "createdAt">): Promise<void> {
  const fullLog: AiUsageLog = {
    ...log,
    createdAt: new Date().toISOString(),
  };

  // Log stdout
  console.log(`[AI_USAGE_LOG] ${JSON.stringify(fullLog)}`);

  // Write to Neon PostgreSQL if active, fallback to JSONL
  if (sql) {
    try {
      await sql`
        INSERT INTO ai_usage_logs (user_id, session_id, feature, provider, model, input_tokens, cached_input_tokens, output_tokens, estimated_cost_usd, latency_ms, success, error_code)
        VALUES (
          ${fullLog.userId}, ${fullLog.sessionId || null}, ${fullLog.feature}, ${fullLog.provider}, ${fullLog.model},
          ${fullLog.inputTokens}, ${fullLog.cachedInputTokens || 0}, ${fullLog.outputTokens},
          ${fullLog.estimatedCostUsd}, ${fullLog.latencyMs}, ${fullLog.success}, ${fullLog.errorCode || null}
        )
      `;
      // Trigger background abuse scanner asynchronously
      evaluateAbuseSignals(fullLog.userId).catch((err) => {
        console.error("Abuse scanner background execution failed:", err);
      });
      return;
    } catch (dbErr) {
      console.error("Neon PostgreSQL write failed for AI usage log, falling back to JSONL:", dbErr);
    }
  }

  writeToJsonlFile(LOGS_FILE, fullLog);

  // Trigger background abuse scanner asynchronously
  evaluateAbuseSignals(fullLog.userId).catch((err) => {
    console.error("Abuse scanner background execution failed:", err);
  });
}

// ── Concurrency Lock Manager ──
// Locks are structured as userId:action
const activeLocks = new Set<string>();

export function acquireLock(userId: string, action: string): boolean {
  const lockKey = `${userId}:${action}`;
  if (activeLocks.has(lockKey)) {
    return false;
  }
  activeLocks.add(lockKey);
  return true;
}

export function releaseLock(userId: string, action: string): void {
  const lockKey = `${userId}:${action}`;
  activeLocks.delete(lockKey);
}

// ── Limit Enforcements ──
export async function checkDailyLimit(
  userId: string,
  isPremium: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  ensureScratchDir();

  // 1. Global Kill Switch check
  const isEnabled = process.env.AI_GENERATION_ENABLED !== "false";
  if (!isEnabled) {
    return {
      allowed: false,
      reason: "StudySnap services are temporarily down for maintenance. Please check back later.",
    };
  }

  // Retrieve limits with defaults
  const generationLimit = isPremium
    ? parseInt(process.env.MAX_DAILY_GENERATIONS_PREMIUM || "100", 10)
    : parseInt(process.env.MAX_DAILY_GENERATIONS_FREE || "25", 10);

  const dailyCostLimitUsd = isPremium
    ? parseFloat(process.env.MAX_DAILY_COST_PREMIUM || "0.75")
    : parseFloat(process.env.MAX_DAILY_COST_FREE || "0.25");

  const monthlyCostLimitUsd = isPremium
    ? parseFloat(process.env.MAX_MONTHLY_COST_PREMIUM || "4.00")
    : parseFloat(process.env.MAX_MONTHLY_COST_FREE || "0.50");

  // Route querying dynamically (Neon PG -> Fallback to JSONL)
  if (sql) {
    try {
      const [dailyResult, monthlyResult] = await Promise.all([
        sql`
          SELECT COUNT(*)::integer as count, SUM(estimated_cost_usd)::numeric as cost
          FROM ai_usage_logs
          WHERE user_id = ${userId}
            AND success = true
            AND created_at::date = CURRENT_DATE
        `,
        sql`
          SELECT SUM(estimated_cost_usd)::numeric as cost
          FROM ai_usage_logs
          WHERE user_id = ${userId}
            AND success = true
            AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        `
      ]);

      const dailyCount = dailyResult[0]?.count || 0;
      const dailyCost = parseFloat(dailyResult[0]?.cost || "0");
      const monthlyCost = parseFloat(monthlyResult[0]?.cost || "0");

      return evaluateLimits(dailyCount, dailyCost, monthlyCost, generationLimit, dailyCostLimitUsd, monthlyCostLimitUsd);
    } catch (dbErr) {
      console.error("Neon PostgreSQL limits check failed, falling back to JSONL check:", dbErr);
    }
  }

  // JSONL fallback limits check
  return checkLimitFromJsonl(userId, generationLimit, dailyCostLimitUsd, monthlyCostLimitUsd);
}

// Check limits against computed aggregates
function evaluateLimits(
  dailyCount: number,
  dailyCost: number,
  monthlyCost: number,
  generationLimit: number,
  dailyCostLimitUsd: number,
  monthlyCostLimitUsd: number
): { allowed: boolean; reason?: string } {
  // 1. Monthly Cap Check
  if (monthlyCost >= monthlyCostLimitUsd) {
    return {
      allowed: false,
      reason: "Daily limit reached. You have exceeded your monthly study allowance for the beta. Limits reset next month!",
    };
  }

  // 2. Daily Count Check
  if (dailyCount >= generationLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached. You have used your daily allowance of ${generationLimit} study packs. Limits reset tomorrow!`,
    };
  }

  // 3. Daily Cost Check
  if (dailyCost >= dailyCostLimitUsd) {
    return {
      allowed: false,
      reason: "Daily limit reached. You have exceeded your daily study allowance for the beta. Limits reset tomorrow!",
    };
  }

  return { allowed: true };
}

// Local JSONL limits calculation fallback
function checkLimitFromJsonl(
  userId: string,
  generationLimit: number,
  dailyCostLimitUsd: number,
  monthlyCostLimitUsd: number
): { allowed: boolean; reason?: string } {
  if (!fs.existsSync(LOGS_FILE)) {
    return { allowed: true };
  }

  try {
    const data = fs.readFileSync(LOGS_FILE, "utf8");
    const lines = data.split("\n").filter(Boolean);

    const todayDateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const currentMonthStr = todayDateStr.substring(0, 7); // YYYY-MM

    let dailyCount = 0;
    let dailyCost = 0;
    let monthlyCost = 0;

    for (const line of lines) {
      try {
        const record: AiUsageLog = JSON.parse(line);
        if (record.userId === userId && record.success) {
          const recordDateStr = record.createdAt.split("T")[0];

          // Daily stats
          if (recordDateStr === todayDateStr) {
            if (["summary", "quiz", "cards", "eli5", "analogy", "explain", "study-guide", "flashcards", "exam-prep", "transcribe", "ocr"].includes(record.feature)) {
              dailyCount++;
            }
            dailyCost += record.estimatedCostUsd;
          }

          // Monthly stats
          if (recordDateStr.startsWith(currentMonthStr)) {
            monthlyCost += record.estimatedCostUsd;
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    return evaluateLimits(dailyCount, dailyCost, monthlyCost, generationLimit, dailyCostLimitUsd, monthlyCostLimitUsd);
  } catch (err) {
    console.error("Local JSONL limits calculation crashed:", err);
    return { allowed: true }; // Allow fallback if disk read crashes
  }
}
