export type AlertSeverity = "low" | "medium" | "high";

export interface AdminAlert {
  userId: string;
  alertType: string;
  details: string;
  severity: AlertSeverity;
}

const SEVERITY_LEVELS: Record<AlertSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export async function sendAdminAlert(alert: AdminAlert): Promise<void> {
  const isEnabled = process.env.ADMIN_ALERTS_ENABLED !== "false";
  if (!isEnabled) {
    return;
  }

  const webhookUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`⚠️ Admin Alert triggered but no webhook URL set: [${alert.severity.toUpperCase()}] ${alert.alertType} for User ${alert.userId} - ${alert.details}`);
    return;
  }

  const minSeverityStr = (process.env.ADMIN_ALERT_MIN_SEVERITY || "medium").toLowerCase() as AlertSeverity;
  const minLevel = SEVERITY_LEVELS[minSeverityStr] || 2;
  const currentLevel = SEVERITY_LEVELS[alert.severity] || 1;

  if (currentLevel < minLevel) {
    console.log(`[Alert Filtered] Alert level ${alert.severity} is below minimum severity ${minSeverityStr}`);
    return;
  }

  // Determine indicator emoji based on severity
  let emoji = "ℹ️";
  if (alert.severity === "medium") emoji = "⚠️";
  if (alert.severity === "high") emoji = "🚨";

  // Build a generic JSON webhook payload compatible with both Slack and Discord webhooks
  const payload = {
    text: `${emoji} *[StudySnap Admin Alert]*\n*Severity*: \`${alert.severity.toUpperCase()}\`\n*Event Type*: \`${alert.alertType}\`\n*User ID*: \`${alert.userId}\`\n*Details*: ${alert.details}\n*Timestamp*: \`${new Date().toISOString()}\``,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to post admin alert to webhook. Status: ${res.status}. Response: ${errText}`);
    } else {
      console.log(`📨 Admin alert successfully posted to Discord/Slack: ${alert.alertType}`);
    }
  } catch (err) {
    console.error("Failed to send admin webhook alert:", err);
  }
}
