# 0047 User Deletion Integrity — Read-Only Schema / Code Analysis

Status: `READ-ONLY ANALYSIS / STOP — NO STAGING DELETION OR PRODUCTION APPLY AUTHORIZED`

Date: 2026-09-11

## Scope and boundary

This record performs only the reviewer-authorized read-only work for `migrations/0047_user_deletion_integrity.sql`:

1. map the trigger's 29 touched tables to their repository schema/migration sources and user-related FK/delete behavior;
2. compare the two current application deletion paths with trigger behavior;
3. identify blockers that must be resolved before a controlled staging deletion packet can be authorized.

No staging user was created or deleted. No production migration was applied. D-016 Track B remains STOPPED.

## Existing automated evidence and its limit

`test/backend/user-deletion-migration.test.js` is a static migration-content test. It verifies that important SQL fragments exist and that `ai_usage_logs` is deleted rather than nulled. It does **not** execute 0047 against SQLite/D1, exercise the FK graph, call either real deletion endpoint, measure trigger duration, or prove privacy post-state.

`test/backend/privacy-r2-purge.test.js` tests the R2 queue consumer's managed-key behavior. It does **not** prove `DELETE FROM users` creates the correct queue rows or that the full deletion policy is correct.

Therefore neither test replaces the future controlled staging execution required by the dedicated 0047 review.

## A. 29-table schema/FK matrix

The table list below matches the 29 tables touched by the current trigger.

