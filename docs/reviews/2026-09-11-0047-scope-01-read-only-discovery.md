# 0047-SCOPE-01 — Read-only `user_notifications` discovery

Status: `READ-ONLY DISCOVERY COMPLETE / LIVE STAGING SCHEMA CONFIRMATION STILL REQUIRED`

Date: 2026-09-11

## Purpose

Record the authorized read-only repository/schema-source investigation for `user_notifications` before any follow-up migration SQL is prepared and before any controlled staging deletion is executed.

No migration is applied by this record. No staging fixture/account is created. No deletion is executed.

## Repository schema source

The canonical migration that creates `user_notifications` is:

`migrations/0008_user_notifications.sql`

It defines:

```sql
CREATE TABLE IF NOT EXISTS user_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL DEFAULT 'info',
  title       TEXT    NOT NULL,
  body        TEXT,
  ref_id      INTEGER,
  ref_type    TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON user_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type
  ON user_notifications(type);
```

This materially changes the preliminary 0047-SCOPE-01 hypothesis. Under the canonical migrated schema, `user_notifications` is already deletion-coupled to `users` through `ON DELETE CASCADE`, and it already has an index beginning with `user_id`.

Therefore absence of an explicit `DELETE FROM user_notifications ...` statement inside `trg_users_privacy_cleanup` is **not by itself evidence of residual rows** when the actual database schema matches migration 0008.

## Runtime-DDL discrepancy

The application also contains a `shouldRunRuntimeDdl(...)` fallback that can create `user_notifications` without the FK declaration.

However `shouldRunRuntimeDdl` is disabled in strict runtime environments (`staging` and `production`). Therefore the runtime-DDL definition is not the authoritative expected schema for staging/production.

This discrepancy is still worth recording because it explains how a source-only scan of runtime DDL can produce the false impression that no cascade exists.

## Application-path scan

In the current staging backend source, `user_notifications` is actively written by the institution send-to-users flow using `INSERT OR IGNORE INTO user_notifications (...)` with per-user title/body content.

The repository-level scan found the table creation fallback and the active insert path; no independent retention policy requiring notification rows to survive account deletion was identified in this read-only pass.

The intended privacy disposition remains `DELETE with the account`.

## Index / performance conclusion

Migration 0008 creates:

`idx_user_notifications_user(user_id, is_read)`

This is sufficient for user-scoped cascade deletion lookup because `user_id` is the leading indexed column. No new index is justified from repository schema evidence alone.

## Corrected triage

`0047-SCOPE-01` should not yet be treated as requiring a trigger-replacement migration.

Correct state:

`TRIAGED / CANONICAL SCHEMA CASCADE-COVERS USER_NOTIFICATIONS / LIVE STAGING FK CONFIRMATION REQUIRED`

A follow-up migration such as 0049 is **not justified unless fresh read-only staging schema evidence shows that the live `user_notifications` table lacks the reviewed `users(id) ON DELETE CASCADE` FK or otherwise materially diverges from migration 0008**.

## Required live read-only staging confirmation

Before any fixture creation or deletion, obtain fresh staging evidence for:

1. `PRAGMA table_info(user_notifications)`;
2. `PRAGMA foreign_key_list(user_notifications)`;
3. `PRAGMA index_list(user_notifications)` plus index details as needed;
4. confirmation that the FK target is `users(id)` with `ON DELETE CASCADE`;
5. confirmation that `idx_user_notifications_user` exists with `user_id` as the leading column.

If these checks match migration 0008, no 0049 trigger-replacement migration is required for this finding.

If they do not match, execution remains STOPPED and the discrepancy returns for migration design/review.

## Controlled execution packet consequence

The eventual controlled staging packet should include `user_notifications` as a **30th user-deletion policy domain**, but classify its expected deletion mechanism as `FK CASCADE`, not `0047 trigger statement`, provided live staging schema confirmation matches migration 0008.

Required assertions then become:

- target `user_notifications` row(s) disappear after user deletion;
- `U_CONTROL` `user_notifications` row(s) remain unchanged;
- PRE/POST counts are recorded;
- live FK/index evidence is included in the packet.

The trigger itself may remain the reviewed 29-table trigger if the cascade is confirmed.

## Active user-linked inventory conclusion

The reviewer reported `user_notifications` as the only runtime-DDL user-linked table omitted from the explicit trigger. This read-only pass does not establish a second omission. The important distinction is now explicit:

- some deletion-policy domains are handled explicitly by 0047;
- some domains may be safely handled by schema-level FK cascades.

The execution packet must test the complete deletion policy surface rather than equating "not named in the trigger" with "not deleted".

## Authorization boundary

Still prohibited:

- writing/applying migration 0049;
- applying any staging or production migration;
- creating staging disposable accounts;
- seeding fixtures;
- deleting staging users;
- resuming D-016 Track B;
- enabling semantic-primary.
