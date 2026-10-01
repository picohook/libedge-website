-- 0054_assistant_saved_queries.sql
-- #372: private, encrypted-at-application-layer Assistant history.
-- query/result plaintext must never be stored in this table.
CREATE TABLE IF NOT EXISTS assistant_saved_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  query_ciphertext TEXT NOT NULL,
  result_ciphertext TEXT NOT NULL,
  outcome_code TEXT NOT NULL CHECK (outcome_code = 'OK'),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+90 days')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assistant_saved_queries_owner_created
  ON assistant_saved_queries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_saved_queries_expiry
  ON assistant_saved_queries(expires_at);
