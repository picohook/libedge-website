# P0.5 / D-016 — Research telemetry atomicity correction

Date: 2026-09-11
Status: `IMPLEMENTATION AUTHORIZED / SEMANTIC RETRY NOT AUTHORIZED`

## Scope

This correction addresses the live staging telemetry inconsistency observed during the controlled semantic retry. It does **not** reopen D-016 relevance, P0.5 holdouts, H/RRF, Vectorize, cache policy, fallback semantics, or production enablement.

The semantic-primary feature flag remains OFF while this correction is implemented and reviewed.

## Observed incident

PRE telemetry before the controlled near-concurrent retry included:

- `semantic_attempts = 1`
- `semantic_successes = 1`
- `semantic_429 = 1`
- `semantic_pacing_wait_ms_total = 1000`
- `semantic_charged_responses = 1`
- `semantic_cost_microusd_total = 1000`
- `semantic_credits_total = 10`
- `lexical_fallback_attempts = 1`
- `lexical_fallback_successes = 1`

The controlled retry then returned two uncached HTTP `200` responses, both with `retrievalSource="semantic"` and 10 results. POST telemetry nevertheless showed `semantic_attempts = 2` and `semantic_successes = 3`.

Therefore the live semantic responses and the aggregate attempt count were inconsistent. The retry is not classified PASS.

## Root cause

`backend/src/research/telemetry.js` currently implements each metric increment as a KV read-modify-write sequence:

1. `RATE_LIMIT_KV.get(metricKey)`
2. `current + amount`
3. `RATE_LIMIT_KV.put(metricKey, next)`

Concurrent requests can read the same prior value and overwrite one another. This is a classic lost-update race.

## Storage design comparison

### Option A — keep KV and add locking/CAS

Rejected.

The current Workers KV interface does not provide the simple per-key atomic increment primitive required here. Building application-level locking on top of KV would add a second distributed-coordination mechanism, complicate failure handling, and still be a poor fit for exact counters.

### Option B — single global telemetry Durable Object

Not selected.

A dedicated DO could serialize counter mutations correctly, and if a DO were chosen it would have to be **separate from `OpenAlexSemanticPacer`**. Pacing is a functionally critical availability/safety control while telemetry is best-effort observability; coupling both workloads to the same object would create an unnecessary shared queue and failure domain.

However, routing every research telemetry mutation — including ordinary lexical traffic such as `research_requests` — through one global DO would make that object a system-wide serialization point. Cloudflare's own current Durable Objects guidance warns against a single global DO for global counters because it can become a bottleneck. This is disproportionate for small atomic counter updates.

### Option C — D1 atomic counter table

**Selected for this correction.**

D1 already exists as `env.DB` in local, staging and production. A single SQL statement can atomically increment a row using SQLite/D1 semantics, for example:

```sql
INSERT INTO research_telemetry_counters (date_utc, metric, value, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(date_utc, metric)
DO UPDATE SET
  value = research_telemetry_counters.value + excluded.value,
  updated_at = CURRENT_TIMESTAMP;
```

This removes the application-level read-modify-write race without introducing a custom request-serialization service or a new binding.

D1 `batch()` may be used when one terminal research event needs several metric increments to commit together. D1 documents that batched statements execute sequentially and transactionally.

## D1 failure-domain decision

For the immediate correction, use a **separate table in the existing `env.DB`**, not auth/admin tables and not a new runtime-DDL path.

Rationale:

- no new Cloudflare resource ID/binding is required;
- current D1 migration and rollback procedures already cover both staging and production databases;
- telemetry writes remain best-effort and must never change retrieval/fallback behavior;
- research search already has a protected user rate limit, and this staging correction is not broad production enablement.

Accepted trade-off: telemetry writes share the underlying D1 database failure/resource domain with core application data. This is explicitly acknowledged, not ignored.

A **dedicated telemetry D1 binding/database** becomes a required architecture revisit before broad production enablement if observed write QPS/latency, D1 contention, or capacity modelling shows that telemetry can materially affect core DB operations. It can also be adopted earlier if provisioning simplicity is no longer a concern.

