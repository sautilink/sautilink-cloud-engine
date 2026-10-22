-- Dedicated catalog only: no account, Telegram preference, or Pilot tables.
CREATE TABLE IF NOT EXISTS proxy_candidates (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  secret TEXT NOT NULL,
  transport TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  checked_at INTEGER,
  success_at INTEGER,
  status TEXT NOT NULL DEFAULT 'unverified',
  failures INTEGER NOT NULL DEFAULT 0,
  checks INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  latency_ms REAL,
  reason_code TEXT,
  check_location TEXT,
  history TEXT NOT NULL DEFAULT '[]',
  next_check_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS proxy_due ON proxy_candidates(next_check_at, success_at);

CREATE TABLE IF NOT EXISTS proxy_monitor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  source_refresh_at INTEGER NOT NULL DEFAULT 0,
  last_run_at INTEGER,
  last_error_code TEXT,
  sources TEXT NOT NULL DEFAULT '[]'
);
INSERT OR IGNORE INTO proxy_monitor(id) VALUES (1);

CREATE TABLE IF NOT EXISTS proxy_snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generated_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
