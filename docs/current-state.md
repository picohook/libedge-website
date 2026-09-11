# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The first controlled semantic-primary staging smoke exposed a live semantic `429`; the pacing interval was corrected from `1000 ms` to `1500 ms` and independently accepted.

A later separately authorized controlled retry returned two uncached semantic HTTP `200` responses, but the telemetry counters were internally impossible (`semantic_successes` increased by two while `semantic_attempts` increased by one). That retry is **NOT PASS**. The semantic-primary flag is OFF in staging and production.

The telemetry lost-update defect has now been corrected in code using D1 atomic counters, with the staging schema migrated first. Full CI is green and the corrected runtime is deployed to staging **with semantic-primary OFF**. The project is now at an **independent telemetry code/diff review gate only**. No new semantic retry is authorized.

## Controlled semantic smoke / retry history

Canonical first-smoke incident:

`docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`

First smoke:

- one HTTP `200` semantic response;
- one HTTP `200` lexical response after semantic `rate_limited` and lexical `ok`;
- correct objective `429 -> L` fallback;
- pacing not live-verified.

Pacing/observability correction canonical records:

- `docs/reviews/2026-09-11-d016-pacing-correction-review.md`
- `docs/architecture/p05-production-retrieval-pacing-correction.md`
- `docs/reviews/2026-09-11-d016-pacing-correction-code-review-acceptance.md`

Accepted pacing correction:

- global semantic pacing remains a dedicated Durable Object;
- minimum grant interval is `1500 ms`;
- staging/production semantic feature flags remain independently controlled;
- system health exposes privacy-safe aggregate research telemetry to super-admin only.

Second controlled retry:

PRE telemetry included:

- `semantic_attempts = 1`
- `semantic_successes = 1`
- `semantic_429 = 1`
- `semantic_pacing_wait_ms_total = 1000`
- `semantic_charged_responses = 1`
- `semantic_cost_microusd_total = 1000`
- `semantic_credits_total = 10`
- `lexical_fallback_attempts = 1`
- `lexical_fallback_successes = 1`

Near-concurrent responses:

- request 1: HTTP `200`, `retrievalSource="semantic"`, uncached, 10 results;
- request 2: HTTP `200`, `retrievalSource="semantic"`, uncached, 10 results.

POST telemetry included:

- `semantic_attempts = 2`
- `semantic_successes = 3`
- `semantic_429 = 1`.

The impossible cross-metric state proved the previous KV telemetry writer was not exact under concurrency. No relevance judgment was made.

## Telemetry atomicity correction — IMPLEMENTED / REVIEW PENDING

Canonical architecture decision:

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

Reviewer follow-up that required explicit D1-vs-DO comparison and Test I:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-review.md`

Canonical implementation record:

`docs/architecture/p05-research-telemetry-atomicity-implementation.md`

Selected design:

- exact telemetry counters moved from non-atomic KV read-modify-write to D1;
- dedicated table: `research_telemetry_counters` on existing `env.DB`;
- atomic SQL UPSERT per metric;
- `recordResearchMetrics(...)` batches multiple counters describing one terminal event;
- `RESEARCH_TELEMETRY_METRICS` remains the single allowlist;
- no global telemetry Durable Object;
- if a telemetry DO is ever reconsidered, it must remain separate from `OpenAlexSemanticPacer`;
- a dedicated telemetry D1 database/binding remains a pre-broad-enable architecture revisit if load/latency/contention evidence warrants separation from core D1.

### Staging migration

Migration:

`migrations/0048_research_telemetry_counters.sql`

Staging migration run `34569103893`:

- list pending migrations: PASS;
- apply staging migrations: PASS;
- verify `research_telemetry_counters` table: PASS.

The temporary one-shot migration workflow was removed immediately after success.

Production migration was **not** applied.

### Runtime implementation

`backend/src/research/telemetry.js`:

- D1 atomic UPSERTs replace KV exact-counter writes;
- exact current-day snapshot reads from D1;
- unsupported metrics are filtered by the existing shared allowlist;
- scheduled retention pruning preserves the intended eight UTC-day buckets;
- telemetry failures remain best-effort and cannot alter otherwise valid research retrieval/fallback behavior.

`backend/src/research/router.js`:

- semantic success terminal events batch attempt + success + pacing wait + provider latency + applicable valid-empty/cost/credit counters;
- semantic failure terminal events batch attempt + applicable wait/latency + exactly the applicable failure category;
- successful lexical fallback batches attempt + success;
- failed lexical fallback records attempt only;
- no relevance/routing/cache/fallback policy changed.

`backend/src/worker.js`:

- scheduled telemetry pruning runs alongside the existing privacy purge task.

### Tests A-I

Required test coverage is implemented:

- A: concurrent same-metric exact increment;
- B: concurrent mixed positive deltas;
- C: allowlist-only persistence/read surface;
- D: privacy/content exclusion;
- E: UTC-day isolation;
- F: existing system-health auth/exact-allowlist/privacy regression;
- G: existing `1499/1500 ms` pacing regression;
- H: full quality gate;
- I: concurrent cross-metric invariant (`semantic_successes <= semantic_attempts`, all-success case exactly `N/N`).

Retention pruning is also tested.

### CI / flag-OFF deploy evidence

CI run `34569559519`:

- syntax PASS;
- lint PASS;
- `23` test files PASS;
- `98` tests PASS;
- staging Wrangler dry-run PASS;
- dry-run explicitly showed `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- build PASS.

