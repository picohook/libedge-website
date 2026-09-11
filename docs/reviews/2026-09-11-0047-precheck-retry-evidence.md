# 0047 — Corrected Staging Precheck Retry Evidence

Date: 2026-09-11
Status: `READ-ONLY PRECHECK PASS / NO FIXTURE OR DELETION EXECUTED`

## Context

The first controlled staging schema precheck stopped before any write because its required-object loop contained the nonexistent table name `support_ticket_replies` instead of the real table `ticket_replies`.

No account was created, no fixture was seeded, and no user deletion was executed in that failed run.

The temporary failed workflow was removed before the corrected retry was prepared.

## Requested correction verification

Original precheck commit:

`bcfadf042cafe4d111c190c0d388b63884b8466d`

Corrected precheck commit:

`b8bee5bee1f0eebb89f3c12ad6c1765e50591af1`

GitHub compare result between those two commits:

- exactly one file differs: `.github/workflows/0047-deletion-precheck.yml`;
- additions: `1`;
- deletions: `1`;
- the only substantive replacement is:

```diff
- support_ticket_replies
+ ticket_replies
```

No other precheck logic was changed.

## Repository-name cross-check

Repository code search for:

`support_ticket_replies`

returned no results.

Canonical support migration:

`migrations/0004_support_tickets.sql`

creates:

```sql
CREATE TABLE IF NOT EXISTS ticket_replies (...);
```

The reviewed 0047/0049 trigger also uses `ticket_replies`.

Therefore the failed identifier was a test-harness typo, not a live schema/privacy defect.

## Corrected read-only retry

Workflow run:

`34620472197`

Head SHA:

`b8bee5bee1f0eebb89f3c12ad6c1765e50591af1`

Result:

`SUCCESS`

Job:

`precheck`

All material steps passed:

1. dependency setup — PASS;
2. staging migration state — PASS (`No migrations to apply`);
3. live trigger and `user_notifications` schema read — PASS;
4. 0049 trigger statement and required-object inventory — PASS;
5. terminal marker — `PRECHECK_PASS`.

## Live read-only facts re-confirmed

The retry re-confirmed against remote staging D1:

- target database: `libedge-db` / staging remote;
- no pending staging migrations;
- `trg_users_privacy_cleanup` exists;
- trigger remains `BEFORE DELETE ON users`;
- trigger contains:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

- `user_notifications` remains FK-less;
- `idx_user_notifications_user` remains present and begins with `user_id`;
- `idx_user_notifications_type` remains present.

## Required-object result

The corrected loop checked all 30 required table objects and completed successfully:

1. subscriptions
2. newsletter_subscriptions
3. user_profile_links
4. refresh_tokens
5. password_resets
6. ra_user_credentials
7. announcement_reactions
8. announcement_comments
9. notifications
10. user_notifications
11. share_recipients
12. user_collections
13. user_collection_files
14. file_shares
15. support_tickets
16. ticket_replies
17. ai_usage_logs
18. ra_link_audit_findings
19. product_requests
20. affiliate_clicks
21. form_submissions
22. files
23. collections
24. collection_files
25. institution_folders
26. institution_files
27. announcements
28. institution_subscriptions
29. admin_action_logs
30. privacy_r2_purge_queue

The loop reached `PRECHECK_PASS`, proving 30/30 object checks completed.

## Write boundary

This retry was schema/read-only validation only.

It did NOT:

- create any synthetic account;
- seed any fixture;
- write stress rows;
- invoke either deletion endpoint;
- execute `DELETE FROM users`;
- run the R2 purge consumer;
- touch production;
- enable semantic-primary.

## Cleanup

The successful one-time workflow was removed after evidence collection.

Cleanup commit:

`abea7ee07a06cf145651167a3ab1021f7f9b5d85`

## Current conclusion

`PRECHECK RETRY = PASS`

The previous STOP cause is closed as a harness typo. This record does not itself authorize the destructive/synthetic staging execution; that still requires fresh reviewer authorization under the already accepted controlled staging deletion packet.
