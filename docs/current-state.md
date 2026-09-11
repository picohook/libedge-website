# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The first controlled semantic-primary staging smoke exposed a live semantic `429`; the pacing interval was corrected from `1000 ms` to `1500 ms` and independently accepted.

A later separately authorized controlled retry returned two uncached semantic HTTP `200` responses, but the telemetry counters were internally impossible (`semantic_successes` increased by two while `semantic_attempts` increased by one). That retry is **NOT PASS**. The semantic-primary flag is OFF in staging and production.

The KV lost-update telemetry defect was corrected with D1 atomic counters and deployed to staging with semantic-primary OFF. Independent code/diff review has now classified that correction **ACCEPTED WITH MODIFICATION**. The required modification is a live, semantic-OFF staging D1 concurrency verification using near-concurrent lexical requests before any future semantic retry may be authorized.

The project is therefore now at a **flag-OFF live D1 concurrency verification** gate. No semantic retry is authorized.

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

## Telemetry atomicity correction — IMPLEMENTED / ACCEPTED WITH MODIFICATION

Canonical architecture decision:

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

Reviewer follow-up that required explicit D1-vs-DO comparison and Test I:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-review.md`

Canonical implementation record:

`docs/architecture/p05-research-telemetry-atomicity-implementation.md`

Independent code/diff acceptance record:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-code-review-acceptance.md`

Reviewer classification: **ACCEPTED WITH MODIFICATION**.

Accepted implementation properties:

- exact telemetry counters moved from non-atomic KV read-modify-write to D1;
- dedicated table: `research_telemetry_counters` on existing `env.DB`;
- atomic SQL UPSERT per metric;
- `recordResearchMetrics(...)` batches multiple counters describing one terminal event;
- `RESEARCH_TELEMETRY_METRICS` remains the single allowlist;
- semantic success/failure and lexical fallback accounting preserves `semantic_successes <= semantic_attempts` by code structure;
- telemetry remains best-effort and does not alter retrieval/fallback behavior;
- no global telemetry Durable Object;
- if a telemetry DO is ever reconsidered, it must remain separate from `OpenAlexSemanticPacer`;
- a dedicated telemetry D1 database/binding remains a pre-broad-enable architecture revisit if load/latency/contention evidence warrants separation from core D1.

### Reviewer-required live verification

The reviewer identified one methodological limitation: Test I uses a synchronous in-memory fake D1 and therefore validates event-accounting logic but cannot reproduce real D1 transaction scheduling under concurrent requests.

Before any semantic-primary flag enablement, staging must therefore pass a real D1 concurrency check while semantic-primary remains OFF:

- capture super-admin D1 telemetry immediately before;
- issue five distinct ordinary non-sensitive authenticated lexical requests near-concurrently with `Promise.all` or equivalent;
- capture telemetry immediately after;
- require `research_requests` delta to equal exactly `5`;
- require all responses to remain lexical and successful;
- require no semantic-counter increase caused by this step;
- make no relevance judgment;
- if exact delta is not observed, STOP / INVESTIGATE and do not proceed to semantic retry authorization.

Canonical retry-preparation record containing this requirement:

`docs/architecture/p05-production-retrieval-retry-preparation.md`

## Staging migration / runtime evidence

Migration:

`migrations/0048_research_telemetry_counters.sql`

Staging migration run `34569103893`:

- list pending migrations: PASS;
- apply staging migrations: PASS;
- verify `research_telemetry_counters` table: PASS.

Production migration was **not** applied.

CI run `34569559519`:

- syntax PASS;
- lint PASS;
- `23` test files PASS;
- `98` tests PASS;
- staging Wrangler dry-run PASS;
- dry-run explicitly showed `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- build PASS.

Later CI run `34569629908`: SUCCESS.

Deploy Workers run `34569629970`:

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
3. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race: `OPEN / D1 CODE ACCEPTED WITH MODIFICATION`; closure/progression requires successful flag-OFF live D1 concurrency verification before semantic retry authorization.
4. Shared-core-D1 telemetry failure-domain coupling: `ACKNOWLEDGED / DEFERRED`; revisit before broad enablement if measured write QPS/latency/contention suggests material impact.
5. Wrangler declarative `exports` migration path: `ACKNOWLEDGED / DEFERRED` until deliberate toolchain upgrade.

## NEXT

1. With staging semantic-primary still OFF, capture a super-admin D1 telemetry baseline.
2. From the authenticated staging browser session, issue exactly five distinct ordinary non-sensitive lexical requests near-concurrently using `Promise.all` or equivalent.
3. Capture the post-burst D1 telemetry snapshot and require exact `research_requests +5` with no semantic-counter increase caused by the step.
4. If the lexical D1 verification is not exact, STOP / INVESTIGATE; do not request semantic retry authorization.
5. If it passes, record the evidence and prepare a separate reviewer/main-thread semantic retry authorization packet.
6. Do not enable staging semantic-primary until that separate authorization is accepted and a fresh human controlled-traffic confirmation is obtained.
7. Production D1 migration and production semantic enablement remain separate later decisions.

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
- Telemetry atomicity code-review acceptance: `docs/reviews/2026-09-11-d016-telemetry-atomicity-code-review-acceptance.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
