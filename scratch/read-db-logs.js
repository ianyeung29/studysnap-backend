const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const dbUrlLine = envFile.split('\n').find(line => line.startsWith('DATABASE_URL'));
const dbUrl = dbUrlLine.split('=')[1].replace(/"/g, '').trim();

async function readLogs() {
  console.log("Connecting to Neon database...");
  const sql = neon(dbUrl);
  try {
    const logs = await sql`
      SELECT * FROM ai_usage_logs
      ORDER BY created_at DESC
      LIMIT 15
    `;
    console.log("\n--- LATEST AI USAGE LOGS ---");
    console.log(JSON.stringify(logs, null, 2));

    const users = await sql`
      SELECT * FROM users
      ORDER BY last_seen_at DESC
      LIMIT 10
    `;
    console.log("\n--- LATEST USERS ---");
    console.log(JSON.stringify(users, null, 2));

    const events = await sql`
      SELECT * FROM product_events
      ORDER BY created_at DESC
      LIMIT 15
    `;
    console.log("\n--- LATEST PRODUCT EVENTS ---");
    console.log(JSON.stringify(events, null, 2));
  } catch (err) {
    console.error("Database query failed:", err);
  }
}

readLogs();
