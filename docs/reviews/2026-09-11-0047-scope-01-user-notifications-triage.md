# 0047-SCOPE-01 — `user_notifications` deletion-scope review

Status: `TRIAGED / CANONICAL FK CASCADE COVERS TABLE / LIVE STAGING CONFIRMATION REQUIRED`

Date: 2026-09-11

## Original finding

The controlled 0047 staging-deletion packet accurately covered all 29 tables explicitly touched by `trg_users_privacy_cleanup`, while a systematic runtime-DDL scan identified an additional active user-scoped table not named in the trigger: `user_notifications`.

The application actively inserts per-user rows containing notification title/body content, so the table must be part of the account-deletion privacy surface.

## Read-only correction

Repository-level schema-source inspection found that the authoritative migration is:

`migrations/0008_user_notifications.sql`

It defines:

```sql
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

and creates:

```sql
CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON user_notifications(user_id, is_read);
```

Therefore the preliminary statement that there is no FK/cascade policy was too broad. Under the canonical migrated schema, `user_notifications` is already deleted with the parent `users` row by SQLite/D1 FK cascade even though migration 0047 does not contain an explicit `DELETE FROM user_notifications ...` statement.

The runtime-DDL fallback in application code omits this FK, but `shouldRunRuntimeDdl(...)` is disabled for strict runtime environments (`staging` and `production`). That fallback is therefore not the expected authoritative staging/production schema.

## Application-path result

The current staging backend contains an active institution send-to-users write path using:

`INSERT OR IGNORE INTO user_notifications (...)`

No intentional post-account-deletion retention requirement for these per-user notification records was identified in the read-only repository pass.

Intended privacy disposition remains:

`DELETE with the account`.

## Index / performance result

`idx_user_notifications_user(user_id, is_read)` has `user_id` as its leading column. Repository schema evidence therefore does not justify adding a new deletion index.

The existing stress pair remains unchanged:

- `25,000 ai_usage_logs`;
- `25,000 notifications`.

## Corrected triage decision

A trigger-replacement migration (for example 0049) is **not currently justified** merely because `user_notifications` is absent from the 0047 trigger.

The finding is now:

`TRIAGED / CANONICAL SCHEMA CASCADE-COVERS USER_NOTIFICATIONS / LIVE STAGING FK CONFIRMATION REQUIRED`.

Before any controlled staging deletion, fresh read-only staging evidence must confirm:

1. `PRAGMA table_info(user_notifications)` matches the expected columns;
2. `PRAGMA foreign_key_list(user_notifications)` contains `users(id)` with `ON DELETE CASCADE`;
3. `PRAGMA index_list(user_notifications)` / index details confirm the reviewed user index;
4. no material staging schema divergence exists.

If live staging matches migration 0008, no follow-up trigger migration is required for `0047-SCOPE-01`.

If live staging does **not** match migration 0008, execution remains STOPPED and the discrepancy returns for separate migration design/review.

## Controlled packet effect

The controlled deletion packet must include `user_notifications` as a **30th deletion-policy domain**, while preserving the distinction:

- 29 domains are explicitly touched by the 0047 trigger;
- `user_notifications` is expected to be removed by schema-level FK cascade.

Required fixture/assertions:

- seed at least one target `user_notifications` row for each target path;
- target rows must disappear after account deletion;
- `U_CONTROL` `user_notifications` rows must remain unchanged;
- PRE/POST counts must be recorded;
- live FK/index evidence must be preserved in the execution record.

## Execution boundary

Controlled staging deletion remains **BLOCKED BEFORE EXECUTION** until the amended packet and this corrected triage are independently reviewed and the required live read-only staging schema confirmation is obtained.

No synthetic account may be created, no fixture may be seeded, and no deletion may be run yet.

## Production / D-016 boundary

Unchanged:

- no production migration is authorized;
- production 0042-0048 backlog remains STOPPED;
- D-016 Track B remains STOPPED;
- semantic-primary remains OFF;
- this finding remains outside D-016.

Supporting discovery record:

`docs/reviews/2026-09-11-0047-scope-01-read-only-discovery.md`