| # | Table | Repository schema source | User relationship / delete behavior relevant to 0047 | 0047 action / note |
|---|---|---|---|---|
| 1 | `subscriptions` | `0001_initial_schema.sql` | `user_id -> users(id)`, no `ON DELETE` action | explicit `DELETE`; required to avoid parent-delete FK failure |
| 2 | `newsletter_subscriptions` | `0003_newsletter_subscriptions.sql` | `user_id -> users(id) ON DELETE CASCADE` | explicit `DELETE`; redundant with cascade but deterministic |
| 3 | `user_profile_links` | `0032_user_profile_links.sql` | `user_id -> users(id) ON DELETE CASCADE` | explicit `DELETE`; redundant with cascade |
| 4 | `refresh_tokens` | `0033_refresh_tokens.sql` | `user_id -> users(id) ON DELETE CASCADE` | explicit `DELETE`; redundant with cascade, security-explicit |
| 5 | `password_resets` | `0017_password_resets.sql` | `user_id -> users(id) ON DELETE CASCADE` | explicit `DELETE`; redundant with cascade, security-explicit |
| 6 | `ra_user_credentials` | `0018_ra_schema_complete.sql` | `user_id` present but no FK declared | explicit `DELETE`; required for unlink/removal |
| 7 | `announcement_reactions` | `0010_announcement_engagement.sql` | `user_id -> users(id) ON DELETE CASCADE` | explicit `DELETE`; redundant with cascade |
| 8 | `announcement_comments` | `0010_announcement_engagement.sql` | `user_id -> users(id) ON DELETE CASCADE`; `deleted_by -> users(id)` with no delete action | delete target user's own comments; separately null `deleted_by` to prevent FK blocking |
| 9 | `notifications` | `0007_file_sharing.sql` | `user_id -> users(id) ON DELETE CASCADE` | explicit `DELETE`; redundant with cascade |
| 10 | `share_recipients` | `0007_file_sharing.sql` | `user_id -> users(id) ON DELETE CASCADE`; `share_id -> file_shares(id) ON DELETE CASCADE` | delete rows where target is recipient, then rows tied to target-owned shares |
| 11 | `user_collection_files` | `0007_file_sharing.sql` | no direct user FK; `collection_id -> user_collections ON DELETE CASCADE` | explicit child delete before `user_collections`; order is conservative |
| 12 | `user_collections` | `0007_file_sharing.sql` | `user_id -> users(id) ON DELETE CASCADE`; parent hierarchy cascades | explicit `DELETE`; child refs already removed |
| 13 | `file_shares` | `0007_file_sharing.sql` | `from_user_id -> users(id) ON DELETE CASCADE` | explicit delete after dependent `share_recipients` cleanup |
| 14 | `ticket_replies` | `0004_support_tickets.sql`, attachment column `0005_ticket_attachments_and_seen.sql` | `user_id` and `ticket_id` have no FK declarations in creation migration | queue attachments first; delete replies on owned tickets; null author on other users' tickets |
| 15 | `support_tickets` | `0004_support_tickets.sql` | `user_id` has no FK declaration | explicit delete; required because no user cascade |
| 16 | `product_requests` | `0035_product_requests_ai_usage_logs.sql` | `user_id -> users(id) ON DELETE SET NULL` | explicit `UPDATE user_id=NULL`; same intended effect as FK action |
| 17 | `ai_usage_logs` | `0035_product_requests_ai_usage_logs.sql` | `user_id -> users(id) ON DELETE SET NULL`; CHECK requires `user_id` or `anonymous_id` non-null | explicit `DELETE`; important because automatic SET NULL could violate CHECK for non-anonymous rows |
| 18 | `affiliate_clicks` | `0030_individual_tools_affiliate_clicks.sql` | `user_id` plain integer, no FK | null user plus `referer` and `user_agent`; privacy scrub beyond unlinking |
| 19 | `ra_link_audit_findings` | `0029_ra_link_audit.sql` | `user_id` plain integer, no FK | explicit `DELETE`; removes URL/sample diagnostic data |
| 20 | `form_submissions` | `0003a_form_submissions.sql` | `user_id` plain integer, no FK | null direct identifiers/free text and user link; retain workflow record |
| 21 | `files` | `0006_centralized_file_storage.sql` | `uploaded_by -> users(id)`, no delete action | null `uploaded_by`; required before parent delete |
| 22 | `collections` | `0006_centralized_file_storage.sql` | `created_by -> users(id)`, no delete action | null `created_by`; required before parent delete |
| 23 | `collection_files` | `0006_centralized_file_storage.sql` | `added_by -> users(id)`, no delete action | null `added_by`; required before parent delete |
| 24 | `institution_folders` | `0001_initial_schema.sql` legacy table | `created_by` plain integer, no FK | null creator; legacy/shared content preserved |
| 25 | `institution_files` | `0001_initial_schema.sql` legacy table | `uploaded_by` plain integer, no FK | null uploader; legacy/shared content preserved |
| 26 | `announcements` | `0001_initial_schema.sql` | `created_by` plain integer, no FK | null creator; announcement retained |
| 27 | `institution_subscriptions` | `0001_initial_schema.sql` (+ later access columns) | `created_by` plain integer; institution FK unrelated to user deletion | null creator; subscription retained |
| 28 | `admin_action_logs` | `0022_admin_action_logs.sql` | `actor_user_id` plain integer, no FK; snapshots are JSON text | null target actor linkage; redact existing target user/support-ticket snapshots |
| 29 | `privacy_r2_purge_queue` | created by `0047_user_deletion_integrity.sql` | no user FK; contains object URL + purge status | insert support attachment references before tickets/replies are removed |

### Matrix conclusions

1. Several rows genuinely require trigger/app cleanup because their user-reference columns have **no cascade or no FK at all** (`subscriptions`, support tables, RA credentials, affiliate clicks, RA audit findings, forms, centralized shared-content creator/uploader columns, legacy tables, announcements, institution subscriptions, admin logs).
2. Several explicit deletes are intentionally redundant with `ON DELETE CASCADE` (`newsletter_subscriptions`, profile links, refresh/reset tokens, reactions, notifications, some sharing/personal collection rows). This is not automatically incorrect, but it increases policy surface and should be validated end-to-end.
3. `announcement_comments.deleted_by` is a real FK blocker unless nulled before deleting a moderator user; the trigger does that.
4. `ai_usage_logs` is a particularly important ordering/policy case: its FK says `ON DELETE SET NULL`, but the table CHECK can reject a row with both `user_id` and `anonymous_id` null. The trigger's pre-delete `DELETE FROM ai_usage_logs WHERE user_id=OLD.id` avoids that failure mode.
5. Support-ticket tables are not protected by user cascades in their creation migration; their cleanup is trigger-dependent.

