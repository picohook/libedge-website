# 0047 User Deletion Integrity — Controlled Staging Deletion Packet

Status: `PRE-EXECUTION REVIEW ONLY / NO LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Purpose

Prepare exactly one tightly controlled staging execution that proves the complete user-deletion privacy policy behaves correctly under the real admin and self-service deletion paths after the accepted 0047 source-order fix and the accepted 0049 trigger correction.

This packet authorizes nothing by itself. No disposable account, fixture, destructive deletion, production migration, semantic-primary change, or D-016 Track B resumption is authorized until this packet receives a fresh independent ACCEPTED decision.

## Preconditions now established

1. `0047-PRIVACY-01` source-order defect was fixed and merged to staging through PR #37.
2. Admin deletion now writes its audit event before `DELETE FROM users`, allowing the DB trigger to redact that audit snapshot inside the same transaction.
3. `0047-SCOPE-01` identified `user_notifications` as a live per-user table not protected by a live FK cascade.
4. Forward migration `0049_user_notifications_deletion_policy.sql` was independently reviewed, merged, and applied once to remote staging under locked pre/post guardrails.
5. Controlled apply run `34606916660` completed successfully.
6. Live post-apply trigger `trg_users_privacy_cleanup` semantically matches reviewed 0049 and explicitly contains `DELETE FROM user_notifications WHERE user_id = OLD.id;`.
7. 0049 did not rebuild or otherwise alter `user_notifications`; live FK state remains absent and the two expected indexes remain present.
8. No staging deletion behavior has yet been claimed as proven.
9. No production migration is authorized. D-016 Track B remains STOPPED.

## Execution boundary

If this packet is later ACCEPTED, it authorizes exactly one controlled staging execution using synthetic disposable data and only after all fresh read-only prechecks pass.

It does NOT authorize production migration apply, production user deletion, semantic-primary enablement, D-016 Track B resumption, use of real user data, or repeated retries after any STOP condition without fresh review.

## A. Fresh staging precheck — mandatory before any write

Before creating any fixture:

1. confirm staging target/binding only;
2. confirm migration 0049 is applied and no unexpected migration is pending;
3. read live `trg_users_privacy_cleanup` from `sqlite_master`;
4. confirm the live trigger semantically matches reviewed migration 0049;
5. confirm all 30 deletion-policy domains still exist with expected columns;
6. confirm `privacy_r2_purge_queue` exists;
7. confirm live `user_notifications` remains FK-less and retains `idx_user_notifications_user` and `idx_user_notifications_type`;
8. confirm material live FK assumptions used by the packet still hold, including `notifications.user_id -> users.id ON DELETE CASCADE` and `ai_usage_logs.user_id -> users.id ON DELETE SET NULL`;
9. confirm deployed staging backend contains the merged admin audit-order fix;
10. confirm no real-user data will be used.

Any material discrepancy is a hard STOP before fixture creation.

## B. Synthetic identities

Create only synthetic staging identities:

- `U_TARGET_ADMIN` — disposable target deleted through the admin endpoint;
- `U_TARGET_SELF` — disposable target deleted through the self-service endpoint;
- `U_CONTROL` — independent synthetic control whose records must survive;
- an already-authorized staging super-admin/operator account only as the actor for the admin endpoint, if required.

Synthetic values must be obvious test data such as `0047-test-*`. No real person, institution, production identifier, or real support attachment may be used.

## C. Fixture plan — 30 deletion-policy domains

### C1. Target-owned rows expected to be deleted

Seed representative target data in:

- `subscriptions`
- `newsletter_subscriptions`
- `user_profile_links`
- `refresh_tokens`
- `password_resets`
- `ra_user_credentials`
- `announcement_reactions`
- target-owned `announcement_comments`
- `notifications`
- `user_notifications` — expected deletion mechanism: explicit 0049 trigger statement
- target-recipient `share_recipients`
- personal `user_collections`
- corresponding `user_collection_files`
- target-owned `file_shares`
- recipients of those target-owned shares
- `support_tickets`
- replies on target-owned tickets
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
- another user's `announcement_comments.deleted_by` pointing to target — survive with `deleted_by = NULL`;
- `admin_action_logs` where target is actor — survive with `actor_user_id = NULL`;
- `admin_action_logs` where target user is entity — survive with `before_json = NULL` and `after_json = NULL`;
- support-ticket audit snapshots for target-owned tickets — survive with required snapshots redacted.

### C3. R2 purge-queue fixture

Seed at least one synthetic target-owned support reply with a managed `ticket-attachments/...` URL expected to be queued, one unrelated control user's managed attachment that must not be queued, and one unmanaged/unexpected URL case to prove the consumer boundary without deleting unmanaged data.

No real R2 object may be used.

### C4. Negative-control mirror

For `U_CONTROL`, seed a minimal mirror across every material deletion-policy domain, including `user_notifications` and representative rows across the 29 other trigger-touched classes where practical.

Control and unrelated rows must remain unchanged after each target deletion except where the fixture itself explicitly creates a shared relationship designed to change.

## D. Predeclared stress fixture

For `U_TARGET_ADMIN`, seed exactly:

- `25,000` `ai_usage_logs` rows;
- `25,000` `notifications` rows.

These counts are fixed before execution and may not be changed after results are observed without a new review.

## E. Predeclared performance / locking thresholds

Ordinary deletion must complete in `<= 2.0 s`; stress admin deletion in `<= 5.0 s`; a harmless unrelated-write concurrency probe during stress deletion must complete in `<= 2.0 s`. None may produce timeout, `SQLITE_BUSY`, FK, trigger, transaction, or lock errors.

If a safe unrelated-write probe cannot be executed using existing application behavior, STOP and return for review rather than inventing a new write path.

## F. Admin execution order

For `U_TARGET_ADMIN`:

1. complete fresh precheck;
2. create synthetic target/control identities;
3. seed ordinary fixture and exact stress rows;
4. capture PRE counts/null-state fields across all 30 domains;
5. capture exact expected purge-queue delta;
6. start timing;
7. invoke real authenticated `DELETE /api/admin/user/:id`;
8. run the predeclared unrelated-write probe during the stress deletion;
9. stop timing at HTTP completion;
10. capture POST state;
11. perform no cleanup until all assertions/evidence are recorded.

Any non-2xx response is an immediate STOP.

## G. Self-service execution order

For `U_TARGET_SELF`:

1. seed an ordinary representative fixture covering the common trigger path and `user_notifications`;
2. capture PRE state;
3. invoke real authenticated `DELETE /api/user/delete` as the disposable account;
4. measure elapsed time;
5. capture POST state;
6. verify session/cookie cleanup only to the extent required by the existing endpoint contract;
7. do not infer admin behavior from this test or vice versa.

No stress-scale self-service run is required unless separately requested by reviewer.

## H. Mandatory positive assertions

For each target deletion, prove mechanically that:

1. target `users` row is gone;
2. auth/security material is removed;
3. every DELETE-class row is gone;
4. target `user_notifications` rows are gone under the explicit 0049 trigger policy;
5. every RETAIN+UNLINK row survives with expected user link cleared;
6. every REDACT row survives with required PII/free-text fields cleared;
7. target `ai_usage_logs` rows are deleted, not merely nulled;
8. target-owned support tickets/replies are removed as designed;
9. target-authored reply on another user's ticket survives with `user_id = NULL`;
10. target user deletion audit event survives but has `before_json IS NULL` and `after_json IS NULL`;
11. pre-existing target-user audit snapshots are redacted;
12. actor linkage is cleared where target was an audit actor;
13. expected managed support attachment URL is inserted into `privacy_r2_purge_queue` exactly once;
14. any separately authorized R2 consumer step acts only on the synthetic managed object.

## I. Mandatory negative assertions

After each deletion, prove mechanically that `U_CONTROL` still exists, all control/auth/subscription/notification/user_notification/AI/support/share/file/announcement/audit rows remain as expected, no unrelated attachment is queued, no unmanaged R2 key is deleted, and no row-count delta occurs outside the explicitly expected target surface.

Any unexpected change to another user's data is a hard STOP and privacy/integrity failure.

## J. 0047-PRIVACY-01 live closure criterion

The admin-path test must locate the deletion audit row created by the endpoint and prove:

- `action = 'delete'`;
- `entity_type = 'user'`;
- `entity_id` remains the deleted synthetic user's id;
- `before_json IS NULL`;
- `after_json IS NULL`.

The static regression guard is not sufficient.

## K. 0047-SCOPE-01 live closure criterion

For both synthetic deletion paths, mechanically prove:

- PRE: target has at least one `user_notifications` row;
- POST: zero `user_notifications` rows remain for deleted target;
- control user's `user_notifications` rows remain unchanged;
- live trigger used for the execution still contains `DELETE FROM user_notifications WHERE user_id = OLD.id;`.

This is the behavioral closure criterion for `0047-SCOPE-01`.

## L. R2 boundary

No R2 deletion occurs before DB assertions prove the queue row is correct. If DB deletion succeeds but an authorized synthetic R2 purge consumer fails, preserve the queue/error state as evidence and do not mark the full flow PASS until separately dispositioned.

## M. STOP conditions

Immediately stop and perform no further target deletions if any of the following occurs:

- live staging migration/trigger/schema differs materially from reviewed assumptions;
- 0049 is not applied or live trigger differs from reviewed 0049;
- any target deletion returns non-2xx;
- any FK/constraint/trigger/transaction error;
- `SQLITE_BUSY` or lock error;
- ordinary deletion exceeds `2.0 s`;
- stress deletion exceeds `5.0 s`;
- unrelated-write probe exceeds `2.0 s` or fails;
- any expected delete/redact/unlink assertion fails;
- target `user_notifications` rows remain;
- any control/unrelated row is unexpectedly changed;
- admin deletion audit snapshot retains PII;
- unexpected purge-queue row is created;
- unmanaged R2 data is targeted;
- evidence becomes incomplete or ambiguous.

No automatic retry is authorized after a STOP.

## N. Recovery model

If fixture seeding fails before deletion, stop and remove only clearly identified synthetic fixture in a separately documented cleanup step. If deletion fails atomically, preserve evidence and verify whether the user still exists. If deletion succeeds but POST state is wrong, preserve that state and treat it as privacy/integrity failure. Do not reconstruct data simply to obtain a PASS. No ad hoc `DROP TRIGGER`, manual rollback, or forward correction is authorized by this packet.

Cleanup after a full PASS may remove only synthetic residual/control fixtures and must occur after evidence capture.

## O. Evidence required for PASS

Record exact staging commit/deployed backend version; staging migration state showing 0049 applied; live trigger SQL and normalized match to reviewed 0049; live `user_notifications` table/FK/index state; synthetic fixture identifiers; exact seeded row counts by domain; PRE/POST counts and null-state assertions across all 30 domains; exact stress counts; ordinary/stress elapsed times; unrelated-write probe result; HTTP statuses; explicit `user_notifications` target deletion and control preservation proof; 0047-PRIVACY-01 audit-row redaction proof; purge-queue exact delta; any authorized synthetic R2 consumer result; explicit statement that no real user data was used; and explicit PASS/STOP classification with no silent retry.

## P. Reviewer questions

1. Is the 30-domain fixture now correctly aligned with the live 0049 trigger rather than the disproven FK-cascade assumption?
2. Are DELETE / RETAIN+UNLINK / REDACT expectations sufficiently explicit?
3. Are the `25,000 ai_usage_logs + 25,000 notifications` stress counts appropriate and fixed before execution?
4. Are the `2.0 s` ordinary, `5.0 s` stress, and `2.0 s` unrelated-write thresholds appropriate?
5. Is the negative-control plan sufficient to detect over-deletion?
6. Does the admin audit assertion adequately prove `0047-PRIVACY-01` behaviorally?
7. Does the explicit `user_notifications` assertion adequately prove `0047-SCOPE-01` behaviorally?
8. Is the R2 boundary safe and sufficiently separated from DB deletion evidence?
9. Are STOP/recovery rules complete?
10. If accepted, may exactly ONE controlled synthetic staging execution be performed under this packet, only after fresh human confirmation that the staging window contains controlled test traffic only?

## Required classification

Return exactly one: `ACCEPTED`, `ACCEPTED WITH MODIFICATION`, or `REJECTED`.

Also report any material `OUT-OF-SCOPE FINDING`.

## Decision boundary

An `ACCEPTED` decision authorizes only the one controlled synthetic staging execution defined here, after fresh human traffic-isolation confirmation.

It does NOT authorize production migration, production deletion, repeated retries after a STOP, D-016 Track B resumption, semantic-primary enablement, H/RRF/Vectorize, or use of real user data.
