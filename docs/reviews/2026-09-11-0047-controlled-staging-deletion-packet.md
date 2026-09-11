# 0047 User Deletion Integrity — Controlled Staging Deletion Packet

Status: `PRE-EXECUTION RE-REVIEW ONLY / NO LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Purpose

Prepare one tightly controlled staging execution that can prove the complete user-deletion privacy policy behaves correctly under the actual application deletion paths, including migration-0047 trigger behavior, schema-level FK cascades, privacy semantics, cross-table integrity, R2 purge-queue creation, negative isolation checks, and performance/locking behavior.

This packet authorizes nothing by itself. It is a plan for independent review before any disposable account is created, any fixture is seeded, or any deletion is executed.

## Preconditions already established

1. `0047-PRIVACY-01` source-order defect was fixed and merged to `staging` through PR #37.
2. The admin deletion audit event is now inserted before `DELETE FROM users`, so the unchanged 0047 `BEFORE DELETE` trigger can redact `before_json` / `after_json` in the same transaction.
3. CI for the reviewed fix passed (`23/23` files, `99/99` tests).
4. Read-only schema/code analysis mapped all 29 tables explicitly touched by the 0047 trigger.
5. Follow-up scope analysis identified `user_notifications` as a 30th deletion-policy domain. Canonical migration `0008_user_notifications.sql` defines `user_id -> users(id) ON DELETE CASCADE` plus `idx_user_notifications_user(user_id, is_read)`.
6. The runtime-DDL fallback omits this FK, but runtime DDL is disabled in strict staging/production environments; therefore fresh live staging FK confirmation is mandatory before any write.
7. No staging deletion behavior has yet been claimed as proven.
8. No production migration is authorized. D-016 Track B remains STOPPED.

## Execution boundary

If this packet is later ACCEPTED, it authorizes exactly one controlled staging test sequence using synthetic disposable data, and only after the live read-only schema precheck succeeds.

It does NOT authorize:

- production migration apply;
- production user deletion;
- semantic-primary enablement;
- D-016 Track B resumption;
- use of real user data;
- repeated retries after any STOP condition without fresh review.

## A. Fresh staging schema confirmation — mandatory before any write

Before creating any fixture, obtain a read-only staging schema inventory and verify:

1. migration 0047 is present/applied in staging;
2. trigger `trg_users_privacy_cleanup` exists and its SQL matches the reviewed migration;
3. all 29 trigger-referenced tables/columns exist;
4. `privacy_r2_purge_queue` exists with the reviewed schema;
5. relevant FK actions for the trigger-sensitive tables match the repository matrix;
6. `user_notifications` exists with the canonical migration-0008 columns;
7. `PRAGMA foreign_key_list(user_notifications)` shows `user_id -> users(id)` with `ON DELETE CASCADE`;
8. `idx_user_notifications_user` exists with `user_id` as the leading column;
9. no unexpected schema divergence is discovered.

Required evidence should include read-only outputs equivalent to:

- applied/pending staging migration list;
- `sqlite_master` row for `trg_users_privacy_cleanup`;
- `PRAGMA table_info(...)` and `PRAGMA foreign_key_list(...)` for material FK-sensitive tables;
- `PRAGMA table_info(user_notifications)`;
- `PRAGMA foreign_key_list(user_notifications)`;
- `PRAGMA index_list(user_notifications)` and index-column detail as needed.

If the live `user_notifications` cascade differs from migration 0008, this packet is a hard STOP before fixture creation. No 0049 or other repair migration may be invented during execution.

## B. Synthetic identities

Use only synthetic staging identities created specifically for this packet.

Create:

- `U_TARGET_ADMIN` — disposable target account to be deleted through the admin endpoint;
- `U_TARGET_SELF` — disposable target account to be deleted through the self-service endpoint;
- `U_CONTROL` — separate synthetic control user whose records must remain untouched;
- an existing authorized staging super-admin/operator account to invoke the admin path, if required by the current endpoint contract.

No real user account may be used as a target or control fixture.

Synthetic profile values must be obvious test data (for example `0047-test-*`) and must contain no real person names, real institutions, or production identifiers.

## C. Fixture plan — 30 deletion-policy domains

The packet must seed representative data so every 0047 trigger statement is exercised at least once and the additional schema-level `user_notifications` cascade is also proven.

### C1. Target-owned rows expected to be deleted

For each target user, seed rows in:

- `subscriptions`
- `newsletter_subscriptions`
- `user_profile_links`
- `refresh_tokens`
- `password_resets`
- `ra_user_credentials`
- `announcement_reactions`
- target-owned `announcement_comments`
- `notifications`
- `user_notifications` — expected deletion mechanism: confirmed FK `ON DELETE CASCADE`, not an explicit 0047 statement
- target-recipient `share_recipients`
- personal `user_collections`
- corresponding `user_collection_files`
- target-owned `file_shares`
- recipients of those target-owned shares
- `support_tickets`
- ticket replies on the target user's own tickets
- `ai_usage_logs`
- `ra_link_audit_findings`

### C2. Rows expected to survive but be unlinked/redacted

Seed target-linked rows in:

- `product_requests` — survive with `user_id = NULL`;
- reply authored by target on another user's support ticket — survive with `user_id = NULL`;
- `affiliate_clicks` — survive with `user_id`, `referer`, `user_agent` cleared;
- `form_submissions` — survive with direct identifiers/free text cleared;
- `files` — survive with `uploaded_by = NULL`;
- `collections` — survive with `created_by = NULL`;
- `collection_files` — survive with `added_by = NULL`;
- `institution_folders` — survive with `created_by = NULL`;
- `institution_files` — survive with `uploaded_by = NULL`;
- `announcements` — survive with `created_by = NULL`;
- `institution_subscriptions` — survive with `created_by = NULL`;
- `announcement_comments.deleted_by` on another user's comment — survive with `deleted_by = NULL`;
- `admin_action_logs` where target is actor — survive with `actor_user_id = NULL`;
- `admin_action_logs` where target user is entity — survive as audit event with `before_json = NULL` and `after_json = NULL`;
- support-ticket audit snapshots for target-owned tickets — survive with snapshots redacted where required.

### C3. R2 purge queue fixture

Seed at least:

- one target-owned support ticket reply with a managed `ticket-attachments/...` URL expected to be queued;
- one unrelated control user's managed attachment that must not be queued by target deletion;
- one non-managed/unexpected URL case sufficient to verify the queue consumer's managed-key boundary without deleting unmanaged data.

No real production R2 object may be used.

### C4. Negative-control mirror

For `U_CONTROL`, seed a minimal mirror across every material deletion-policy domain, including a `user_notifications` row and at least one row in each of the 29 trigger-table classes where practical.

The control user's rows and unrelated shared/business records must remain unchanged after each target deletion, except for changes explicitly caused by the test fixture design itself.

## D. Predeclared stress fixture

Performance evidence must be fixed before execution.

For `U_TARGET_ADMIN` stress-scale deletion, seed exactly:

- `25,000` `ai_usage_logs` rows;
- `25,000` `notifications` rows.

These are in addition to the ordinary representative fixture rows above.

The canonical `user_notifications` schema already has a user-leading index, so this scope amendment does not change the reviewed stress pair.

If the reviewer considers the stress volumes too small or operationally excessive, the counts must be modified and re-reviewed before execution. They must not be changed after results are observed.

## E. Predeclared performance / locking thresholds

The following thresholds are fixed before execution:

### Ordinary fixture

- end-to-end deletion request elapsed time: `<= 2.0 s`;
- no timeout;
- no `SQLITE_BUSY`, lock, transaction, or FK error.

### Stress fixture

- end-to-end admin deletion request elapsed time: `<= 5.0 s`;
- no timeout;
- no `SQLITE_BUSY`, lock, transaction, or FK error.

### Unrelated-write concurrency probe

During the stress deletion only, issue one harmless unrelated staging write against `U_CONTROL` or another dedicated synthetic control record that does not target the same user rows.

Success criteria:

- unrelated write succeeds;
- unrelated write elapsed time `<= 2.0 s`;
- no busy/lock error;
- no evidence of a prolonged database-wide write stall.

If the runtime/API contract makes a safe unrelated-write probe impossible without introducing new application behavior, STOP and return for review rather than inventing a new probe during execution.

## F. Execution order — admin path

For `U_TARGET_ADMIN`:

1. complete fresh schema confirmation, including `user_notifications` cascade/index evidence;
2. create synthetic target/control identities;
3. seed ordinary fixture + exact stress rows;
4. capture PRE counts and redaction fields for all 30 deletion-policy domains;
5. capture exact expected `privacy_r2_purge_queue` delta;
6. begin timing;
7. invoke the real authenticated admin deletion endpoint `DELETE /api/admin/user/:id`;
8. run the predeclared unrelated-write concurrency probe during the stress deletion;
9. stop timing at HTTP completion;
10. capture POST state;
11. do not run any cleanup that could hide a failing assertion until all evidence is recorded.

A non-2xx deletion response is an immediate STOP.

## G. Execution order — self-service path

For `U_TARGET_SELF`:

1. seed an ordinary representative fixture covering the common trigger path plus `user_notifications` cascade;
2. capture PRE state;
3. invoke the real authenticated self-service endpoint `DELETE /api/user/delete` as the disposable account;
4. measure end-to-end elapsed time;
5. capture POST state;
6. verify cookie/session cleanup behavior only to the extent required by the existing endpoint contract;
7. do not infer admin-path behavior from this test or vice versa.

No stress-scale self-service run is required unless the reviewer specifically requests one.

## H. Mandatory positive assertions

For each target deletion, prove mechanically that:

1. target `users` row is gone;
2. auth/security material is removed;
3. all rows designated DELETE are gone;
4. target `user_notifications` rows are gone under the independently confirmed FK cascade;
5. all rows designated RETAIN+UNLINK survive with expected user link cleared;
6. all rows designated REDACT survive with required PII/free-text fields null;
7. `ai_usage_logs` target rows are deleted rather than nulled;
8. target-owned support ticket/reply rows are removed as designed;
9. target-authored reply on another user's ticket survives with `user_id = NULL`;
10. target user deletion audit event survives but `before_json` and `after_json` are NULL;
11. pre-existing target-user audit snapshots are redacted;
12. actor linkage is cleared where the deleted user was an audit actor;
13. exact expected managed support attachment URL is inserted into `privacy_r2_purge_queue` once;
14. R2 queue consumer removes only the synthetic managed ticket attachment when that consumer step is separately invoked within the approved test sequence.

## I. Mandatory negative assertions

After each deletion, prove mechanically that:

1. `U_CONTROL` still exists;
2. control auth/security rows remain;
3. control subscriptions/newsletter/profile rows remain;
4. control `notifications`, `user_notifications`, AI usage, reactions and comments remain;
5. unrelated support tickets/replies remain;
6. unrelated shares/collections/files remain;
7. unrelated shared/institutional content remains unchanged;
8. unrelated announcements/institution subscriptions remain unchanged;
9. unrelated admin audit snapshots remain unchanged;
10. no control attachment is added to the purge queue;
11. no unmanaged R2 key is deleted;
12. no row-count delta outside the explicitly expected target surface is observed.

Any unexpected change to another user's data is a hard STOP and privacy/integrity failure.

## J. 0047-PRIVACY-01 specific assertion

The admin-path test must explicitly locate the deletion audit row created by the endpoint and prove:

- `action = 'delete'` is retained;
- `entity_type = 'user'` is retained;
- `entity_id` remains the deleted synthetic user's id;
- `before_json IS NULL`;
- `after_json IS NULL`.

This assertion is the live behavioral closure criterion for `0047-PRIVACY-01`.

The static regression guard is not sufficient for this criterion.

## K. R2 recovery boundary

No R2 deletion may occur before DB assertions prove the queue row is correct.

If DB deletion succeeds but the R2 purge consumer fails:

- do not retry destructively without recording the failure;
- retain the queue row/error state as evidence;
- do not mark the overall privacy flow PASS until the managed synthetic object is either purged successfully or the failure is independently dispositioned.

## L. STOP conditions

Immediately stop the test sequence and perform no further target deletions if any of the following occurs:

- staging schema differs materially from the reviewed assumptions;
- migration/trigger is missing or different;
- `user_notifications` live FK/index evidence does not match canonical migration 0008;
- any target deletion returns non-2xx;
- any FK/constraint/trigger/transaction error occurs;
- `SQLITE_BUSY` or lock error occurs;
- ordinary deletion exceeds `2.0 s`;
- stress deletion exceeds `5.0 s`;
- unrelated-write probe exceeds `2.0 s` or fails;
- any expected delete/redaction/unlink assertion fails;
- target `user_notifications` rows remain after parent deletion;
- any control/unrelated row is unexpectedly changed;
- admin deletion audit snapshot retains PII;
- unexpected purge-queue row is created;
- unmanaged R2 data is targeted;
- evidence collection becomes incomplete or ambiguous.

After a STOP, no automatic retry is authorized.

## M. Recovery / rollback plan

### If fixture seeding fails before any deletion

- stop;
- remove only the clearly identified synthetic fixture in a separately documented cleanup step;
- do not alter the trigger or FK merely to force the test forward.

### If deletion transaction fails atomically

- preserve error/output evidence;
- verify whether the target user row still exists;
- do not improvise trigger/FK edits in staging;
- return for code/schema review.

### If deletion succeeds but post-state is semantically wrong

- treat as privacy/integrity failure;
- preserve the exact POST state;
- do not attempt to reconstruct deleted synthetic rows merely to make the test pass;
- prepare a reviewed schema/trigger/application fix before any new deletion attempt.

### If trigger itself must later be disabled

Production recovery is not authorized by this packet. Any `DROP TRIGGER` or replacement migration requires a separately reviewed migration/recovery decision.

### Cleanup after a full PASS

Only synthetic residual/control fixtures may be removed. Cleanup must be distinguishable from assertions and must not erase the PASS evidence record.

## N. Evidence record required for PASS

The execution record must contain:

- exact staging commit / deployed backend version;
- staging migration state and trigger SQL confirmation;
- live `user_notifications` table/FK/index evidence;
- synthetic fixture identifiers in non-sensitive test form;
- exact seeded row counts by domain;
- PRE and POST row counts / null-state assertions across all 30 deletion-policy domains;
- exact stress counts (`25,000 + 25,000` unless re-reviewed beforehand);
- ordinary and stress elapsed times;
- unrelated-write probe result/time;
- deletion HTTP statuses;
- `user_notifications` cascade deletion proof plus control-row non-deletion proof;
- 0047-PRIVACY-01 audit-row redaction proof;
- purge-queue exact delta;
- R2 consumer result for the synthetic managed object;
- control-user negative assertions;
- explicit statement that no real user data was used;
- explicit PASS/STOP classification with no silent retry.

## O. Reviewer questions

1. Is the fixture broad enough to exercise all 29 trigger-touched classes plus the `user_notifications` FK-cascade domain and both application deletion paths?
2. Is treating `user_notifications` as a schema-cascade domain correct, conditional on fresh live staging FK evidence?
3. Are DELETE / RETAIN+UNLINK / REDACT expectations sufficiently explicit?
4. Are the `25,000 ai_usage_logs + 25,000 notifications` stress counts appropriate and fixed before execution?
5. Are the `2.0 s` ordinary, `5.0 s` stress, and `2.0 s` unrelated-write thresholds conservative enough and operationally meaningful?
6. Is the negative-control plan sufficient to detect over-deletion, including `U_CONTROL.user_notifications`?
7. Does the admin-specific audit assertion adequately prove the merged 0047-PRIVACY-01 fix works live?
8. Is the R2 queue/consumer boundary safe and specific enough?
9. Are STOP/recovery conditions complete enough to prevent repeated/destructive experimentation?
10. If accepted, may exactly one controlled staging execution be performed only after the live read-only schema precheck passes and fresh human traffic-isolation confirmation is supplied?

## Decision boundary

Reviewer classification must be one of:

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

`ACCEPTED` authorizes only the single controlled synthetic staging execution described here, and only after both:

1. fresh live read-only staging schema confirmation succeeds; and
2. a fresh human confirmation states that the staging window contains controlled test activity.

It does not authorize any production migration or deployment decision.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `0047-CONTROLLED-STAGING-DELETION-2026-09-11-R2`

Branch/ref: `staging`

RAW MATERIALS

[x] This amended controlled staging deletion packet is present in the repository.
[x] `docs/reviews/2026-09-11-0047-user-deletion-integrity-production-review.md` is accessible.
[x] `docs/reviews/2026-09-11-0047-read-only-schema-code-analysis.md` is accessible.
[x] `docs/reviews/2026-09-11-0047-privacy-01-fix-review.md` is accessible after PR #37 merge.
[x] `docs/reviews/2026-09-11-0047-scope-01-read-only-discovery.md` is accessible.
[x] `migrations/0008_user_notifications.sql` is accessible.
[x] `migrations/0047_user_deletion_integrity.sql` is accessible.
[x] PR #37 / merge history is accessible for the source-order fix.

CONSISTENCY

[x] No live staging deletion is claimed.
[x] No staging disposable account is claimed to have been created.
[x] No production migration is claimed or authorized.
[x] No 0049 migration is claimed necessary without live staging schema divergence.
[x] Implementer summary is subordinate to raw material.
[x] Reviewer is instructed to inspect fresh contents and may report OUT-OF-SCOPE FINDING items.

RESULT: COMPLETE
