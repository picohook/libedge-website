# 0047 — Live FK Assumption Audit

Status: `READ-ONLY COMPLETE / NO MIGRATION APPLY / NO LIVE DELETION`

Date: 2026-09-11

## Purpose

Validate live staging FK assumptions that had previously been inferred from repository migration files, after `user_notifications` was found to diverge from its canonical migration.

This audit is read-only and does not authorize any migration apply or user deletion.

## Live inspection

One-time read-only workflow run:

- workflow: `Inspect staging user-linked FK assumptions`
- run: `34603039414`
- staging D1: `libedge-db` (`207d80d6-7e6b-4e10-aacf-b218970dbaf8`)
- result: SUCCESS

Inspected live `PRAGMA foreign_key_list`, `PRAGMA index_list`, and `sqlite_master` table SQL for:

- `user_notifications`
- `notifications`
- `ai_usage_logs`
- `product_requests`

The temporary workflow was removed after the read-only run.

## Results

### user_notifications

Live staging:

- `PRAGMA foreign_key_list(user_notifications)` -> **empty**;
- table SQL contains `user_id INTEGER NOT NULL` with **no FK clause**;
- `idx_user_notifications_user` exists;
- `idx_user_notifications_type` exists.

Conclusion:

`user_notifications` does **not** have the repository migration's declared `users(id) ON DELETE CASCADE` in live staging. The current 0047 trigger also does not explicitly delete this table, so an explicit deletion-policy correction is required before controlled deletion testing.

### notifications

Live staging:

- `user_id -> users(id)` exists;
- `ON DELETE CASCADE` is present;
- live table SQL confirms the FK;
- a user-oriented notification index exists.

Conclusion:

The repository-level statement that explicit trigger deletion of `notifications` overlaps a real FK cascade is valid for live staging. The explicit trigger DELETE remains intentionally defensive for legacy/schema-drift tolerance.

### ai_usage_logs

Live staging:

- `user_id -> users(id) ON DELETE SET NULL` exists;
- `institution_id -> institutions(id) ON DELETE SET NULL` exists;
- live table SQL matches those actions;
- `idx_ai_usage_logs_user_created` exists.

Conclusion:

The 0047 explicit `DELETE FROM ai_usage_logs WHERE user_id = OLD.id` remains necessary to preserve the table CHECK invariant for rows with `anonymous_id IS NULL`; the live FK is not a substitute for the trigger deletion policy.

### product_requests

Live staging:

- `user_id -> users(id) ON DELETE SET NULL` exists;
- `institution_id -> institutions(id) ON DELETE CASCADE` exists;
- live table SQL confirms both actions.

Conclusion:

The 0047 trigger's explicit user unlink is consistent with live schema behavior and is not relying on an unverified FK assumption.

## Migration-history investigation

`migrations/0008_user_notifications.sql` has only one commit in its path history on `staging` (`9c2677b7911d86bf537b549af6883a13d8ccd541`, 2026-04-15). The file was therefore not later edited from a no-FK version into an FK version within the current Git history.

This makes the earlier hypothesis "0008 was later edited after being applied" unsupported by repository history.

The live table SQL instead exactly resembles the FK-less runtime-DDL shape. A plausible explanation is that `user_notifications` already existed in the staging D1 before migration 0008 attempted `CREATE TABLE IF NOT EXISTS`, causing the migration's CREATE TABLE statement to be a no-op while its subsequent indexes were still created. This explanation is strongly consistent with the observed schema/index combination, but is not treated as fully proven without historical deployment/database evidence.

## Policy consequence

`0047-SCOPE-01` remains OPEN.

The next correction should be forward-only and should not mutate migration 0008 or 0047 history.

Proposed semantic correction:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

The correction should be delivered by a new trigger-replacement migration proposal, independently byte-reviewed before any staging apply.

## Boundary

This audit does NOT authorize:

- applying a new migration to staging or production;
- creating synthetic staging accounts;
- seeding fixture rows;
- deleting any staging user;
- production migration work;
- D-016 Track B resumption;
- semantic-primary enablement.
