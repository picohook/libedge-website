# 0047 User Deletion Integrity — Dedicated Production Review

Status: `PRE-IMPLEMENTATION REVIEW / NO PRODUCTION APPLY AUTHORIZED`

Date: 2026-09-11

## Purpose

Treat `migrations/0047_user_deletion_integrity.sql` as a separate privacy/integrity production change, not as a routine prerequisite to D-016/0048.

This review exists because 0047 installs a `BEFORE DELETE ON users` trigger that performs broad deletion, anonymization, unlinking and R2 purge-queue creation across many application tables. A migration apply succeeding in staging is not sufficient evidence that the trigger is correct for production.

## Current boundary

- Production D1 migration apply remains prohibited.
- D-016 Track B remains STOPPED.
- 0047 must not be bulk-applied merely to reach 0048.
- No production user-deletion test is authorized by this record.
- Any live staging deletion test requires an explicit disposable test account and a separately reviewed execution procedure.

## Why 0047 is higher risk than 0042-0046

0047 is not only schema-additive. It creates/replaces a database trigger that runs inside the user-row deletion transaction.

If any trigger statement fails because of schema drift, a missing table/column, a constraint-ordering issue or another SQL error, the parent `DELETE FROM users` may fail atomically.

If the trigger succeeds but its policy is incomplete or semantically wrong, residual personal data may remain or business/shared records may be altered incorrectly.

The trigger currently touches authentication/security material, subscriptions, notifications, sharing, support, collections, AI usage, affiliate data, forms, files, announcements and audit logs, and also queues support attachment object references for R2 deletion.

## Evidence already present

The current migration explicitly states that both self-service and admin deletion paths directly delete from `users`, and centralizes cleanup in the trigger to avoid drift.

The repository also contains a Worker-side `purgePrivacyR2Queue` consumer and unit tests for managed ticket-attachment key handling. Those tests demonstrate the queue consumer's behavior, but they do not by themselves prove that a real user deletion fires the trigger correctly across the full schema.

No dedicated end-to-end 0047 trigger execution test is established by this review yet.

## Required review work before any production authorization

### A. Production-equivalent schema compatibility matrix

For every table/column referenced by the trigger:

1. identify the migration/schema source that creates it;
2. confirm expected foreign keys, nullability and delete actions;
3. verify the production migration backlog/state would actually provide the required object before 0047 runs;
4. identify any statement whose behavior differs between legacy and current schemas.

The review must explicitly cover at least:

- `subscriptions`
- `newsletter_subscriptions`
- `user_profile_links`
- `refresh_tokens`
- `password_resets`
- `ra_user_credentials`
- `announcement_reactions`
- `announcement_comments`
- `notifications`
- `share_recipients`
- `user_collection_files`
- `user_collections`
- `file_shares`
- `ticket_replies`
- `support_tickets`
- `product_requests`
- `ai_usage_logs`
- `affiliate_clicks`
- `ra_link_audit_findings`
- `form_submissions`
- `files`
- `collections`
- `collection_files`
- `institution_folders`
- `institution_files`
- `announcements`
- `institution_subscriptions`
- `admin_action_logs`
- `privacy_r2_purge_queue`

Any missing or incompatible table/column is a hard STOP.

### B. Foreign-key and statement-order review

Review the trigger statement order against the real foreign-key graph, including child-before-parent deletes and required nulling before parent deletion.

Do not rely only on the SQL looking reasonable. The result must be checked against the actual schema migrations/current staging schema.

Any unresolved FK ordering ambiguity is a hard STOP.

### C. Application deletion-path comparison

Inspect both current application-level user-deletion paths:

1. self-service account deletion;
2. admin deletion.

For each path, record:

- what it deletes/updates before issuing `DELETE FROM users`;
- what it leaves to database cascades/triggers;
- whether trigger actions duplicate application cleanup;
- whether any duplicated cleanup can fail or produce unintended side effects;
- whether any application-only cleanup is missing from the trigger or vice versa.

The trigger and endpoint logic must form one coherent policy rather than two independently drifting policies.

### D. Staging live deletion evidence, including performance / lock duration

Before production authorization, obtain a real staging execution record using a disposable synthetic test account on a staging schema containing 0047.

The test must seed representative dependent rows across the material trigger domains and then exercise the actual deletion path rather than executing only migration SQL.

