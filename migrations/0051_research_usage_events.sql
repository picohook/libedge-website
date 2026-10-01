-- 0051_research_usage_events.sql
--
-- Content-free, identity-attributed Research operational usage events.
-- Privacy boundary: no query/answer/claim/evidence/prompt/provider payload or content hashes.
-- Retention is enforced by application pruning at 90 days.

CREATE TABLE IF NOT EXISTS research_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  institution_id INTEGER,
  operation TEXT NOT NULL
    CHECK (operation IN ('assistant_ask')),
  outcome_code TEXT NOT NULL,
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_research_usage_events_created
  ON research_usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_usage_events_user_created
  ON research_usage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_usage_events_institution_created
  ON research_usage_events(institution_id, created_at DESC)
  WHERE institution_id IS NOT NULL;
