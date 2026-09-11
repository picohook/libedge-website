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

### 0047-SCOPE-01 — live staging divergence confirmed

Reviewer discovery correctly identified `user_notifications` as an active per-user table absent from the explicit 0047 trigger.

Static repository inspection found that canonical migration `0008_user_notifications.sql` declares:

`user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`

However, a read-only inspection of the actual remote staging D1 database disproved that cascade assumption.

Workflow run:

`34601127734`

Remote staging D1:

- `libedge-db`
- `207d80d6-7e6b-4e10-aacf-b218970dbaf8`

Live result:

`PRAGMA foreign_key_list(user_notifications)` returned an empty result set.

Therefore the actual staging table has **no FK** on `user_id` and no `ON DELETE CASCADE` behavior to rely on.

The expected indexes are present, including:

`idx_user_notifications_user(user_id, is_read)`.

Current finding state:

`OPEN / LIVE FK CASCADE ABSENT / EXPLICIT DELETION POLICY REQUIRED / BLOCKS STAGING EXECUTION`.

Canonical evidence:

`docs/reviews/2026-09-11-0047-scope-01-live-staging-schema-evidence.md`

The static "cascade already covers this table" hypothesis is closed as false for live staging.

Migration-history rule remains: do not mutate already-applied `0008` or `0047` in place. A separately reviewed forward migration proposal is now required after fresh migration-number verification and one more complete active user-linked inventory pass.

### Controlled staging deletion packet

Canonical packet:

`docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`

The packet remains BLOCKED. No disposable account has been created, no fixture has been seeded, and no deletion has been run.

The eventual deletion-policy surface remains 30 domains:

- 29 current trigger-touched domains;
- `user_notifications` as the newly confirmed uncovered domain requiring an explicit forward-policy fix.

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
7. `0047-SCOPE-01` — live staging `user_notifications` has no FK cascade and remains outside the current trigger; forward migration design/review is required before controlled staging deletion.

`0047-PRIVACY-01` source-order defect is fixed in staging code, but behavioral closure still requires the eventual controlled staging deletion execution after `0047-SCOPE-01` is resolved.

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
2. Re-run/confirm the complete active user-linked deletion-policy inventory.
3. Freshly verify the next migration number.
4. Prepare a forward trigger-replacement migration proposal that preserves the reviewed 0047 policy and explicitly deletes `user_notifications` rows by `user_id`.
5. Independently review the migration proposal and amended 30-domain staging execution packet before applying anything.
6. Do not create/delete staging test accounts until those reviews are ACCEPTED.
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
- 0047 scope live staging evidence: `docs/reviews/2026-09-11-0047-scope-01-live-staging-schema-evidence.md`
- 0047 scope follow-up: `docs/reviews/2026-09-11-0047-scope-01-followup-plan.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
