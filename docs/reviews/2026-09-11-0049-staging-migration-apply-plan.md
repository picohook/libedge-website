# 0049 — Controlled Staging Migration Apply Plan

Date: 2026-09-11
Status: PRE-EXECUTION / REVIEW REQUIRED
Environment: staging only

## Purpose

Apply exactly one forward migration to staging:

`migrations/0049_user_notifications_deletion_policy.sql`

The migration replaces `trg_users_privacy_cleanup` with the reviewed 0047 body plus exactly one new privacy action:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

This plan does **not** authorize account creation, fixture seeding, user deletion, production migration, D-016 Track B resumption, or semantic-primary enablement.

## Why a separate apply review is required

The migration file being present in the repository is not equivalent to the migration being applied to a database. The staging database currently has a live schema divergence for `user_notifications`: the table exists without the `users(id)` foreign key declared in historical migration 0008. A forward trigger replacement was therefore reviewed and merged, but execution remains a separate change-control event.

## Authoritative migration artifact

Path:

`migrations/0049_user_notifications_deletion_policy.sql`

Current staging blob SHA:

`eba44d7bff0a38d8caaa54ffcd51b7763108ed89`

The apply step must operate on this exact reviewed artifact. If the file blob SHA differs at execution time, STOP and return for review.

## Mandatory pre-apply read-only checks

All checks occur immediately before apply.

### 1. Confirm target environment and binding

The command must target the existing staging D1 binding only:

```text
libedge-db --env staging --remote
```

No production binding may be referenced.

### 2. Confirm pending migration set

Run a read-only migration listing immediately before apply.

Required result:

- `0049_user_notifications_deletion_policy.sql` is pending; and
- no other unexpected migration is pending ahead of or alongside it.

If any migration other than 0049 is pending, **HARD STOP**. Do not use `migrations apply` to advance an unexpected batch.

### 3. Confirm current trigger exists and is still the reviewed pre-0049 trigger

Read:

```sql
SELECT sql
FROM sqlite_master
WHERE type='trigger'
  AND name='trg_users_privacy_cleanup';
```

Required pre-state:

- trigger exists;
- it is `BEFORE DELETE ON users`;
- it contains the material 0047 privacy actions;
- it does **not** yet contain `DELETE FROM user_notifications WHERE user_id = OLD.id;`.

Any material discrepancy is a **HARD STOP**.

### 4. Reconfirm live `user_notifications` schema fact

Read-only checks:

```sql
PRAGMA foreign_key_list(user_notifications);
PRAGMA index_list(user_notifications);
SELECT sql FROM sqlite_master
WHERE type='table' AND name='user_notifications';
```

Expected live pre-state:

- no user foreign key;
- `idx_user_notifications_user` exists;
- `idx_user_notifications_type` exists;
- table remains the known FK-less live form.

If the live schema has materially changed, STOP and return for review rather than applying a possibly obsolete correction.

### 5. Confirm no deletion execution is bundled

The apply workflow/command must contain only migration-state inspection, migration apply, and post-apply read-only verification. It must not create users, insert fixtures, call deletion endpoints, or execute `DELETE FROM users`.

## Authorized apply operation if and only if prechecks pass

The execution may apply the pending staging migration through the normal Wrangler D1 migration mechanism.

The apply step must not contain ad hoc SQL that manually drops/recreates the trigger outside the reviewed migration artifact.

Because `wrangler d1 migrations apply` can apply more than one pending migration, the single-pending-migration precondition above is mandatory.

## Mandatory post-apply verification

Immediately after a successful apply, perform all of the following read-only checks before declaring PASS.

### 1. Migration state

Re-list staging migrations.

Required result:

- 0049 is no longer pending / is recorded as applied;
- no unexpected additional migration was applied.

### 2. Trigger existence and exact material behavior

Read the live trigger SQL from `sqlite_master`.

Required result:

- `trg_users_privacy_cleanup` exists;
- remains `BEFORE DELETE ON users`;
- contains `DELETE FROM user_notifications WHERE user_id = OLD.id;`;
- preserves all material reviewed 0047 actions, including at minimum:
  - auth/security cleanup (`refresh_tokens`, `password_resets`, `ra_user_credentials`);
  - `notifications` cleanup;
  - collection/share cleanup;
  - support/R2 purge queue logic;
  - support audit redaction;
  - `product_requests` unlink;
  - `ai_usage_logs` delete;
  - retained-record scrubbing/unlinking;
  - admin audit actor unlink and user snapshot redaction.

The strongest check is a normalized comparison of the live trigger body against the trigger body declared by migration 0049. Whitespace/SQLite serialization differences may be normalized, but no statement-level semantic difference is acceptable.

### 3. `user_notifications` table must be unchanged by 0049

Re-run:

```sql
PRAGMA foreign_key_list(user_notifications);
PRAGMA index_list(user_notifications);
SELECT sql FROM sqlite_master
WHERE type='table' AND name='user_notifications';
```

Required result:

- table definition and indexes are unchanged;
- no table rebuild occurred;
- no synthetic FK was manufactured by this migration.

### 4. No user-data behavior may be exercised in this step

PASS for this migration-apply event means only:

- migration application succeeded;
- migration state is correct;
- live trigger matches the reviewed replacement;
- schema outside the trigger is unchanged as expected.

It does **not** mean deletion behavior has been proven. That remains the purpose of the separately reviewed controlled staging deletion packet.

## Stop conditions

Any of the following is an immediate STOP:

- staging binding cannot be unambiguously confirmed;
- migration file SHA differs from the reviewed artifact;
- any pending migration other than 0049 is present;
- pre-apply trigger is missing or materially unexpected;
- `user_notifications` live schema materially differs from the reviewed pre-state;
- apply command reports failure/partial failure;
- post-apply 0049 migration state is ambiguous;
- post-apply trigger is missing;
- post-apply trigger lacks explicit `user_notifications` cleanup;
- post-apply trigger loses any material 0047 privacy action;
- post-apply table/index state changes unexpectedly;
- any user/fixture/deletion operation occurs during this step.

No automatic retry is authorized after a STOP.

## Recovery model

Migration 0049 is a trigger replacement, not a data migration. If apply succeeds but post-apply verification fails:

1. do not run any user-deletion test;
2. preserve exact live trigger SQL and migration-state evidence;
3. do not manually reconstruct data (none should have been changed by this migration);
4. do not perform an ad hoc `DROP TRIGGER` or manual trigger replacement as an unreviewed rollback;
5. return for review and prepare a forward correction or explicitly reviewed trigger restoration plan.

The absence of user-deletion execution during this migration step is the main safety boundary: a bad trigger can be detected before it is exercised.

## Success definition

This migration-apply step is PASS only if all of the following are true:

1. exactly 0049 was pending before apply;
2. exactly 0049 was applied;
3. live trigger exists after apply;
4. live trigger contains the explicit `user_notifications` delete;
5. live trigger preserves the material 0047 privacy policy;
6. `user_notifications` table/index state remains unchanged;
7. no user account or user-linked fixture was created, modified, or deleted;
8. all evidence is captured for independent review.

## Decision boundary after PASS

A PASS would authorize only recording that 0049 is correctly installed in staging.

It would **not** authorize the controlled deletion execution. The deletion packet still requires its own explicit reviewer acceptance and a fresh isolated-staging human confirmation immediately before any synthetic account/fixture/deletion activity.
