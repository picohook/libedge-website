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

  -- Explicitly remove account-owned engagement/personal collections even though
  -- newer schemas also define cascading foreign keys. This keeps the privacy
  -- behavior deterministic for legacy databases.
  DELETE FROM announcement_reactions WHERE user_id = OLD.id;
  DELETE FROM announcement_comments WHERE user_id = OLD.id;
  DELETE FROM notifications WHERE user_id = OLD.id;
  DELETE FROM share_recipients WHERE user_id = OLD.id;

  DELETE FROM user_collection_files
   WHERE collection_id IN (SELECT id FROM user_collections WHERE user_id = OLD.id);
  DELETE FROM user_collections WHERE user_id = OLD.id;

  DELETE FROM share_recipients
   WHERE share_id IN (SELECT id FROM file_shares WHERE from_user_id = OLD.id);
  DELETE FROM file_shares WHERE from_user_id = OLD.id;

  -- Support content belongs to the deleted account. Queue managed R2 objects
  -- before removing the DB rows so physical purge remains possible.
  INSERT OR IGNORE INTO privacy_r2_purge_queue (object_url, reason)
    SELECT tr.attachment_url, 'user_deletion'
      FROM ticket_replies tr
      JOIN support_tickets st ON st.id = tr.ticket_id
     WHERE st.user_id = OLD.id
       AND tr.attachment_url IS NOT NULL
       AND TRIM(tr.attachment_url) <> '';

  -- Redact support audit snapshots before the underlying ticket IDs disappear.
  UPDATE admin_action_logs
     SET before_json = NULL,
         after_json = NULL
   WHERE entity_type = 'support_ticket'
     AND entity_id IN (
       SELECT CAST(id AS TEXT) FROM support_tickets WHERE user_id = OLD.id
     );

  DELETE FROM ticket_replies
   WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = OLD.id);
  DELETE FROM support_tickets WHERE user_id = OLD.id;

  -- A reply authored by this user on somebody else's ticket may remain as part
  -- of the support record, but it must no longer identify the deleted account.
  UPDATE ticket_replies SET user_id = NULL WHERE user_id = OLD.id;

  -- Business records may be retained only after unlinking/scrubbing the user.
  UPDATE product_requests SET user_id = NULL WHERE user_id = OLD.id;

  -- AI usage has only short-lived hashed telemetry. Deleting it is safer than
  -- NULLing user_id because rows may have anonymous_id = NULL and are protected
  -- by CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL).
  DELETE FROM ai_usage_logs WHERE user_id = OLD.id;

  UPDATE affiliate_clicks
     SET user_id = NULL,
         referer = NULL,
         user_agent = NULL
   WHERE user_id = OLD.id;

  -- Retired RA diagnostic rows can contain URLs/sample text; do not retain them
  -- for a deleted user.
  DELETE FROM ra_link_audit_findings WHERE user_id = OLD.id;

  -- Form submissions are operational/business records. Preserve non-personal
  -- workflow metadata while removing free-text and direct identifiers.
  UPDATE form_submissions
     SET user_id = NULL,
         name = NULL,
         email = NULL,
         subject = NULL,
         message = NULL,
         admin_note = NULL
   WHERE user_id = OLD.id;

  -- Shared/institutional content must survive account deletion, but its creator
  -- or uploader link must not keep pointing at a deleted user.
  UPDATE files SET uploaded_by = NULL WHERE uploaded_by = OLD.id;
  UPDATE collections SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE collection_files SET added_by = NULL WHERE added_by = OLD.id;
  UPDATE institution_folders SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE institution_files SET uploaded_by = NULL WHERE uploaded_by = OLD.id;
  UPDATE announcements SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE institution_subscriptions SET created_by = NULL WHERE created_by = OLD.id;

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
