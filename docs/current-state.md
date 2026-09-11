# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The first controlled semantic-primary staging smoke exposed one live semantic `429`. The pacing correction (`1500 ms`) and aggregate telemetry read surface were implemented and independently accepted.

A separately authorized controlled retry then returned **two uncached semantic HTTP 200 responses**, but the before/after aggregate telemetry was internally impossible: `semantic_successes` increased by two while `semantic_attempts` increased by only one. The retry is therefore **NOT PASS**. The semantic-primary staging flag is OFF again; production remains OFF.

Root cause is the current KV telemetry read-modify-write sequence, which permits concurrent lost updates. The project is now at a **telemetry atomicity correction** gate. No new semantic retry is authorized.

## Controlled semantic smoke incident

Canonical incident record:

`docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`

Enablement commit:

`acb418c47ae190cf6cb587c3d4903a92c92a4a0b`

Observed live near-concurrent pair:

- one HTTP `200` response with `retrievalSource="semantic"`;
- one HTTP `200` response with `retrievalSource="lexical"` after semantic stage `rate_limited` and lexical stage `ok`;
- no relevance comparison/judgment was performed.

This proved live semantic reachability and correct objective `429 -> L` fallback, but did not prove successful live pacing enforcement.

## Pacing / observability correction — IMPLEMENTED AND ACCEPTED

Canonical proposal/review record:

`docs/reviews/2026-09-11-d016-pacing-correction-review.md`

Canonical implementation record:

`docs/architecture/p05-production-retrieval-pacing-correction.md`

Independent code-review acceptance:

`docs/reviews/2026-09-11-d016-pacing-correction-code-review-acceptance.md`

Accepted changes:

- `backend/src/research/semantic-pacer.js`: minimum grant interval `1000 -> 1500 ms`;
- `backend/src/research/telemetry.js`: read-only current-day aggregate telemetry snapshot using the existing shared metric allowlist;
- `backend/src/system-health.js`: super-admin-only `research_telemetry` section using that shared snapshot;
- deterministic `1499/1500 ms` pacing boundary test;
- system-health auth, exact shared-allowlist and privacy-surface tests.

No result-dependent routing, cache policy, relevance behavior, H/RRF, Vectorize or production flag behavior changed.

## Controlled semantic retry — EXECUTED / NOT PASS

Fresh human traffic-isolation confirmation was obtained before execution.

PRE telemetry:

- `semantic_attempts = 1`
- `semantic_successes = 1`
- `semantic_429 = 1`
- `semantic_pacing_wait_ms_total = 1000`
- `semantic_charged_responses = 1`
- `semantic_cost_microusd_total = 1000`
- `semantic_credits_total = 10`
- `lexical_fallback_attempts = 1`
- `lexical_fallback_successes = 1`

Near-concurrent retry responses:

- request 1: HTTP `200`, `retrievalSource="semantic"`, uncached, 10 results;
- request 2: HTTP `200`, `retrievalSource="semantic"`, uncached, 10 results.

POST telemetry included:

- `semantic_attempts = 2`
- `semantic_successes = 3`
- `semantic_429 = 1`.

Because two live semantic successes produced only one additional semantic-attempt count, the preregistered telemetry-integrity condition failed. No relevance judgment was made.

## Telemetry atomicity correction — ACTIVE

Canonical architecture record:

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

Independent reviewer follow-up:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-review.md`

Reviewer classification: **ACCEPTED WITH MODIFICATION**.

Required reviewer modifications have been resolved in the canonical architecture record:

1. explicit KV vs global DO vs D1 comparison;
2. explicit cross-metric invariant Test I.

Selected design for the immediate correction:

- D1 atomic counter updates;
- dedicated `research_telemetry_counters` table on existing `env.DB`;
- no KV read-modify-write for exact telemetry counters;
- no global telemetry Durable Object;
- if DO is ever revisited, it must remain separate from `OpenAlexSemanticPacer`;
- dedicated telemetry D1 binding/database remains a pre-broad-enable revisit if load/latency evidence shows meaningful coupling to the core DB.

Migration added:

`migrations/0048_research_telemetry_counters.sql`

Implementation order is migration-first: apply migration to staging before switching the telemetry writer/reader to D1.

## Telemetry privacy boundary

The telemetry correction preserves the existing single allowlist (`RESEARCH_TELEMETRY_METRICS`). Persisted telemetry is restricted to allowlisted metric name, non-negative numeric aggregate, UTC date and non-content operational timestamp.

It must not store or expose query text, normalized query, user ID/email, topic, DOI/title, result body, raw provider error body, or research-interest content.

Telemetry failure remains best-effort and cannot change retrieval result, fallback choice, relevance behavior, or otherwise valid research HTTP semantics.

## Shared-key alternative-cause check

Repository P0.5 retrieval workflows that use the staging `OPENALEX_API_KEY` are workflow-dispatch-only. GitHub Actions history showed no repository workflow-dispatch retrieval run during the original semantic smoke window.

This narrows but does not eliminate account-wide key contention as an alternative cause; secret equality and non-GitHub/external consumers cannot be proven from the repository.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until a future, separately authorized retry.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain globally paced through the dedicated pacing Durable Object at `1500 ms` minimum spacing.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second`.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## Open findings

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction: `OPEN`; pacing correction exists but closure still requires a valid future controlled retry.
2. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk: `ACKNOWLEDGED / DEFERRED`.
3. `OOS-D016-TELEMETRY-01` — KV telemetry lost-update race: `OPEN / BLOCKS SEMANTIC RETRY EXECUTION`; D1 correction implementation authorized, migration-first.
4. Wrangler declarative `exports` migration path: `ACKNOWLEDGED / DEFERRED` until deliberate toolchain upgrade.

## NEXT

1. Apply `0048_research_telemetry_counters.sql` to the **staging D1 database only** using the existing D1 migration workflow.
2. After staging schema exists, implement the D1-backed telemetry writer/reader and scheduled retention prune with semantic-primary OFF.
3. Add/execute Tests A-I, including the exact concurrent cross-metric invariant that failed live.
4. Run full CI and flag-OFF staging deploy.
5. Obtain independent code/diff review.
6. Only after accepted code review may a new retry-preparation authorization be requested.
7. Any future retry still requires fresh controlled-traffic human confirmation and at most one authorized near-concurrent pair.
8. Production migration/enablement remains a separate later decision.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Pacing correction review: `docs/reviews/2026-09-11-d016-pacing-correction-review.md`
- Pacing correction implementation: `docs/architecture/p05-production-retrieval-pacing-correction.md`
- Pacing correction code-review acceptance: `docs/reviews/2026-09-11-d016-pacing-correction-code-review-acceptance.md`
- Retry preparation: `docs/architecture/p05-production-retrieval-retry-preparation.md`
- Controlled semantic smoke incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`
- Telemetry atomicity correction: `docs/architecture/p05-research-telemetry-atomicity-correction.md`
- Telemetry atomicity reviewer follow-up: `docs/reviews/2026-09-11-d016-telemetry-atomicity-review.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
