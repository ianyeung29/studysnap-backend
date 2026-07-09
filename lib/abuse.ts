import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { sendAdminAlert, AlertSeverity } from "./alerts";

const LOGS_FILE = path.join(process.cwd(), "scratch", "ai_usage_logs.jsonl");
const EVENTS_FILE = path.join(process.cwd(), "scratch", "product_events.jsonl");

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

export async function evaluateAbuseSignals(userId: string): Promise<void> {
  try {
    if (sql) {
      await evaluateAbusePg(userId);
    } else {
      await evaluateAbuseJsonl(userId);
    }
  } catch (err) {
    console.error(`Failed to complete abuse scan for user ${userId}:`, err);
  }
}

// ── Neon PostgreSQL Abuse Scan ──
async function evaluateAbusePg(userId: string): Promise<void> {
  if (!sql) return;

  const [
    cost7DaysResult,
    costMonthResult,
    failures1HourResult,
    blocks7DaysResult,
    blocks1HourResult,
    tutorCalls2HoursResult
  ] = await Promise.all([
    // 1. Cost last 7 days
    sql`
      SELECT COALESCE(SUM(estimated_cost_usd), 0)::numeric as cost
      FROM ai_usage_logs
      WHERE user_id = ${userId} AND success = true AND created_at >= NOW() - INTERVAL '7 days'
    `,
    // 2. Cost current month
    sql`
      SELECT COALESCE(SUM(estimated_cost_usd), 0)::numeric as cost
      FROM ai_usage_logs
      WHERE user_id = ${userId} AND success = true AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    `,
    // 3. Failures in last hour
    sql`
      SELECT COUNT(*)::integer as count
      FROM ai_usage_logs
      WHERE user_id = ${userId} AND success = false AND created_at >= NOW() - INTERVAL '1 hour'
    `,
    // 4. Daily cap blocks in last 7 days
    sql`
      SELECT COUNT(DISTINCT created_at::date)::integer as days
      FROM product_events
      WHERE user_id = ${userId} AND event_name = 'limit_blocked' AND created_at >= NOW() - INTERVAL '7 days'
    `,
    // 5. Concurrency lock / limit blocks in last hour
    sql`
      SELECT COUNT(*)::integer as count
      FROM product_events
      WHERE user_id = ${userId} AND event_name = 'limit_blocked' AND created_at >= NOW() - INTERVAL '1 hour'
    `,
    // 6. Tutor calls in last 2 hours
    sql`
      SELECT COUNT(*)::integer as count
      FROM ai_usage_logs
      WHERE user_id = ${userId} AND success = true AND feature IN ('eli5', 'analogy', 'explain') AND created_at >= NOW() - INTERVAL '2 hours'
    `
  ]);

  const cost7Days = parseFloat(cost7DaysResult[0]?.cost || "0");
  const costMonth = parseFloat(costMonthResult[0]?.cost || "0");
  const failures1Hour = failures1HourResult[0]?.count || 0;
  const blocks7Days = blocks7DaysResult[0]?.days || 0;
  const blocks1Hour = blocks1HourResult[0]?.count || 0;
  const tutorCalls2Hours = tutorCalls2HoursResult[0]?.count || 0;

  // Run alert checks
  await runAlertChecks(
    userId,
    cost7Days,
    costMonth,
    failures1Hour,
    blocks7Days,
    blocks1Hour,
    tutorCalls2Hours
  );
}

