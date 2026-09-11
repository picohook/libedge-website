# P0.5 / D-016 — Research telemetry atomicity implementation

Date: 2026-09-11
Status: `IMPLEMENTED / FLAG OFF / RETRY NOT AUTHORIZED`

## Scope

This record implements the accepted telemetry-atomicity correction only. It does not reopen D-016 relevance, P0.5, H/RRF, Vectorize, fallback semantics, cache policy or production enablement.

## Schema

Migration `0048_research_telemetry_counters.sql` creates:

- `date_utc TEXT NOT NULL`;
- `metric TEXT NOT NULL`;
- `value INTEGER NOT NULL DEFAULT 0 CHECK(value >= 0)`;
- `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`;
- primary key `(date_utc, metric)`.

Staging migration run `34569103893` completed successfully after the one-shot runner was hardened to use the repository's own installed Wrangler. The run passed list, apply and table-verification steps. The temporary one-shot workflow was removed afterward. Production migration was not applied.

## Runtime implementation

`backend/src/research/telemetry.js`

- replaces KV read-modify-write counters with D1 atomic UPSERTs;
- keeps `RESEARCH_TELEMETRY_METRICS` as the single allowlist;
- adds `recordResearchMetrics(...)` for event-level multi-counter batches;
- keeps `recordResearchMetric(...)` as the single-counter wrapper;
- keeps semantic charged-cost/credit aggregation content-free;
- reads current-day snapshots from D1 while filtering against the shared allowlist;
- adds scheduled pruning so only the current UTC day plus seven prior UTC-day buckets are retained.

`backend/src/research/router.js`

- records semantic success as one terminal event batch containing attempt, success, pacing wait, provider latency, valid-empty when applicable, charged-response/cost/credits;
- records semantic failure as one terminal event batch containing attempt, applicable wait/latency and exactly the applicable failure category;
- records successful lexical fallback as attempt + success in one batch;
- records failed lexical fallback as attempt only;
- leaves retrieval/fallback/relevance behavior unchanged.

`backend/src/worker.js`

- adds scheduled telemetry pruning alongside the existing privacy R2 purge task.

## Tests

Required A-I coverage is present:

- A — concurrent same-metric exact increment;
- B — concurrent mixed positive deltas;
- C — allowlist-only persistence/read surface;
- D — privacy/content exclusion;
- E — UTC-day isolation;
- F — existing system-health auth/exact-allowlist/privacy tests;
- G — existing 1499/1500ms semantic pacing tests;
- H — full quality gate;
- I — concurrent cross-metric invariant (`semantic_successes <= semantic_attempts`, all-success case equals N/N).

A retention-prune test also verifies that rows older than the retained eight UTC-day buckets are deleted.

## CI evidence

CI run `34569559519` on commit `d64b0faac9fe2791ae65930ab5bae4120d0079a1`:

- syntax PASS;
- lint PASS;
- 23 test files PASS;
- 98 tests PASS;
- staging Wrangler dry-run PASS;
- dry-run flag evidence: `RESEARCH_SEMANTIC_PRIMARY_ENABLED ("false")`;
- build PASS.

A later deploy-trigger commit `1fe5c50945e17038059e0926a1a59e5320232364` changed only a comment in the already-tested telemetry runtime. CI run `34569629908` also completed SUCCESS.

## Flag-OFF staging deployment

Deploy Workers run `34569629970`, head `1fe5c50945e17038059e0926a1a59e5320232364`:

- Quality gate: PASS;
- Deploy backend to staging: PASS;
- Deploy backend to production: SKIPPED;
- staging binding explicitly showed `RESEARCH_SEMANTIC_PRIMARY_ENABLED ("false")`;
- Worker version: `de70736e-8851-45b8-aed1-99e25013aa19`.

No semantic smoke/retry occurred after this deployment.

## Review boundary

This implementation is ready for independent code/diff review only.

It does NOT authorize:

- staging semantic flag ON;
- another semantic request pair;
- production migration or production flag changes;
- broad production enablement;
- relevance retuning;
- H/RRF;
- Vectorize.

A later live retry still requires independent code/diff acceptance, separate retry authorization and fresh human traffic-isolation confirmation.
