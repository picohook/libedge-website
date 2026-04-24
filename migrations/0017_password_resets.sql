-- Password reset tokens.
--
-- The Worker stores only a SHA-256 hash of the raw token so that a DB
-- compromise cannot be replayed against live users. Raw token is sent
-- to the user via email (Resend) and never persisted.

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL,
  ip         TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id   ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires   ON password_resets(expires_at);
