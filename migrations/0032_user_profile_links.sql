CREATE TABLE IF NOT EXISTS user_profile_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  link_type TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  display_order INTEGER DEFAULT 999,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  UNIQUE(user_id, link_type),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_profile_links_user_order
  ON user_profile_links(user_id, display_order ASC, id ASC);
