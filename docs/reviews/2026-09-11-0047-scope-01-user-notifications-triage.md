# 0047-SCOPE-01 — `user_notifications` deletion-scope gap

Status: `OPEN / INCLUDE IN DELETION POLICY / BLOCKS STAGING EXECUTION`

Date: 2026-09-11

## Finding

The controlled 0047 staging-deletion packet accurately covers all 29 tables currently touched by `trg_users_privacy_cleanup`, but a systematic review of user-linked runtime-DDL tables identified one active user-scoped table that the trigger does not touch: `user_notifications`.

Current application code can create `user_notifications` with a required `user_id INTEGER NOT NULL`, and the institution send-to-users path actively inserts rows containing notification title/body content for specific users.

The existing 0047 trigger covers the separate `notifications` table but contains no delete, unlink, or redact action for `user_notifications`.

Therefore a successful test of the current 29-table trigger would establish that the trigger behaves as written, but would not establish that account deletion is privacy-complete across the current application's active user-linked data surface.

## Independent evidence already established

The current staging application source contains runtime-DDL for `user_notifications` and active inserts into that table from the institution send-to-users flow.

The table has a direct required user link (`user_id`) and notification content fields. It is distinct from the `notifications` table already covered by 0047.

The reviewer's systematic runtime-DDL scan found this to be an isolated uncovered active user-linked table rather than a broad pattern of omissions.

## Triage decision

`user_notifications` is **not deferred as intentionally out of scope**.

It must be included in the user-deletion privacy policy before the controlled staging deletion execution can proceed.

Reasoning:

1. the table is actively written by application code;
2. it directly identifies a user through `user_id`;
3. its notification content can contain user-specific operational information;
4. there is no FK/cascade policy that can be relied on from the runtime-created schema;
5. knowingly leaving it behind would contradict the stated goal of 0047: central privacy/integrity cleanup for `users` deletion;
6. running the current packet first would produce evidence about an already-known incomplete policy and would likely force a second destructive staging execution after the scope fix.

## Migration-history rule

Do **not** rewrite the already-applied `0047_user_deletion_integrity.sql` migration in place merely to add this table.

Staging has already applied 0047, and migration history should remain immutable/auditable. The scope correction must be proposed as a new follow-up migration that replaces/recreates `trg_users_privacy_cleanup` with the reviewed 0047 policy plus the explicit `user_notifications` cleanup.

Because `0048_research_telemetry_counters.sql` already exists, the natural next migration identifier is `0049`, subject to fresh repository-state verification before creation.

No 0049 SQL is authorized by this triage record itself.

## Intended policy for `user_notifications`

Proposed semantic disposition: `DELETE` rows belonging to the deleted account.

Expected trigger action:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

This is a proposal for review, not yet an applied migration.

Rationale: these are per-user delivery records rather than shared institutional records that need to survive user deletion. Retaining them while merely unlinking would require inventing a new retention policy and schema behavior that does not currently exist.

## Required follow-up before any staging deletion

1. Confirm the actual staging `user_notifications` schema read-only, including columns/indexes and whether any FK/delete action exists.
2. Confirm the current application write/read paths and whether any retention requirement exists.
3. Prepare a follow-up trigger-replacement migration proposal without mutating 0047 history.
4. Extend the controlled staging deletion packet from 29 to 30 covered table classes.
5. Add target-row positive assertion: target `user_notifications` rows are deleted.
6. Add control negative assertion: `U_CONTROL` `user_notifications` rows are unchanged.
7. Reconfirm the complete active user-linked table surface after the amendment.
8. Independently review the follow-up migration and amended execution packet.
9. Only after acceptance, apply the follow-up migration to staging under a separately authorized migration step.
10. Obtain fresh schema/trigger evidence before any synthetic fixture creation or deletion.

## Performance note

The existing stress pair remains `ai_usage_logs` + `notifications` unless new evidence shows `user_notifications` is a more representative high-volume store. The newly identified scope item does not by itself justify changing the predeclared stress volumes after review; any such change requires explicit re-review.

The reviewer also requested confirmation that the existing `2.0 s / 5.0 s / 2.0 s` thresholds leave comfortable margin relative to actual Worker/request timeout behavior. That confirmation remains a pre-execution planning item and is not treated as resolved by this scope triage.

## Execution effect

The previously prepared controlled staging deletion packet is now **BLOCKED BEFORE EXECUTION** by `0047-SCOPE-01`.

No synthetic account may be created, no fixture may be seeded, and no deletion may be run under the current 29-table trigger.

## Production / D-016 boundary

Unchanged:

- no production migration is authorized;
- production 0042-0048 backlog remains STOPPED;
- D-016 Track B remains STOPPED;
- semantic-primary remains OFF;
- this finding is outside D-016 and must not be used to bypass the production migration audit.
