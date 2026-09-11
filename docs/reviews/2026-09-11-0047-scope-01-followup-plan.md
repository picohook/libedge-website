# 0047-SCOPE-01 — Follow-up plan before controlled staging deletion

Status: `PRE-IMPLEMENTATION REVIEW / NO MIGRATION APPLY / NO LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Decision

The newly identified `user_notifications` table is included in the user-deletion privacy policy rather than deferred.

The current 29-table execution packet remains blocked until the policy is amended, independently reviewed, applied to staging under a separate migration authorization, and the execution packet is extended to the resulting 30-table surface.

## Why inclusion is required

`user_notifications` is an active per-user delivery table, not a shared business record. It stores a required `user_id` plus notification title/body content, and the application actively inserts rows into it from the institution send-to-users flow.

The current 0047 trigger has no action for this table. A deleted user could therefore leave behind directly user-linked notification records after every other 0047 assertion passed.

## Migration strategy

Do not mutate `0047_user_deletion_integrity.sql` after it has already been applied to staging.

Prepare a new follow-up migration, expected to be numbered `0049` after a fresh migration-directory check, that replaces/recreates `trg_users_privacy_cleanup` with the reviewed 0047 body plus:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

The exact placement must be reviewed against the final trigger body, but semantically this belongs with other per-account notification/engagement deletion statements.

The migration proposal must be byte-reviewed before any staging apply. No production apply is part of this plan.

## Required read-only prechecks before writing migration SQL

1. Read actual staging `PRAGMA table_info(user_notifications)`.
2. Read actual staging `PRAGMA foreign_key_list(user_notifications)`.
3. Confirm indexes for `user_id` and decide whether an index addition is needed before including the table in deletion performance assertions.
4. Confirm all application read/write paths for `user_notifications`.
5. Confirm there is no intentional retention requirement after account deletion.
6. Re-run the systematic active user-linked table inventory so the amended 30-table policy is not immediately superseded by another known omission.

Any unexpected schema/retention fact returns the finding for review before SQL is prepared.

## Controlled staging packet amendment after migration review

Once the follow-up migration is independently accepted, amend the execution packet as follows:

- surface count: `29 -> 30`;
- schema precheck includes `user_notifications`;
- target fixture includes at least one `user_notifications` row per target user;
- positive assertion: target user's `user_notifications` rows are deleted;
- negative assertion: `U_CONTROL` `user_notifications` rows remain unchanged;
- PRE/POST evidence includes exact row counts for `user_notifications`;
- trigger SQL confirmation must match the accepted follow-up migration, not the original 0047-only trigger;
- execution remains one controlled synthetic run after fresh human confirmation.

## Existing stress fixture

Do not silently change the already reviewed stress pair because of this scope finding.

Current proposed stress fixture remains:

- `25,000 ai_usage_logs`;
- `25,000 notifications`.

If actual staging schema/index evidence shows `user_notifications` is likely to be the dominant accumulating per-user store, changing the stress pair or adding a third stress store requires explicit reviewer approval before execution.

## Timing-threshold sanity check

Cloudflare's current Workers limits documentation states that incoming HTTP Worker requests have no hard wall-clock duration limit while the client remains connected. On paid Workers, CPU time defaults to 30 seconds and can be configured up to 5 minutes; network/database wait time is not counted as CPU time.

Therefore the packet's `2.0 s` ordinary and `5.0 s` stress wall-clock thresholds are not close to a Cloudflare HTTP hard-duration ceiling and are conservative from the platform-runtime perspective.

This does **not** prove the browser/frontend has no shorter application-level timeout. Before execution, the exact caller used for the deletion test must be inspected for an `AbortController`, explicit timeout, proxy timeout, or other client-side limit. If a relevant application timeout is <= the predeclared threshold, STOP and re-review the threshold/test method before execution.

## Authorization boundary

This plan authorizes only read-only schema/code discovery and preparation/review of a follow-up migration proposal.

It does NOT authorize:

- creation of migration 0049 without the required prechecks;
- applying any migration to staging or production;
- creating a staging disposable account;
- seeding fixture rows;
- deleting any staging user;
- resuming D-016 Track B;
- enabling semantic-primary.
