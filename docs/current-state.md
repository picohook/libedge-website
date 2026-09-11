# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

Current semantic-primary flags:

- staging: `OFF`;
- production: `OFF`.

No production semantic enablement or production D1 migration is authorized.

## Track A — production traffic / capacity evidence

Locked broad-enablement condition:

`peak eligible research-query rate <= 0.5 requests/second`.

Accepted evidence requires per-request timestamps or privacy-safe buckets no coarser than `2 seconds`, plus complete/unsampled capture. Human account-state inspection established that Workers Observability is disabled for the production Worker, so no existing Workers Logs history can satisfy this evidence standard.

Current Track A result:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

## Track B — production D1 telemetry migration preparation

Intended D-016 migration:

`migrations/0048_research_telemetry_counters.sql`

Read-only production inspection found pending migrations `0042` through `0048`. Because `0042`-`0047` are earlier unrelated migrations, the locked hard-STOP rule remains active.

Current Track B result:

`STOP — DO NOT APPLY PRODUCTION D1 MIGRATIONS`.

The backlog is tracked separately in:

`docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`

## 0047 dedicated privacy/integrity review

### 0047-PRIVACY-01

The admin deletion endpoint previously inserted a PII-bearing deletion audit snapshot after `DELETE FROM users`, so the 0047 `BEFORE DELETE` trigger could not redact that newly inserted row.

The narrow source-order fix was independently ACCEPTED and merged to staging through PR #37.

Merge commit:

`a47669de451b3ca0997f607b71cb4d914634e825`

PR CI passed: `23/23` test files, `99/99` tests, syntax/lint, Wrangler staging dry-run, and build.

Source defect status:

`FIX MERGED TO STAGING / LIVE BEHAVIOR NOT YET PROVEN`.

No live user deletion has been executed.

### Controlled staging deletion packet

Canonical packet:

`docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`

The packet predeclares synthetic fixtures, all current trigger-domain assertions, negative controls, R2 queue checks, and performance/locking thresholds.

No disposable account has been created, no fixture has been seeded, and no deletion has been run.

### 0047-SCOPE-01 — NEW BLOCKER

Reviewer systematic schema/runtime-DDL analysis identified an active user-linked table not covered by the current trigger:

`user_notifications`

The application actively inserts per-user notification rows into this table, including title/body content, while the current 0047 trigger covers only the separate `notifications` table.

Triage decision:

`OPEN / INCLUDE IN DELETION POLICY / BLOCKS STAGING EXECUTION`.

Canonical finding:

`docs/reviews/2026-09-11-0047-scope-01-user-notifications-triage.md`

Follow-up plan:

`docs/reviews/2026-09-11-0047-scope-01-followup-plan.md`

The finding is **not deferred**. The deletion policy must be extended before the controlled staging deletion test runs.

Migration-history rule: do not rewrite already-applied `0047_user_deletion_integrity.sql` in place. Prepare a separately reviewed follow-up trigger-replacement migration after fresh schema checks. Because `0048` already exists, the expected next migration number is `0049`, subject to fresh verification before creation.

Proposed `user_notifications` policy: delete rows for the deleted account.

Before any migration SQL is prepared, read-only staging checks must confirm the actual `user_notifications` schema, FKs/indexes, application paths, and retention semantics, then re-run the active user-linked table inventory.

The controlled staging deletion packet must later be amended from 29 to 30 covered table classes and independently re-reviewed.

## Performance-threshold sanity check

Cloudflare's current Workers limits indicate incoming HTTP Worker requests have no hard wall-clock duration limit while the client remains connected; paid Worker CPU time defaults to 30 seconds and can be configured higher. The packet's `2.0 s` ordinary / `5.0 s` stress limits are therefore comfortably below the platform's relevant hard execution ceilings.

A separate pre-execution check is still required for any application/browser-side timeout or `AbortController` used by the actual test caller. If a caller-side timeout is at or below a predeclared test threshold, execution must STOP for re-review.

## Finding status

### CLOSED

1. `OOS-D016-CODE-01` — semantic pacing/account-wide 429 interaction.
2. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race.

### ACKNOWLEDGED / DEFERRED

3. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk.
4. Shared-core-D1 telemetry failure-domain coupling.
5. Wrangler declarative `exports` migration path.

### OPEN / OUTSIDE D-016

6. Production D1 migration backlog `0042`-`0047`.
7. `0047-SCOPE-01` — active `user_notifications` table missing from deletion trigger; blocks staging deletion execution.

`0047-PRIVACY-01` source-order defect is fixed in staging code, but its behavioral closure remains dependent on the eventual controlled staging deletion execution after `0047-SCOPE-01` is resolved.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until separately reviewed rollout authorization.
2. Valid empty/short semantic results do not trigger lexical fallback.
3. Lexical fallback remains objective-only.
4. Semantic requests remain globally paced at `1500 ms` minimum spacing.
5. Broad enablement remains blocked without accepted `<=0.5 req/s` peak evidence.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only.
10. Production D1 migration and production semantic enablement remain separate decisions.

## NEXT

1. Keep the controlled 0047 staging deletion packet blocked.
2. Perform only the read-only `user_notifications` schema/FK/index/application-path/retention checks authorized by the `0047-SCOPE-01` follow-up plan.
3. Re-run the active user-linked table inventory.
4. Prepare a follow-up trigger-replacement migration proposal only after those checks; do not mutate migration 0047 history.
5. Independently review any proposed follow-up migration and the amended 30-table staging execution packet before applying anything.
6. Do not create/delete staging test accounts until that review is ACCEPTED.
7. Keep D-016 Track B paused; do not bulk-apply `0042`-`0048`.
8. Do not enable semantic-primary, apply production migrations, perform another semantic retry, adopt H/RRF, or introduce Vectorize without separate authorization.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked retrieval architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production rollout-stage preparation: `docs/architecture/p05-production-rollout-stage-preparation.md`
- Capacity evidence discovery: `docs/architecture/p05-production-capacity-evidence-discovery.md`
- Production D1 migration preparation: `docs/architecture/p05-production-d1-migration-preparation.md`
- Production pending-migration audit: `docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`
- 0047 dedicated production review: `docs/reviews/2026-09-11-0047-user-deletion-integrity-production-review.md`
- 0047 read-only analysis: `docs/reviews/2026-09-11-0047-read-only-schema-code-analysis.md`
- 0047 controlled staging packet: `docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`
- 0047 scope finding: `docs/reviews/2026-09-11-0047-scope-01-user-notifications-triage.md`
- 0047 scope follow-up plan: `docs/reviews/2026-09-11-0047-scope-01-followup-plan.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
