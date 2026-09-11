# 0049 — Staging Migration Apply Review Request

Date: 2026-09-11
Status: REVIEW REQUEST / NO APPLY AUTHORIZED YET

## Context

PR #38 has been independently ACCEPTED and merged into `staging`.

Migration 0049 is now present in the repository but remains unapplied to all databases.

This review asks only whether one controlled **staging migration apply** may be performed under the canonical pre/post checks below.

## Canonical apply plan

`docs/reviews/2026-09-11-0049-staging-migration-apply-plan.md`

Plan commit:

`3f6a89bbcbe824bb94e0a7c459781fe4d90dc83f`

## Migration artifact

`migrations/0049_user_notifications_deletion_policy.sql`

Reviewed staging blob SHA:

`eba44d7bff0a38d8caaa54ffcd51b7763108ed89`

## Known live staging facts from prior read-only inspection

- `user_notifications` exists with no FK to `users`.
- `idx_user_notifications_user` exists.
- `idx_user_notifications_type` exists.
- `notifications.user_id -> users.id ON DELETE CASCADE` exists.
- `ai_usage_logs.user_id -> users.id ON DELETE SET NULL` exists.
- `product_requests.user_id -> users.id ON DELETE SET NULL` exists.

0049 does not rebuild any table or manufacture a new FK. It replaces the existing user-deletion privacy trigger with the reviewed 0047 body plus:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

## Mandatory pre-apply conditions

Immediately before apply:

1. Confirm staging D1 target/binding only.
2. Confirm migration file blob SHA is still the reviewed SHA.
3. List pending staging migrations.
4. Require **exactly 0049** as the only pending migration; any other pending migration is a hard STOP.
5. Read the current live `trg_users_privacy_cleanup` SQL and confirm it is still the expected pre-0049 trigger.
6. Re-read live `user_notifications` FK/index/table SQL and confirm the reviewed pre-state still holds.
7. Confirm the execution contains no account creation, fixture seed, deletion endpoint, or direct `DELETE FROM users`.

## Authorized operation if accepted

Only the normal staging Wrangler D1 migration application, and only after all prechecks pass.

No manual trigger SQL may substitute for the reviewed migration file.

## Mandatory post-apply checks

1. Re-list migrations and prove 0049 is applied with no unexpected migration advancement.
2. Read live trigger SQL from `sqlite_master`.
3. Confirm the trigger is still `BEFORE DELETE ON users`.
4. Confirm explicit `DELETE FROM user_notifications WHERE user_id = OLD.id;` exists.
5. Confirm the material 0047 privacy policy remains present.
6. Re-read `user_notifications` table/FK/index state and confirm it is unchanged.
7. Capture the complete evidence for independent review.

A normalized live-trigger-vs-0049 comparison is preferred over a few substring checks; whitespace serialization may differ, but statement-level semantics must not.

## Hard STOP conditions

STOP without retry if:

- target/binding is ambiguous;
- reviewed migration SHA changed;
- pending migration set contains anything other than 0049;
- pre-state trigger/schema differs materially;
- migration apply fails or is ambiguous;
- post-state trigger differs materially from 0049;
- any material 0047 action disappears;
- `user_notifications` table/index definition changes unexpectedly;
- any user-data execution occurs.

## Recovery boundary

If apply succeeds but verification fails, no deletion test may run. Do not issue an ad hoc trigger rollback. Preserve evidence and return for a separately reviewed forward correction/restoration plan.

## Review questions

1. Is requiring 0049 to be the **only** pending staging migration before using `wrangler d1 migrations apply` sufficiently conservative?
2. Are the pre-apply schema/trigger checks sufficient to prevent applying a stale correction?
3. Is checking the live trigger against the 0049 trigger body after apply strong enough?
4. Is it correct to require `user_notifications` table/FK/index state to remain unchanged?
5. Is the recovery rule correct: no deletion exercise and no ad hoc rollback if post-apply verification fails?
6. Is any additional read-only precheck required?
7. If accepted, may exactly one controlled staging 0049 migration apply be executed under this plan?

## Required classification

- ACCEPTED
- ACCEPTED WITH MODIFICATION
- REJECTED

Also report any material:

- OUT-OF-SCOPE FINDING

## Decision boundary

An **ACCEPTED** decision would authorize only one controlled 0049 apply to **staging**, with the locked pre/post verification sequence.

It would **not** authorize:

- creating a staging test account;
- seeding deletion fixtures;
- deleting any staging user;
- applying 0049 or any other migration to production;
- resuming D-016 Track B;
- semantic-primary enablement;
- automatic retry after a STOP.
