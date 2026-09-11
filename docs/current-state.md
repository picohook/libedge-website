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

Current state:

`STRUCTURALLY CORRECTED IN STAGING / BEHAVIORAL CLOSURE PENDING`.

No live staging deletion has yet been executed.

### 0047-SCOPE-01

Reviewer discovery identified `user_notifications` as an active per-user table omitted from the original explicit 0047 trigger.

Live staging schema inspection proved that, despite canonical migration 0008 declaring a cascade FK, actual staging `user_notifications` has no FK and therefore no cascade behavior to rely on.

A forward-only trigger replacement was prepared as:

`migrations/0049_user_notifications_deletion_policy.sql`

PR #38 was independently ACCEPTED and merged to staging. Migration 0049 was then separately reviewed and applied exactly once to remote staging under locked pre/post guardrails.

Controlled apply run:

`34606916660`

Result:

`SUCCESS`

Post-apply live trigger semantically matches reviewed 0049 and explicitly contains:

`DELETE FROM user_notifications WHERE user_id = OLD.id;`

`user_notifications` itself was not rebuilt or otherwise changed; it remains FK-less and retains the reviewed indexes.

Current finding state:

`STRUCTURALLY CORRECTED IN STAGING / BEHAVIORAL CLOSURE PENDING`.

### Controlled staging deletion packet

Canonical packet:

`docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`

The packet has been refreshed to use the live 0049 explicit trigger policy rather than the disproven FK-cascade assumption.

Fresh review request:

`docs/reviews/2026-09-11-0047-controlled-staging-deletion-preexecution-review-request.md`

Current state:

`PRE-EXECUTION REVIEW PENDING / NO SYNTHETIC ACCOUNT CREATION OR DELETION AUTHORIZED`.

No disposable account has been created, no fixture has been seeded, and no deletion has been run.

The deletion-policy surface remains 30 domains:

- the original 29 trigger-touched domains;
- `user_notifications`, now explicitly covered by the live 0049 trigger.

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
7. `0047-PRIVACY-01` — structurally corrected, behavioral live closure pending.
8. `0047-SCOPE-01` — structurally corrected through live staging 0049 trigger, behavioral live closure pending.

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

1. Obtain independent review of the refreshed controlled staging deletion packet.
2. Do not create synthetic accounts, seed fixtures, or delete any staging user before an ACCEPTED decision.
3. If ACCEPTED, require fresh human confirmation that the staging execution window contains only controlled test traffic before starting the one authorized execution.
4. Preserve the packet's 30-domain assertions, locked stress volumes, timing thresholds, hard STOP, and no-retry rule.
5. Keep D-016 Track B paused; do not bulk-apply production `0042`-`0048`.
6. Do not enable semantic-primary, apply production migrations, perform another semantic retry, adopt H/RRF, or introduce Vectorize without separate authorization.

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
- 0047 fresh pre-execution review request: `docs/reviews/2026-09-11-0047-controlled-staging-deletion-preexecution-review-request.md`
- 0049 staging apply evidence: `docs/reviews/2026-09-11-0049-staging-migration-apply-evidence.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
