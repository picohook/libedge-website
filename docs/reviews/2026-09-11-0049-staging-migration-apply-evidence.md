# 0049 Controlled Staging Migration Apply — Evidence

Date: 2026-09-11
Environment: staging only
Migration: `migrations/0049_user_notifications_deletion_policy.sql`
Reviewed git blob SHA: `eba44d7bff0a38d8caaa54ffcd51b7763108ed89`
Workflow run: `34606916660`
Job: `Controlled staging 0049 migration apply`
Result: SUCCESS

## Authorization boundary

This execution was authorized only to apply migration 0049 once to staging under the accepted controlled-apply plan.

It did not authorize or perform:

- account creation;
- fixture seeding;
- any user deletion;
- any production migration;
- D-016 Track B resumption;
- semantic-primary enablement.

## Exact apply command

```bash
npx wrangler d1 migrations apply libedge-db --env staging --remote
```

## Pre-apply evidence

Target printed by the job:

- database binding: `libedge-db`
- environment: `staging`
- remote: yes

Migration blob check:

- actual blob SHA: `eba44d7bff0a38d8caaa54ffcd51b7763108ed89`
- matched reviewed SHA.

Pending migration list immediately before apply:

```text
0049_user_notifications_deletion_policy.sql
```

Parsed pending set was exactly one migration: 0049.

Current live trigger immediately before apply semantically matched the reviewed migration-0047 trigger body and did not yet contain:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

`user_notifications` pre-state:

- `PRAGMA foreign_key_list(user_notifications)` returned no rows;
- `idx_user_notifications_user` present;
- `idx_user_notifications_type` present;
- live table SQL contained no FK / `REFERENCES users` clause.

The job reported:

```text
PRECHECKS PASS
```

## Apply result

Wrangler reported exactly one migration to be applied:

```text
0049_user_notifications_deletion_policy.sql
```

Wrangler then reported:

```text
0049_user_notifications_deletion_policy.sql | ✅
```

No other migration was applied.

## Post-apply evidence

Immediately after apply:

```text
✅ No migrations to apply!
```

The live `trg_users_privacy_cleanup` trigger:

- remains `BEFORE DELETE ON users`;
- contains `DELETE FROM user_notifications WHERE user_id = OLD.id;`;
- contains the material migration-0047 privacy operations including notifications cleanup, AI usage deletion, product-request unlinking, R2 purge queue handling, support-ticket snapshot redaction, and user audit snapshot redaction;
- semantically matched the reviewed migration-0049 trigger body after normalization for whitespace/comments/SQLite serialization.

`user_notifications` post-state:

- still has no foreign key;
- still has both expected indexes;
- table SQL itself was unchanged and was not rebuilt.

The job reported:

```text
POSTCHECKS PASS
```

## Classification

Main-thread mechanical classification:

`0049 STAGING MIGRATION APPLY — PASS, PENDING INDEPENDENT REVIEW`

This PASS means only that the authorized DDL/trigger migration was applied to staging and mechanically verified.

It does not yet prove deletion behavior. No live deletion has been executed.

## Cleanup

The one-time workflow `.github/workflows/apply-0049-staging-once.yml` was removed after the successful run.

Cleanup commit:

`ad5a559cad3ae22abea988725fc379c418a3fe26`
