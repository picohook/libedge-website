CREATE TABLE IF NOT EXISTS file_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  message TEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS share_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  delivered_at DATETIME,
  read_at DATETIME,
  FOREIGN KEY (share_id) REFERENCES file_shares(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (share_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  parent_id INTEGER,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES user_collections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_collection_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  share_id INTEGER,
  display_name TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (collection_id) REFERENCES user_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (share_id) REFERENCES file_shares(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  data TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_shares_file_id
  ON file_shares(file_id);

CREATE INDEX IF NOT EXISTS idx_file_shares_from_user
  ON file_shares(from_user_id);

CREATE INDEX IF NOT EXISTS idx_share_recipients_share_id
  ON share_recipients(share_id);

CREATE INDEX IF NOT EXISTS idx_share_recipients_user_id
  ON share_recipients(user_id);

CREATE INDEX IF NOT EXISTS idx_user_collections_user_id
  ON user_collections(user_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_user_collection_files_collection
  ON user_collection_files(collection_id, added_at);

CREATE INDEX IF NOT EXISTS idx_user_collection_files_file
  ON user_collection_files(file_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON notifications(user_id, is_read);