A later comment-only deploy-trigger commit `1fe5c50945e17038059e0926a1a59e5320232364` changed no runtime behavior beyond the already-tested implementation. CI run `34569629908`: SUCCESS.

Deploy Workers run `34569629970`, head `1fe5c50945e17038059e0926a1a59e5320232364`:

- Quality gate: PASS;
- Deploy backend to staging: PASS;
- Deploy backend to production: SKIPPED;
- staging binding showed `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- Worker version: `de70736e-8851-45b8-aed1-99e25013aa19`.

No semantic provider smoke/retry occurred after this deployment.

## Telemetry privacy boundary

The telemetry correction preserves the existing single allowlist (`RESEARCH_TELEMETRY_METRICS`). Persisted telemetry is restricted to:

- UTC date;
- allowlisted metric name;
- non-negative numeric aggregate value;
- non-content operational update timestamp.

It does not store or expose query text, normalized query, user ID/email, topic, DOI/title, result body, raw provider error body, or research-interest content.

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
3. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race: `OPEN / IMPLEMENTATION COMPLETE / BLOCKS SEMANTIC RETRY UNTIL INDEPENDENT CODE-DIFF ACCEPTANCE`; D1 correction is implemented and flag-OFF deployed, but not yet independently accepted.
4. Shared-core-D1 telemetry failure-domain coupling: `ACKNOWLEDGED / DEFERRED`; revisit before broad enablement if measured write QPS/latency/contention suggests material impact.
5. Wrangler declarative `exports` migration path: `ACKNOWLEDGED / DEFERRED` until deliberate toolchain upgrade.

## NEXT

1. Obtain independent full code/diff review of the D1 telemetry correction and staging migration/deployment evidence.
2. Do not run another semantic request pair during that review.
3. If the code/diff is `ACCEPTED`, record the acceptance in the main engineering thread.
4. Only then prepare a new, separately reviewed retry authorization packet.
5. Any future retry still requires fresh human controlled-traffic confirmation, a D1-backed telemetry baseline, at most one authorized near-concurrent pair, and the previously locked mechanical success/stop criteria.
6. Production D1 migration and production semantic enablement remain separate later decisions.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Production implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Pacing correction review: `docs/reviews/2026-09-11-d016-pacing-correction-review.md`
- Pacing correction implementation: `docs/architecture/p05-production-retrieval-pacing-correction.md`
- Pacing correction code-review acceptance: `docs/reviews/2026-09-11-d016-pacing-correction-code-review-acceptance.md`
- Retry preparation: `docs/architecture/p05-production-retrieval-retry-preparation.md`
- Controlled semantic smoke incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`
- Telemetry atomicity architecture: `docs/architecture/p05-research-telemetry-atomicity-correction.md`
- Telemetry atomicity reviewer follow-up: `docs/reviews/2026-09-11-d016-telemetry-atomicity-review.md`
- Telemetry atomicity implementation: `docs/architecture/p05-research-telemetry-atomicity-implementation.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
