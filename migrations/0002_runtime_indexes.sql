-- =====================================================================
-- 0002_runtime_indexes.sql
-- Non-breaking indexes for the runtime query patterns used by the backend.
-- Safe for both fresh installs and existing databases.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_users_institution_id
  ON users(institution_id);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_last_login
  ON users(last_login);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_institution_subscriptions_institution_status
  ON institution_subscriptions(institution_id, status);

CREATE INDEX IF NOT EXISTS idx_institution_files_institution_active
  ON institution_files(institution_id, is_active);

CREATE INDEX IF NOT EXISTS idx_institution_files_folder_active
  ON institution_files(folder_id, is_active);

CREATE INDEX IF NOT EXISTS idx_institution_folders_institution_parent
  ON institution_folders(institution_id, parent_folder_id);

CREATE INDEX IF NOT EXISTS idx_announcements_published_date
  ON announcements(is_published, published_at);
