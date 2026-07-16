const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local not found!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!dbUrlMatch) {
  console.error("Error: DATABASE_URL not found in .env.local!");
  process.exit(1);
}

const databaseUrl = dbUrlMatch[1];
console.log("Connecting to Neon database...");
const sql = neon(databaseUrl);

async function run() {
  try {
    console.log("Creating sessions table...");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id TEXT NOT NULL,
        title VARCHAR(255) NOT NULL,
        course VARCHAR(255),
        parent_folder VARCHAR(255),
        template_id VARCHAR(50),
        audio_uri TEXT,
        audio_duration INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        artifact_json JSONB,
        document_notes JSONB
      );
    `);
    console.log("Creating index on sessions...");
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);
    console.log("SUCCESS: Sessions table created or already exists!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

run();
