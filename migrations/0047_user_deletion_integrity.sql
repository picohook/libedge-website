-- 0047_user_deletion_integrity.sql
-- Central privacy/integrity policy for every users row deletion.
--
-- Why a DB trigger:
-- - both self-service and admin deletion currently delete users directly;
-- - several legacy tables do not have ON DELETE actions;
-- - keeping the policy in one place prevents the two endpoints from drifting.
--
-- R2 cannot be deleted from SQLite. Ticket attachment URLs are therefore queued
-- before their ticket rows are removed so a Worker/admin purge can delete the
-- physical objects without losing the object reference.

CREATE TABLE IF NOT EXISTS privacy_r2_purge_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_url TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  purged_at TEXT,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_privacy_r2_purge_pending
  ON privacy_r2_purge_queue(purged_at, requested_at);

DROP TRIGGER IF EXISTS trg_users_privacy_cleanup;

CREATE TRIGGER trg_users_privacy_cleanup
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
  -- Security/auth material: never retain after the account is gone.
  DELETE FROM subscriptions WHERE user_id = OLD.id;
  DELETE FROM newsletter_subscriptions WHERE user_id = OLD.id;
  DELETE FROM user_profile_links WHERE user_id = OLD.id;
  DELETE FROM refresh_tokens WHERE user_id = OLD.id;
  DELETE FROM password_resets WHERE user_id = OLD.id;
  DELETE FROM ra_user_credentials WHERE user_id = OLD.id;

  -- Support content belongs to the deleted account. Queue managed R2 objects
  -- before removing the DB rows so physical purge remains possible.
  INSERT OR IGNORE INTO privacy_r2_purge_queue (object_url, reason)
    SELECT tr.attachment_url, 'user_deletion'
      FROM ticket_replies tr
      JOIN support_tickets st ON st.id = tr.ticket_id
     WHERE st.user_id = OLD.id
       AND tr.attachment_url IS NOT NULL
       AND TRIM(tr.attachment_url) <> '';

  DELETE FROM ticket_replies
   WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = OLD.id);
  DELETE FROM support_tickets WHERE user_id = OLD.id;

  -- Analytics/business records may be retained only after unlinking the user.
  UPDATE product_requests SET user_id = NULL WHERE user_id = OLD.id;
  UPDATE ai_usage_logs SET user_id = NULL WHERE user_id = OLD.id;
  UPDATE affiliate_clicks SET user_id = NULL WHERE user_id = OLD.id;
  UPDATE ra_link_audit_findings SET user_id = NULL WHERE user_id = OLD.id;

  -- Shared/institutional content must survive account deletion, but its creator
  -- or uploader link must not keep pointing at a deleted user.
  UPDATE files SET uploaded_by = NULL WHERE uploaded_by = OLD.id;
  UPDATE collections SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE collection_files SET added_by = NULL WHERE added_by = OLD.id;
  UPDATE institution_folders SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE institution_files SET uploaded_by = NULL WHERE uploaded_by = OLD.id;
  UPDATE announcements SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE institution_subscriptions SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE ticket_replies SET user_id = NULL WHERE user_id = OLD.id;

  -- A moderator can be referenced by another user's deleted comment. Null this
  -- first so the user row deletion cannot be blocked by the foreign key.
  UPDATE announcement_comments SET deleted_by = NULL WHERE deleted_by = OLD.id;

  -- Preserve admin audit events as events, not as personal profiles. If the
  -- deleted account was the target, redact snapshots that can contain profile
  -- fields; if it was the actor, unlink the actor id.
  UPDATE admin_action_logs
     SET actor_user_id = NULL
   WHERE actor_user_id = OLD.id;

  UPDATE admin_action_logs
     SET before_json = NULL,
         after_json = NULL
   WHERE entity_type = 'user'
     AND entity_id = CAST(OLD.id AS TEXT);
END;