The fixture must include both ordinary low-volume rows and a deliberately higher-volume synthetic load in at least two realistically accumulating user-scoped tables. At minimum, the execution packet must include a documented stress-scale fixture for `ai_usage_logs` and `notifications`, or explain with repository/operational evidence why another pair is more representative. The exact row counts must be fixed in the execution packet before the test; they must be large enough to expose obviously pathological trigger behavior rather than only proving one-row correctness.

Minimum success evidence:

- user row deleted successfully;
- auth/security material removed;
- required owned records deleted;
- retained business/shared rows are unlinked/anonymized as designed;
- support ticket attachment URLs are queued before ticket rows disappear;
- audit snapshots are redacted where required;
- no unintended unrelated rows are changed;
- no FK/trigger error aborts the deletion transaction;
- post-delete R2 queue consumer behavior is separately verified for the queued test object;
- end-to-end deletion elapsed time is measured for both the ordinary fixture and the stress-scale fixture;
- no timeout, `SQLITE_BUSY`/lock error, or material concurrent-write degradation is observed during the controlled stress-scale deletion;
- the execution packet defines a maximum acceptable deletion/lock-duration threshold **before** execution, tied to the staging request/runtime budget or an explicitly justified operational SLO; the observed stress-scale result must remain within that predeclared threshold.

A trigger that is logically correct but exceeds the predeclared latency/lock threshold is **not** production-ready.

The exact seeded fixture, expected post-state, stress volumes, concurrency probe (if any), timing measurement method and acceptance threshold must be documented and reviewer-approved before executing the test.

### E. Privacy/retention semantic review

Independently confirm that the intended treatment for each record class is correct:

- delete;
- anonymize/redact;
- unlink while retaining business record;
- retain audit event but remove personal snapshot;
- queue external object deletion.

This is a policy review, not merely a SQL syntax review.

### F. Recovery/rollback model

Because 0047 is behavior-changing and can affect user deletion transactions, the production plan must document recovery before apply.

At minimum:

- how to disable/remove the trigger if deletion failures appear;
- whether removing the trigger alone is safe after partial real deletions have already occurred;
- how to inspect `privacy_r2_purge_queue` safely;
- how to handle a trigger that has executed successfully but later proves semantically incomplete;
- why no destructive rollback will be improvised during an incident.

## Required staging-test invariants

The eventual staging test must include positive, negative and performance/locking checks.

Positive checks:

- all seeded rows that must disappear do disappear;
- all seeded rows that must survive do survive with the expected user linkage removed/redacted;
- queue row creation is exact and limited to managed support attachments.

Negative checks:

- a different user's rows remain untouched;
- unrelated support tickets remain untouched;
- unrelated shared/institutional content remains untouched;
- no unmanaged R2 key is deleted;
- no personally identifying snapshot intended for redaction remains in the seeded audit rows.

Performance/locking checks:

- ordinary and stress-scale deletion elapsed times are recorded;
- the stress-scale deletion remains below the predeclared maximum duration;
- no timeout or lock/busy failure occurs;
- any concurrency probe defined in the execution packet shows no unacceptable blocking of an unrelated staging write.

## Reviewer questions before staging execution

1. Is the schema compatibility matrix complete enough to exercise every trigger statement?
2. Has the FK/order analysis been checked against actual schema definitions rather than comments alone?
3. Are self-service and admin deletion paths fully compared with trigger behavior?
4. Is the proposed staging fixture representative without using real user data?
5. Are expected post-delete states explicit enough to detect both over-deletion and under-deletion?
6. Is the R2 queue/consumer path covered end-to-end?
7. Are privacy/retention semantics reviewed separately from SQL correctness?
8. Is the stress-scale fixture realistic enough to expose performance/locking problems, and are timing/lock acceptance thresholds fixed before execution?
9. Is recovery defined before any production apply request?
10. Does any unresolved point require 0047 to remain STOPPED?

## Decision boundary

Acceptance of this document would authorize only deeper read-only code/schema analysis and preparation of a controlled staging test packet.

It would NOT authorize:

- applying 0047 to production;
- applying any other production D1 migration;
- creating/deleting a staging test account without the separate execution packet;
- resuming D-016 Track B;
- enabling semantic-primary in production or staging.
