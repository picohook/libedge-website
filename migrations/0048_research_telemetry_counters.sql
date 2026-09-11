-- Exact aggregate research telemetry counters.
-- Stores only allowlisted metric names, UTC date buckets and numeric aggregate values.
-- No query/user/topic/result content is permitted in this table.

CREATE TABLE IF NOT EXISTS research_telemetry_counters (
  date_utc TEXT NOT NULL,
  metric TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date_utc, metric)
);
