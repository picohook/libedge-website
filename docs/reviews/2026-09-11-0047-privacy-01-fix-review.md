# 0047-PRIVACY-01 — Admin deletion audit snapshot ordering fix

Status: `CODE FIX PREPARED / REVIEW REQUIRED / NO LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Finding

The admin user-deletion endpoint wrote its `admin_action_logs` deletion record after `DELETE FROM users` inside the same D1 batch. Migration 0047 installs a `BEFORE DELETE ON users` trigger that redacts existing user audit snapshots. Because the audit row did not yet exist when the trigger fired, the newly inserted `before_json` could retain the deleted user's identifying profile fields.

The self-service `/api/user/delete` path does not create an `admin_action_logs` deletion record and therefore does not have this specific post-trigger audit-snapshot issue.

## Schema validation

`admin_action_logs` has no foreign key from `entity_id` or `actor_user_id` to `users`. Its `entity_id` is text and is intentionally capable of surviving deletion of the referenced application entity. Therefore creating the deletion audit row before deleting the target user does not introduce a user foreign-key dependency.

Migration 0047 already contains both relevant cleanup statements:

- it clears `actor_user_id` when the deleted user is the audit actor;
- it sets `before_json` and `after_json` to `NULL` for `entity_type = 'user'` and `entity_id = CAST(OLD.id AS TEXT)`.

## Narrow fix

Only the statement order in the admin deletion batch is changed. The audit-log insert now occurs before the existing newsletter/subscription cleanup and before `DELETE FROM users`.

Resulting order:

1. insert the `admin_action_logs` deletion event with the pre-delete snapshot;
2. delete `newsletter_subscriptions` rows for the user;
3. delete `subscriptions` rows for the user;
4. delete the `users` row, causing the 0047 `BEFORE DELETE` trigger to run and redact the audit snapshot created in step 1.

No 0047 trigger SQL is changed by this fix.

## Duplicate application cleanup

Both self-service and admin deletion currently delete `newsletter_subscriptions` and `subscriptions` before deleting the user, while 0047 also deletes those rows. This is an intentional/idempotent duplication in the present code: by the time the trigger executes, those trigger statements are normally no-ops for these two tables. It is recorded here as a Section C application-vs-trigger overlap, not treated as the privacy blocker addressed by this patch.

## Regression guard

`test/backend/user-deletion-migration.test.js` now checks the admin deletion source block and requires `createAdminActionLogStmt(...)` to appear before `DELETE FROM users WHERE id=?`. This is a static ordering regression guard only; it is not a substitute for the separately authorized future staging execution packet.

## Boundary after this fix

This code change closes the identified source-order defect for review purposes, but does **not** authorize a live deletion test by itself.

Still prohibited until separately approved:

- creating or deleting a staging test account;
- executing the 0047 staging deletion packet;
- applying 0047 or any other D1 migration to production;
- resuming D-016 Track B;
- enabling semantic-primary in staging or production.

The next gate remains code review of this narrow patch, followed by preparation/review of the controlled staging test packet including the previously required performance/lock-duration criteria.
