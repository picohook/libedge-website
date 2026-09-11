# 0047-SCOPE-01 — Forward Migration Proposal Review

Status: `PROPOSAL ONLY / NO MIGRATION APPLY / NO LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Why this proposal exists

Live staging inspection established that `user_notifications` does not have the `users(id) ON DELETE CASCADE` FK declared by `migrations/0008_user_notifications.sql`.

Live evidence:

- `PRAGMA foreign_key_list(user_notifications)` -> empty;
- live `sqlite_master` table SQL contains `user_id INTEGER NOT NULL` with no FK clause;
- existing user/type indexes are present.

The current 0047 trigger does not explicitly delete `user_notifications`, so account deletion can leave these user-linked rows behind.

## Additional live FK verification requested by reviewer

Read-only run `34603039414` inspected live staging facts for `notifications`, `ai_usage_logs`, and `product_requests` in addition to `user_notifications`.

Results:

### notifications

Live staging confirms:

`user_id -> users(id) ON DELETE CASCADE`.

Therefore the 0047 explicit `DELETE FROM notifications WHERE user_id = OLD.id` is defensive overlap with a real live FK cascade, not the only cleanup mechanism.

### ai_usage_logs

Live staging confirms:

- `user_id -> users(id) ON DELETE SET NULL`;
- `institution_id -> institutions(id) ON DELETE SET NULL`.

The 0047 explicit DELETE remains necessary because SET NULL can conflict with the table CHECK when `anonymous_id IS NULL`.

### product_requests

Live staging confirms:

- `user_id -> users(id) ON DELETE SET NULL`;
- `institution_id -> institutions(id) ON DELETE CASCADE`.

The 0047 explicit user unlink is consistent with live schema behavior.

## Why the 0008 mismatch likely exists

Repository history shows `migrations/0008_user_notifications.sql` has only one commit in its path history (`9c2677b7911d86bf537b549af6883a13d8ccd541`, 2026-04-15). No later commit changed a no-FK definition into an FK definition.

The live table SQL instead matches the FK-less runtime-DDL shape, while the indexes from 0008 are present.

Most plausible explanation:

1. `user_notifications` already existed in staging before migration 0008 ran;
2. `CREATE TABLE IF NOT EXISTS` therefore did nothing;
3. the subsequent index statements still ran;
4. the pre-existing FK-less table remained in place.

This is strongly consistent with the evidence but is recorded as a plausible reconstruction, not as proven historical fact.

## Proposed forward-only correction

New migration proposal:

`migrations/0049_user_notifications_deletion_policy.sql`

It does not mutate migration 0008 or 0047.

It replaces `trg_users_privacy_cleanup` with the reviewed 0047 body plus exactly one new semantic cleanup statement:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

The new statement is placed beside the existing per-account engagement/notification deletes.

## Scope discipline

The proposal deliberately does **not** rebuild `user_notifications` merely to manufacture the missing FK. The privacy requirement is deterministic account deletion, and an explicit trigger delete is both narrower and compatible with the currently live schema.

No production migration is part of this proposal.

## Regression guard

`test/backend/user-deletion-migration.test.js` is extended so the proposed 0049 must:

- drop/recreate the same trigger;
- retain key 0047 privacy/integrity actions;
- explicitly include `DELETE FROM user_notifications WHERE user_id = OLD.id`.

This remains a source-level guard, not behavioral proof.

## Required reviewer questions

1. Does the live FK audit adequately justify an explicit `user_notifications` trigger deletion?
2. Is a forward-only 0049 preferable to rewriting 0008 or 0047 history?
3. Is explicit deletion narrower/safer than rebuilding the live table solely to restore the missing FK?
4. Does the proposed trigger body preserve the material 0047 semantics without accidental narrowing?
5. Is placement of the new DELETE appropriate?
6. Is the regression guard useful and correctly bounded?
7. Is any further read-only schema verification required before merge?
8. If accepted, may the proposal branch be merged into staging **without applying 0049 yet**?

## Decision boundary

`ACCEPTED` authorizes only merging the migration/test proposal into staging source history.

It does NOT authorize:

- applying migration 0049 to staging;
- applying any migration to production;
- creating staging test accounts;
- seeding fixtures;
- deleting any staging user;
- resuming D-016 Track B;
- semantic-primary enablement.