// ── JSONL Fallback Abuse Scan ──
async function evaluateAbuseJsonl(userId: string): Promise<void> {
  if (!fs.existsSync(LOGS_FILE)) return;

  try {
    const logsData = fs.readFileSync(LOGS_FILE, "utf8");
    const logsLines = logsData.split("\n").filter(Boolean);

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);

    let cost7Days = 0;
    let costMonth = 0;
    let failures1Hour = 0;
    let tutorCalls2Hours = 0;

    for (const line of logsLines) {
      try {
        const record = JSON.parse(line);
        if (record.userId === userId) {
          const time = new Date(record.createdAt).getTime();

          if (record.success) {
            if (time >= sevenDaysAgo) {
              cost7Days += record.estimatedCostUsd;
            }
            if (record.createdAt.startsWith(currentMonthPrefix)) {
              costMonth += record.estimatedCostUsd;
            }
            if (time >= twoHoursAgo && ["eli5", "analogy", "explain"].includes(record.feature)) {
              tutorCalls2Hours++;
            }
          } else {
            if (time >= oneHourAgo) {
              failures1Hour++;
            }
          }
        }
      } catch (e) {}
    }

    // Read blocks from product events
    let blocks7DaysSet = new Set<string>();
    let blocks1Hour = 0;

    if (fs.existsSync(EVENTS_FILE)) {
      const eventsData = fs.readFileSync(EVENTS_FILE, "utf8");
      const eventsLines = eventsData.split("\n").filter(Boolean);

      for (const line of eventsLines) {
        try {
          const record = JSON.parse(line);
          if (record.userId === userId && record.eventName === "limit_blocked") {
            const time = new Date(record.createdAt).getTime();
            const dateStr = record.createdAt.split("T")[0];

            if (time >= sevenDaysAgo) {
              blocks7DaysSet.add(dateStr);
            }
            if (time >= oneHourAgo) {
              blocks1Hour++;
            }
          }
        } catch (e) {}
      }
    }

    await runAlertChecks(
      userId,
      cost7Days,
      costMonth,
      failures1Hour,
      blocks7DaysSet.size,
      blocks1Hour,
      tutorCalls2Hours
    );
  } catch (err) {
    console.error("Local JSONL abuse evaluation crashed:", err);
  }
}

// ── Alert Conditions Checking ──
async function runAlertChecks(
  userId: string,
  cost7Days: number,
  costMonth: number,
  failures1Hour: number,
  blocks7Days: number,
  blocks1Hour: number,
  tutorCalls2Hours: number
): Promise<void> {
  const alerts: { alertType: string; details: string; severity: AlertSeverity }[] = [];

  // 1. Cost alerts
  if (cost7Days > 2.00) {
    alerts.push({
      alertType: "Cost Warning: High 7-Day Spend",
      details: `User has burned $${cost7Days.toFixed(2)} in the last 7 days. Check user usage logs.`,
      severity: "high",
    });
  }

  if (costMonth > 3.50) {
    alerts.push({
      alertType: "Cost Warning: High Monthly Spend",
      details: `User has burned $${costMonth.toFixed(2)} this month. (Cap limit is $4.00)`,
      severity: "high",
    });
  }

  // 2. Failure rate alerts
  if (failures1Hour > 3) {
    alerts.push({
      alertType: "Abnormal failures rate",
      details: `User experienced ${failures1Hour} failed AI requests in the last hour.`,
      severity: "medium",
    });
  }

  // 3. Repeated limit blocks
  if (blocks7Days >= 3) {
    alerts.push({
      alertType: "Repeated Cap Violations",
      details: `User hit the daily quota on ${blocks7Days} different days in the last week.`,
      severity: "medium",
    });
  }

  // 4. Concurrency lock rejections
  if (blocks1Hour > 2) {
    alerts.push({
      alertType: "Concurrency Spam Detected",
      details: `User triggered ${blocks1Hour} limit_blocked events in the last hour. Potential concurrent double-tap spam.`,
      severity: "low",
    });
  }

  // 5. High tutor calls
  if (tutorCalls2Hours > 30) {
    alerts.push({
      alertType: "Tutor Spam Warning",
      details: `User requested ${tutorCalls2Hours} tutor/explain actions in the last 2 hours.`,
      severity: "medium",
    });
  }

  // Dispatch alerts in parallel
  if (alerts.length > 0) {
    console.log(`[Abuse Scanner] User ${userId} flagged with ${alerts.length} warning signals.`);
    await Promise.all(alerts.map((a) => sendAdminAlert({ userId, ...a })));
  }
}
