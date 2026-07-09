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

export async function checkDailyLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  ensureScratchDir();

  // If the file doesn't exist yet, there are no logs, so limit check passes
  if (!fs.existsSync(LOGS_FILE)) {
    return { allowed: true };
  }

  try {
    const data = fs.readFileSync(LOGS_FILE, "utf8");
    const lines = data.split("\n").filter(Boolean);

    const todayDateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    let dailyGenerationsCount = 0;
    let dailyCostUsd = 0;

    for (const line of lines) {
      try {
        const record: AiUsageLog = JSON.parse(line);
        if (record.userId === userId && record.success) {
          const recordDateStr = record.createdAt.split("T")[0];
          if (recordDateStr === todayDateStr) {
            // Count generative content features: summary, quiz, cards, eli5
            if (["summary", "quiz", "cards", "eli5", "analogy", "explain"].includes(record.feature)) {
              dailyGenerationsCount++;
            }
            dailyCostUsd += record.estimatedCostUsd;
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    const DAILY_GENERATION_LIMIT = 5;
    const DAILY_COST_LIMIT_USD = 1.00;

    if (dailyGenerationsCount >= DAILY_GENERATION_LIMIT) {
      return {
        allowed: false,
        reason: `You have reached your daily allowance of ${DAILY_GENERATION_LIMIT} generated study materials. Limits reset tomorrow!`,
      };
    }

    if (dailyCostUsd >= DAILY_COST_LIMIT_USD) {
      return {
        allowed: false,
        reason: "You have exceeded your daily API usage quota for the beta. Limits reset tomorrow!",
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("Failed to read usage logs for limit checking", err);
    // Allow by default if file system read fails to avoid blocking legitimate users
    return { allowed: true };
  }
}
