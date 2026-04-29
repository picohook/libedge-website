CREATE TABLE IF NOT EXISTS admin_action_logs (
  id TEXT PRIMARY KEY,
  actor_user_id INTEGER,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  undo_expires_at TEXT,
  undone_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_entity
  ON admin_action_logs(entity_type, entity_id, created_at);

