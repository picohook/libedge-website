-- Optimize notifications indexes:
-- Replace (user_id, created_at) + (user_id, is_read) with a single composite
-- that covers both listing and unread-count in one index scan without memory sort.
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_is_read;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_date
  ON notifications(user_id, is_read, created_at DESC);

-- Partial index for shared-with-me query:
-- WHERE collection_id = ? AND share_id IS NOT NULL ORDER BY added_at DESC
-- Existing (collection_id, added_at) index couldn't filter share_id in-index.
CREATE INDEX IF NOT EXISTS idx_ucf_shared
  ON user_collection_files(collection_id, added_at DESC)
  WHERE share_id IS NOT NULL;