## B. FK and statement-order analysis

The current trigger's key ordering choices are structurally sensible against the repository schema:

- personal `user_collection_files` are removed before `user_collections`;
- target-recipient `share_recipients` are removed, then recipients for target-owned `file_shares`, then `file_shares` are removed;
- support attachment URLs are queued before `ticket_replies` / `support_tickets` disappear;
- support audit snapshots are redacted while target ticket IDs are still queryable;
- target-owned `ticket_replies`/tickets are deleted, while replies authored on another user's ticket are retained only after `user_id` is nulled;
- shared content creator/uploader references (`files`, `collections`, `collection_files`, legacy institution tables, announcements, institution subscriptions) are nulled before deleting the `users` parent;
- `announcement_comments.deleted_by` is nulled before the user row deletion;
- `ai_usage_logs` is deleted before the user FK can attempt `SET NULL`.

No obvious child-after-parent error was found in this read-only pass.

However, this is still repository-schema analysis rather than a live `PRAGMA foreign_key_list(...)` dump of the staging database. The controlled staging test packet must include production-equivalent schema confirmation before execution.

## C. Current application deletion paths vs trigger

### Self-service — `DELETE /api/user/delete`

Before deleting `users`, current code:

1. reads `avatar_url`;
2. deletes `newsletter_subscriptions`;
3. deletes `subscriptions`;
4. deletes `user_profile_links`;
5. executes `DELETE FROM users WHERE id=?`;
6. after DB deletion, deletes the managed avatar R2 object if present;
7. clears auth/refresh cookies.

Comparison with 0047:

- newsletter/subscription/profile-link cleanup is duplicated between endpoint and trigger;
- all other trigger policy is centralized in the DB trigger;
- avatar deletion remains application-only and occurs after the DB transaction path; 0047 does not queue avatars.

### Admin — `DELETE /api/admin/user/:id`

Current code prepares one `db.batch` containing, in order:

1. delete `newsletter_subscriptions`;
2. delete `subscriptions`;
3. delete `users` (therefore execute 0047 trigger if installed);
4. insert a new `admin_action_logs` row with `action='delete'` and `before=sanitizeUserForAudit(userRow)`.

After the batch, it deletes the managed avatar R2 object if present.

Comparison with 0047:

- newsletter/subscription cleanup is duplicated;
- unlike self-service, `user_profile_links` is not pre-deleted and therefore depends on cascade/trigger;
- the DB trigger is otherwise the common central cleanup mechanism;
- avatar cleanup remains application-only.

## D. Material finding — admin deletion reintroduces a PII audit snapshot after trigger redaction

**Classification: BLOCKER FOR 0047 STAGING-EXECUTION AUTHORIZATION UNTIL DISPOSITIONED.**

0047 explicitly redacts existing user audit snapshots during the `BEFORE DELETE ON users` trigger:

```sql
UPDATE admin_action_logs
   SET before_json = NULL,
       after_json = NULL
 WHERE entity_type = 'user'
   AND entity_id = CAST(OLD.id AS TEXT);
```

But the current admin deletion endpoint inserts a **new** delete audit row only **after** the `DELETE FROM users` statement has run:

```text
batch statement 1: delete newsletter row(s)
batch statement 2: delete subscription row(s)
batch statement 3: DELETE FROM users  -> 0047 trigger runs and redacts existing logs
batch statement 4: INSERT admin_action_logs(action='delete', before_json=<user snapshot>)
```

