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

Source defect status:

`FIX MERGED TO STAGING / LIVE BEHAVIOR NOT YET PROVEN`.

No live user deletion has been executed.

### 0047-SCOPE-01 — corrected triage

Reviewer discovery correctly identified `user_notifications` as an active per-user table absent from the explicit 0047 trigger. Follow-up repository schema inspection then found an important correction:

`migrations/0008_user_notifications.sql` defines:

`user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`

and creates:

`idx_user_notifications_user(user_id, is_read)`.

Therefore absence from the trigger does **not** by itself imply residual data. Under the canonical migrated schema, `user_notifications` is deleted by FK cascade.

The application runtime-DDL fallback omits this FK, but runtime DDL is disabled in strict `staging` and `production` environments.

Current finding state:

`TRIAGED / CANONICAL FK CASCADE COVERS USER_NOTIFICATIONS / LIVE STAGING CONFIRMATION REQUIRED`.

A new trigger-replacement migration such as 0049 is **not currently justified**. It would be reconsidered only if fresh live staging read-only schema evidence shows the expected cascade is missing or materially divergent.

Canonical records:

- `docs/reviews/2026-09-11-0047-scope-01-user-notifications-triage.md`
- `docs/reviews/2026-09-11-0047-scope-01-read-only-discovery.md`
- `docs/reviews/2026-09-11-0047-scope-01-followup-plan.md`

### Controlled staging deletion packet

Canonical packet:

`docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`

The packet has been amended to cover **30 deletion-policy domains**:

- 29 domains explicitly handled by the 0047 trigger;
- `user_notifications` as a separately verified FK-cascade domain.

Before any write, live staging read-only evidence must confirm:

- `user_notifications` columns;
- `user_id -> users(id) ON DELETE CASCADE`;
- `idx_user_notifications_user` with `user_id` leading;
- no material schema drift.

The controlled packet remains `PRE-EXECUTION RE-REVIEW ONLY`. No disposable account has been created, no fixture has been seeded, and no deletion has been run.

## Performance-threshold sanity check

The packet's `2.0 s` ordinary / `5.0 s` stress / `2.0 s` unrelated-write thresholds remain comfortably below Cloudflare Worker platform execution ceilings. The actual browser/application caller must still be checked for a shorter explicit timeout or `AbortController` before execution.

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
7. `0047-SCOPE-01` — no longer presumed to require a migration; awaiting live staging FK/index confirmation and independent review of the amended 30-domain execution packet.

`0047-PRIVACY-01` source-order defect is fixed in staging code, but behavioral closure still requires the eventual controlled staging deletion execution.

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

1. Keep the controlled 0047 staging deletion packet blocked pending re-review.
2. Obtain fresh **read-only live staging** `user_notifications` table/FK/index evidence.
3. Re-run/confirm the active user-linked deletion-policy inventory with trigger-vs-cascade mechanisms distinguished.
4. Do **not** prepare 0049 unless live staging schema proves the canonical cascade is absent or unsafe.
5. Submit the amended 30-domain controlled staging packet for independent review.
6. Do not create/delete staging test accounts until that review is ACCEPTED and the live read-only precheck passes.
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
- 0047 scope triage: `docs/reviews/2026-09-11-0047-scope-01-user-notifications-triage.md`
- 0047 scope discovery: `docs/reviews/2026-09-11-0047-scope-01-read-only-discovery.md`
- 0047 scope follow-up: `docs/reviews/2026-09-11-0047-scope-01-followup-plan.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
