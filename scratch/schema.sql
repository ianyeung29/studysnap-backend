-- schema.sql — Neon PostgreSQL Table Creations and Indexes

-- 1. Product Events Table
CREATE TABLE IF NOT EXISTS product_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  metadata_json JSONB,
  platform VARCHAR(50),
  app_version VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_events_user_id ON product_events(user_id);

-- 2. AI Usage Logs Table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(255),
  feature VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  cached_input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) DEFAULT 0.0,
  latency_ms INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_code VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
