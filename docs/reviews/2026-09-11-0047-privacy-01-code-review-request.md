# 0047-PRIVACY-01 — Narrow Code Review Request

Status: `REVIEW REQUEST / NO MERGE OR LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Scope

Review only the narrow source-order fix for `0047-PRIVACY-01` in PR #37.

PR:

`https://github.com/picohook/libedge-website/pull/37`

Base:

`staging @ 96880256f8c6e10db3e7c1106998fa14be660fff`

Head:

`fix/0047-admin-delete-audit-order @ 824b40a0224886e106a4697b9deeb0abc080d312`

The substantive behavior change is limited to `backend/src/index.js`: the existing `admin_action_logs` deletion event is inserted before `DELETE FROM users` so migration 0047's unchanged `BEFORE DELETE ON users` trigger can redact that snapshot in the same transaction.

No trigger SQL is changed.

## Exact behavioral diff

```diff
   const actor = await getTokenPayloadFromCookie(c);
   await db.batch([
-    db.prepare(`DELETE FROM newsletter_subscriptions WHERE user_id = ?`).bind(id),
-    db.prepare(`DELETE FROM subscriptions WHERE user_id=?`).bind(id),
-    db.prepare(`DELETE FROM users WHERE id=?`).bind(id),
+    // Write the deletion audit row before deleting the user so the 0047
+    // BEFORE DELETE trigger can redact its user snapshot in the same transaction.
     createAdminActionLogStmt(db, {
       id: crypto.randomUUID(),
       actor,
       entityType: 'user',
       entityId: id,
       action: 'delete',
       before: sanitizeUserForAudit(userRow),
     }),
+    db.prepare(`DELETE FROM newsletter_subscriptions WHERE user_id = ?`).bind(id),
+    db.prepare(`DELETE FROM subscriptions WHERE user_id=?`).bind(id),
+    db.prepare(`DELETE FROM users WHERE id=?`).bind(id),
   ]);
```

## Supporting changes

1. `test/backend/user-deletion-migration.test.js` adds a static regression guard requiring `createAdminActionLogStmt(...)` to appear before `DELETE FROM users WHERE id=?` inside the admin-deletion endpoint block.
2. `docs/reviews/2026-09-11-0047-privacy-01-fix-review.md` records the finding, schema validation, duplicate application cleanup, and authorization boundary.

## Schema facts to verify

- `admin_action_logs.entity_id` is plain `TEXT NOT NULL`, not an FK to `users`.
- `admin_action_logs.actor_user_id` is plain `INTEGER`, not an FK to `users`.
- 0047 already redacts `before_json`/`after_json` for `entity_type='user'` and matching `entity_id`.
- 0047 also nulls `actor_user_id` when the deleted user is the actor.
- Self-service `/api/user/delete` does not create the admin deletion audit row and is not changed by this patch.

## CI evidence

PR CI run:

`34590565540`

Result:

- workflow: `CI`
- job: `Lint + tests + syntax`
- conclusion: `success`
- syntax checks: PASS
- ESLint: PASS
- unit tests: `23 files / 99 tests PASS`
- `test/backend/user-deletion-migration.test.js`: `3 tests PASS`
- staging Wrangler dry-run: PASS
- CSS build: PASS

The added regression test is intentionally static. CI does not prove real trigger execution or privacy post-state; those remain part of the separately reviewed controlled staging deletion packet.

## One-time automation provenance

Commit `bcc7ab518c7fe65144259ce34690ef7b38dcf181` was expected and produced by a path-scoped one-time GitHub Actions workflow created for this fix. The workflow:

- ran only on branch `fix/0047-admin-delete-audit-order`;
- triggered only when `.github/workflows/apply-0047-privacy-fix.yml` changed;
- required an exact single match of the old source block and failed closed otherwise;
- applied the reorder;
- removed the one-time workflow in the same bot commit;
- left no workflow file in the final PR diff.

## Review questions

1. Does moving the audit insert before `DELETE FROM users` correctly allow the unchanged 0047 `BEFORE DELETE` trigger to redact the new deletion snapshot in the same D1 transaction?
2. Does the lack of an FK from `admin_action_logs.entity_id` / `actor_user_id` to `users` make the pre-delete insert safe from a schema-integrity perspective?
3. Does the patch remain narrow enough that no unrelated deletion semantics are changed?
4. Is the duplicated app-level cleanup of `newsletter_subscriptions` / `subscriptions` acceptable as an idempotent overlap for now, without expanding this patch?
5. Is the static regression guard useful and correctly bounded as a source-order guard rather than behavioral proof?
6. Does the self-service deletion path remain outside this specific privacy defect?
7. Is any additional code change required before this PR may be merged into `staging`?
8. If accepted, may PR #37 be merged to `staging` while still withholding authorization for any live staging account deletion or migration apply?

## Required classification

Return exactly one:

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

Also report any material `OUT-OF-SCOPE FINDING`.

## Decision boundary

`ACCEPTED` would authorize only merging this narrow source/test/doc fix into `staging`.

It would **not** authorize:

- creating a staging disposable account;
- deleting a staging account;
- applying migration 0047 to staging or production;
- any production D1 migration;
- resuming D-016 Track B;
- enabling semantic-primary in any environment.

A separately reviewed controlled staging deletion packet remains mandatory before live execution.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `0047-PRIVACY-01-CODE-REVIEW-2026-09-11`

Branch/ref context:

- base: `staging @ 96880256f8c6e10db3e7c1106998fa14be660fff`
- head: `fix/0047-admin-delete-audit-order @ 824b40a0224886e106a4697b9deeb0abc080d312`
- PR: `#37`

### RAW MATERIALS

[x] PR #37 — accessible, exact base/head identified.
[x] Exact substantive `backend/src/index.js` diff embedded above.
[x] Full PR diff reproducible from the supplied base/head and PR.
[x] `migrations/0047_user_deletion_integrity.sql` accessible on `staging`.
[x] `migrations/0022_admin_action_logs.sql` accessible on `staging`.
[x] `docs/reviews/2026-09-11-0047-read-only-schema-code-analysis.md` accessible on `staging`.
[x] `docs/reviews/2026-09-11-0047-user-deletion-integrity-production-review.md` accessible on `staging`.
[x] `docs/reviews/2026-09-11-0047-privacy-01-fix-review.md` accessible on the PR head.
[x] CI run `34590565540` result and job scope identified.
[x] One-time automation commit `bcc7ab518c7fe65144259ce34690ef7b38dcf181` identified for provenance.

### CONSISTENCY

[x] No false attached/pasted/included claim.
[x] Implementer summary is separated from raw materials.
[x] Raw material is authoritative over the summary.
[x] Reviewer is instructed to inspect fresh contents/diff, not merely confirm commit existence.
[x] Reviewer may report `OUT-OF-SCOPE FINDING` items.
[x] No live deletion, migration apply, production change, or semantic enablement is authorized by this packet.

RESULT: `COMPLETE`