`sanitizeUserForAudit(userRow)` includes personal profile fields such as email, full name, first/last name, title, institution and avatar URL.

Therefore the trigger cannot redact the newly inserted statement-4 snapshot: that row does not exist when the `BEFORE DELETE` trigger executes.

This conflicts with the apparent 0047 policy intent to retain the audit event but remove personal snapshots for a deleted user.

Before any staging deletion execution is authorized, the project must explicitly choose and review one coherent policy, for example:

- insert a deletion audit event with no personal `before_json` snapshot; or
- create/redact the audit row in an order that guarantees the post-delete retained event contains no prohibited profile snapshot; or
- document and independently approve a contrary retention policy if deletion-audit profile data is intentionally retained.

No choice is made by this read-only record. The inconsistency itself is the finding.

## E. Additional application/trigger observations

1. **Duplicate deletes are mostly idempotent but should be simplified or explicitly accepted.** The endpoint and trigger both remove some rows. This does not by itself create a correctness failure, but it weakens the stated goal of one central policy and makes future drift easier.
2. **Admin and self-service paths already differ.** Self-service explicitly removes `user_profile_links`; admin does not. 0047 currently masks that difference, but without the trigger the paths do not have identical cleanup behavior.
3. **Avatar lifecycle is outside 0047.** Both endpoints read the avatar URL before user deletion and delete the managed avatar after DB deletion. A DB deletion that succeeds followed by R2 failure can therefore leave an orphaned avatar object; this is pre-existing application behavior and must be consciously included in privacy recovery semantics.
4. **Support attachment R2 lifecycle is different and better isolated.** 0047 queues `ticket-attachments/` references before DB rows disappear; the separate consumer restricts deletion to that managed prefix.
5. **The current migration unit test is not behavioral.** It would still pass if a real production-equivalent FK/schema interaction made the trigger fail at runtime, because it checks SQL strings rather than executing them.

## F. Performance / lock-duration requirement from reviewer follow-up

The dedicated 0047 review plan has been amended so the future controlled staging execution cannot pass only on logical correctness.

The separately reviewed execution packet must predeclare:

- ordinary fixture volume;
- stress-scale row counts for at least two realistically accumulating user-scoped tables (`ai_usage_logs` and `notifications`, unless another pair is justified by evidence);
- timing measurement method;
- a maximum acceptable deletion/lock duration tied to a documented request/runtime budget or operational SLO;
- any safe unrelated-write concurrency probe;
- hard STOP on timeout, busy/lock errors, material unrelated-write blocking, or threshold breach.

No stress fixture or deletion is authorized by this analysis.

## G. Read-only disposition

### Completed in this pass

- 29/29 trigger-touched tables mapped to repository schema sources and user-reference behavior;
- key FK/delete-action interactions reviewed;
- self-service and admin deletion endpoints compared to 0047;
- R2 consumer/test scope reviewed;
- performance/lock-duration requirement incorporated into the parent review plan.

### New blocker

`0047-PRIVACY-01 — Admin deletion creates a new PII-bearing user deletion audit snapshot after the 0047 trigger's redaction step.`

Status: `OPEN / BLOCKS CONTROLLED STAGING DELETION PACKET`.

### Still required before a staging deletion packet can be accepted

1. resolve/review `0047-PRIVACY-01`;
2. obtain an actual staging schema/FK inventory for the 29-table surface (read-only) or otherwise demonstrate production-equivalent schema state;
3. prepare exact synthetic fixture/post-state assertions;
4. prepare predeclared performance/lock thresholds and stress volumes;
5. independently review privacy retention semantics and recovery plan.

## Decision boundary

This read-only analysis authorizes nothing beyond further read-only analysis and preparation/review of fixes or a staging-test proposal.

It does **not** authorize:

- a staging user deletion;
- creation of a staging disposable account;
- applying 0047 or any production migration;
- resuming D-016 Track B;
- changing semantic-primary flags.
