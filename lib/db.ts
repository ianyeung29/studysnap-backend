import fs from "fs";
import path from "path";

const SCRATCH_DIR = path.join(process.cwd(), "scratch");
const EVENTS_FILE = path.join(SCRATCH_DIR, "product_events.jsonl");
const LOGS_FILE = path.join(SCRATCH_DIR, "ai_usage_logs.jsonl");

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

export async function saveProductEvent(event: Omit<ProductEvent, "createdAt">): Promise<void> {
  ensureScratchDir();
  const fullEvent: ProductEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  const line = JSON.stringify(fullEvent) + "\n";
  fs.appendFileSync(EVENTS_FILE, line, "utf8");

  // Telemetry to stdout
  console.log(`[PRODUCT_ANALYTICS] ${JSON.stringify(fullEvent)}`);
}

export async function saveAiUsageLog(log: Omit<AiUsageLog, "createdAt">): Promise<void> {
  ensureScratchDir();
  const fullLog: AiUsageLog = {
    ...log,
    createdAt: new Date().toISOString(),
  };

  const line = JSON.stringify(fullLog) + "\n";
  fs.appendFileSync(LOGS_FILE, line, "utf8");

  // Telemetry to stdout
  console.log(`[AI_USAGE_LOG] ${JSON.stringify(fullLog)}`);
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

  // If the file doesn't exist yet, there are no logs, so limit check passes
  if (!fs.existsSync(LOGS_FILE)) {
    return { allowed: true };
  }

  try {
    const data = fs.readFileSync(LOGS_FILE, "utf8");
    const lines = data.split("\n").filter(Boolean);

    const now = new Date();
    const todayDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const currentMonthStr = todayDateStr.substring(0, 7); // YYYY-MM

    let dailyGenerationsCount = 0;
    let dailyCostUsd = 0;
    let monthlyCostUsd = 0;

    for (const line of lines) {
      try {
        const record: AiUsageLog = JSON.parse(line);
        if (record.userId === userId && record.success) {
          const recordDateStr = record.createdAt.split("T")[0];
          
          // Daily Accumulator
          if (recordDateStr === todayDateStr) {
            if (["summary", "quiz", "cards", "eli5", "analogy", "explain", "study-guide", "flashcards", "exam-prep", "transcribe", "ocr"].includes(record.feature)) {
              dailyGenerationsCount++;
            }
            dailyCostUsd += record.estimatedCostUsd;
          }

          // Monthly Accumulator
          if (recordDateStr.startsWith(currentMonthStr)) {
            monthlyCostUsd += record.estimatedCostUsd;
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    // Set tier rules based on environment limits with defaults
    const generationLimit = isPremium
      ? parseInt(process.env.MAX_DAILY_GENERATIONS_PREMIUM || "100", 10)
      : parseInt(process.env.MAX_DAILY_GENERATIONS_FREE || "25", 10);

    const dailyCostLimitUsd = isPremium
      ? parseFloat(process.env.MAX_DAILY_COST_PREMIUM || "0.75")
      : parseFloat(process.env.MAX_DAILY_COST_FREE || "0.25");

    const monthlyCostLimitUsd = isPremium
      ? parseFloat(process.env.MAX_MONTHLY_COST_PREMIUM || "4.00")
      : parseFloat(process.env.MAX_MONTHLY_COST_FREE || "0.50");

    // 2. Monthly Cap check
    if (monthlyCostUsd >= monthlyCostLimitUsd) {
      return {
        allowed: false,
        reason: "Daily limit reached. You have exceeded your monthly study allowance for the beta. Limits reset next month!",
      };
    }

    // 3. Daily Count check
    if (dailyGenerationsCount >= generationLimit) {
      return {
        allowed: false,
        reason: `Daily limit reached. You have used your daily allowance of ${generationLimit} study packs. Limits reset tomorrow!`,
      };
    }

    // 4. Daily Cost check
    if (dailyCostUsd >= dailyCostLimitUsd) {
      return {
        allowed: false,
        reason: "Daily limit reached. You have exceeded your daily study allowance for the beta. Limits reset tomorrow!",
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("Failed to read usage logs for limit checking", err);
    // Allow by default if file system read fails to avoid blocking legitimate users
    return { allowed: true };
  }
}