## Retention

The current KV counters expire automatically after roughly eight UTC-day boundaries. The D1 design must preserve equivalent data-minimization behavior.

The correction therefore includes scheduled pruning of telemetry rows whose `date_utc` has crossed the same retention boundary. Runtime request handlers must not create/alter schema.

## Event-level consistency

The incident exposed not only a same-metric lost update but also a cross-metric impossible state (`semantic_successes > semantic_attempts`).

Where multiple counters describe one terminal research event, the implementation should prefer a single atomic D1 batch through a shared `recordResearchMetrics(...)` primitive rather than unrelated independent writes.

In particular:

- semantic success terminal event: increment `semantic_attempts` + `semantic_successes` and applicable wait/latency/cost/credit/valid-empty deltas coherently;
- semantic failure terminal event: increment `semantic_attempts` + exactly the applicable failure category and applicable pacing delta coherently;
- lexical fallback success may batch `lexical_fallback_attempts` + `lexical_fallback_successes` when the attempt succeeds; a failed fallback records only its attempt;
- `research_requests` remains a standalone exact counter.

This preserves the operational meaning of aggregate counters while closing the race observed in staging.

## Privacy invariants

1. `RESEARCH_TELEMETRY_METRICS` / `ALLOWED_METRICS` remains the single allowlist.
2. Persist only allowlisted metric name, non-negative numeric delta/value, UTC date and non-content operational timestamp needed for storage/retention.
3. Never persist query text, normalized query, user ID/email, topic, DOI/title, result content, raw provider response/error body, or research-interest content.
4. `readResearchTelemetrySnapshot` / system-health continues to expose only allowlisted aggregate numeric fields.
5. Telemetry failure never changes retrieval result, fallback choice, relevance behavior, or HTTP success semantics for an otherwise valid research request.
6. Production and staging semantic-primary flags remain OFF during implementation/review.
7. No semantic provider retry/smoke is part of this correction.

## Required tests

### A — concurrent same-metric increment

Start from zero, issue at least two concurrent increments to one metric, and assert the final value equals the exact arithmetic sum.

### B — mixed deltas

Apply concurrent positive deltas to one metric and assert the exact final sum.

### C — allowlist

Unsupported metric names cannot be persisted or returned.

### D — privacy surface

Persisted statements/records and serialized telemetry interfaces contain no query/user/topic/title/DOI/result/provider-body fields.

### E — UTC day separation

Increments for distinct UTC dates remain isolated.

### F — system-health regression

Existing super-admin authorization, exact shared allowlist and privacy tests remain PASS.

### G — semantic pacing regression

Existing `1499/1500 ms` pacing tests remain PASS; telemetry correction cannot weaken or bypass the pacing gate.

### H — full quality gate

Existing test suite, lint/syntax/build and staging Wrangler dry-run remain PASS.

### I — cross-metric invariant

Simulate N concurrent semantic terminal-success events using the real telemetry primitive and verify after all operations complete:

- `semantic_successes <= semantic_attempts` always;
- for an all-success synthetic batch, `semantic_successes === semantic_attempts === N`;
- no lost update occurs in either metric.

This directly tests the invariant that failed in the live incident.

## Deployment order

Because this correction adds a D1 table, schema must exist in staging before relying on the new writer.

1. Add canonical migration for the telemetry counter table and retention-supporting index/shape as needed.
2. Apply the migration to **staging only** using the existing D1 migration workflow.
3. Implement the D1-backed telemetry writer/reader and retention prune path with semantic-primary still OFF.
4. Run CI and deploy flag-OFF to staging.
5. Obtain independent code/diff review.
6. Only after that review may a separate retry-preparation authorization be requested.

Production D1 migration/application and production semantic enablement remain separate later decisions.

## Retry boundary

This correction does **not** authorize another semantic retry.

A future retry still requires the previously locked sequence: accepted code/diff review, flag-OFF staging deployment and baseline verification, separate retry authorization, fresh human controlled-traffic confirmation, then at most one near-concurrent controlled pair with before/after telemetry deltas.
