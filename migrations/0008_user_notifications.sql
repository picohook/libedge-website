-- User notifications: dosya paylaşımı ve diğer bildirimler
CREATE TABLE IF NOT EXISTS user_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL DEFAULT 'info',   -- file_shared | announcement | system
  title       TEXT    NOT NULL,
  body        TEXT,
  ref_id      INTEGER,                           -- ilgili kayıt id (collection_file id vb.)
  ref_type    TEXT,                              -- 'collection_file' | 'announcement' vb.
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user  ON user_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type  ON user_notifications(type);
