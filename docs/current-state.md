# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current workstream priority

- `ACTIVE`: **AI Assistant architecture + staging development**.
- `PAUSED`: **Production/go-live execution**, including the accepted G0-G9 go-live checklist and production migration reconciliation. This work is paused, not cancelled, and resumes from its existing state when the first public-launch decision is made. No production migration or production deployment work is to be executed while paused.
- `SEPARATE`: **Semantic-primary Track A/B (D-016)**. It remains on its own authorization and rollout chain and is not implicitly enabled or blocked by AI Assistant staging development.

The canonical AI Assistant architecture record is:

`docs/architecture/p05-ai-assistant-architecture-v0.1.md`

No AI Assistant implementation code has been authorized or started by that architecture record. No LLM provider has been selected. Provider/model/endpoint privacy evaluation is the first real gate after architecture-to-code reconciliation.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

Current semantic-primary flags:

- staging: `OFF`;
- production: `OFF`.

No production semantic enablement or production D1 migration is authorized.

## Track A — production traffic / capacity evidence

Track A is `SEPARATE` from AI Assistant staging development.

Locked broad-enablement condition:

`peak eligible research-query rate <= 0.5 requests/second`.

Accepted evidence requires per-request timestamps or privacy-safe buckets no coarser than `2 seconds`, plus complete/unsampled capture. Human account-state inspection established that Workers Observability is disabled for the production Worker, so no existing Workers Logs history can satisfy this evidence standard.

Current Track A result:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

## Track B — production D1 telemetry migration preparation

Track B is `SEPARATE` from AI Assistant staging development, while production migration execution itself remains `PAUSED` under the go-live workstream.

Intended D-016 migration:

`migrations/0048_research_telemetry_counters.sql`

Read-only production inspection found a pending production migration backlog beginning at `0042`. Supported D1 migration application does not provide a normal skip mechanism for arbitrary pending files, so production reconciliation remains a gating item for eventual semantic-primary production enablement.

Current Track B execution result:

`PAUSED — DO NOT APPLY PRODUCTION D1 MIGRATIONS`.

The backlog is tracked separately in:

`docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`

## 0047 / 0049 privacy and deletion-policy closure

The staging deletion-policy work is **CLOSED** and is not to be reopened without new contradictory evidence.

### 0047-PRIVACY-01

The admin deletion endpoint previously inserted a PII-bearing deletion audit snapshot after `DELETE FROM users`, so the 0047 `BEFORE DELETE` trigger could not redact that newly inserted row.

The narrow source-order fix was independently ACCEPTED and merged to staging through PR #37.

Merge commit:

`a47669de451b3ca0997f607b71cb4d914634e825`

Final state:

`CLOSED — BEHAVIORAL PASS`.

### 0047-SCOPE-01 / 0049

Reviewer discovery identified `user_notifications` as an active per-user table omitted from the original explicit 0047 trigger. Live staging inspection proved that the table could not rely on the previously assumed cascade behavior.

The forward-only trigger replacement is:

`migrations/0049_user_notifications_deletion_policy.sql`

PR #38 was independently ACCEPTED and merged to staging. Migration 0049 was separately reviewed and applied exactly once to remote staging under locked pre/post guardrails.

Controlled apply run:

`34606916660`

The controlled 30-domain staging deletion workflow was subsequently corrected for the login/refresh-token baseline side effect and executed successfully against the reviewed staging commit.

Successful controlled deletion run:

`34700067535` is **not** the deletion run; it is the later staging smoke run. The canonical deletion evidence remains in the dedicated review/evidence records and must be used rather than inferring deletion status from unrelated workflow IDs.

Final finding state:

`CLOSED — BEHAVIORAL PASS (ADMIN + SELF PATHS)`.

The deletion-policy surface remains 30 domains, including `user_notifications` through the explicit 0049 trigger.

## Staging release-candidate status

The current staging product has passed the existing technical smoke suite for:

- authentication;
- files;
- lexical research;
- frontend Chromium behavior.

Staging smoke run:

`34700067535`

Result:

`SUCCESS`.

No new launch-blocking issue was identified in the subsequent fast-mode launch-readiness review. This does not authorize production deployment.

## Finding status

### CLOSED

1. `OOS-D016-CODE-01` — semantic pacing/account-wide 429 interaction.
2. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race.
3. `0047-PRIVACY-01` — behavioral PASS in staging.
4. `0047-SCOPE-01` — behavioral PASS in staging, including explicit 0049 `user_notifications` policy.

### ACKNOWLEDGED / DEFERRED

5. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk.
6. Shared-core-D1 telemetry failure-domain coupling.
7. Wrangler declarative `exports` migration path.

### PAUSED / SEPARATE

8. Production D1 migration reconciliation/backlog — paused until go-live workstream resumes; remains an eventual production gate.
9. Semantic-primary Track A/B — separate rollout chain; semantic-primary remains OFF.

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

1. Reconcile `docs/architecture/p05-ai-assistant-architecture-v0.1.md` against the current LibEdge/DISCOVER code without starting AI Assistant implementation.
2. Preserve the two P0 AI Assistant invariants: evidence grounding and research-interest privacy.
3. Evaluate candidate LLM providers/models/endpoints through the Provider Privacy Gate before selecting any provider.
4. Keep production/go-live execution paused until the first public-launch decision explicitly resumes the accepted G0-G9 checklist.
5. Keep semantic-primary Track A/B separate and semantic-primary OFF unless separately authorized.
6. Do not apply production migrations or deploy production as part of the AI Assistant architecture work.

## Canonical records

- Decisions: `docs/decisions.md`
- AI Assistant architecture: `docs/architecture/p05-ai-assistant-architecture-v0.1.md`
- Locked retrieval architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production rollout-stage preparation: `docs/architecture/p05-production-rollout-stage-preparation.md`
- Capacity evidence discovery: `docs/architecture/p05-production-capacity-evidence-discovery.md`
- Production D1 migration preparation: `docs/architecture/p05-production-d1-migration-preparation.md`
- Production pending-migration audit: `docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`
- 0047 dedicated production review: `docs/reviews/2026-09-11-0047-user-deletion-integrity-production-review.md`
- 0047 read-only analysis: `docs/reviews/2026-09-11-0047-read-only-schema-code-analysis.md`
- 0047 controlled staging packet: `docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`
- 0049 staging apply evidence: `docs/reviews/2026-09-11-0049-staging-migration-apply-evidence.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-12
