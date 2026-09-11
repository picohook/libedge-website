# D-016 — Telemetry atomicity correction code/diff review request

Date: 2026-09-11
Status: `ACTIVE — REVIEW REQUEST / RETRY NOT AUTHORIZED`

Packet ID: `P05-D016-TELEMETRY-ATOMICITY-CODE-REVIEW-2026-09-11`

## Review scope

Independent review of the D1-backed exact research telemetry correction after the live KV lost-update incident.

This review does not authorize or request another semantic provider smoke. Semantic-primary remains OFF in staging and production.

## Exact version context

Runtime/test/docs review range:

- base: `8a018d6e6c522d863a2571c007653aa9fe0b8f89`
- head: `390b6edafc055c00de766956ea0aaa63a936e7a3`

Reviewer must refresh repository state, checkout/switch to the intended commit/ref, and inspect the exact base→head diff. A statement that the commits merely exist is insufficient; verification must state that fresh contents/diff were inspected.

The range changes exactly these files:

- `backend/src/research/router.js`
- `backend/src/research/telemetry.js`
- `backend/src/worker.js`
- `docs/architecture/p05-research-telemetry-atomicity-implementation.md`
- `docs/current-state.md`
- `test/backend/research-router.test.js`
- `test/backend/research-telemetry.test.js`
- `test/backend/system-health-research-telemetry.test.js`
- `test/backend/system-health.test.js`

Migration raw material predates the base above and must be inspected separately:

- file: `migrations/0048_research_telemetry_counters.sql`
- migration-add commit: `c9bb2864211c0e3da60c4e7c2d52e9447f56f19d`

## Canonical architecture source

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

Architecture canonicalization commit:

`edeef977e4e290b6a124d27f8f5b27242daf5e58`

Reviewer-requested modifications already incorporated there:

1. explicit KV vs global telemetry DO vs D1 comparison;
2. explicit cross-metric invariant Test I.

Selected design is D1 exact counters in a dedicated table on existing `env.DB`. A single global telemetry DO was not selected. A dedicated telemetry D1 database/binding remains a pre-broad-enable revisit if measured load/contention evidence warrants isolation.

## Implementer summary

### Schema

`research_telemetry_counters` contains only:

- `date_utc`;
- allowlisted `metric`;
- non-negative numeric `value`;
- non-content `updated_at` timestamp;
- primary key `(date_utc, metric)`.

### Writer

`recordResearchMetrics(...)` uses D1 atomic UPSERT statements:

```sql
INSERT INTO research_telemetry_counters (date_utc, metric, value, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(date_utc, metric)
DO UPDATE SET
  value = research_telemetry_counters.value + excluded.value,
  updated_at = CURRENT_TIMESTAMP
```

Multiple counters for one terminal event are submitted through `env.DB.batch(...)` when available.

`recordResearchMetric(...)` remains the single-counter wrapper.

### Event-level accounting

Semantic success batches:

- `semantic_attempts`;
- `semantic_successes`;
- pacing-wait delta;
- provider-latency delta;
- `semantic_valid_empty` when applicable;
- charged-response/cost/credit deltas when present.

Semantic failure batches:

- `semantic_attempts`;
- pacing-wait/latency where applicable;
- exactly the applicable failure category.

Lexical fallback success batches attempt + success; failed fallback records attempt only.

### Reader and retention

`readResearchTelemetrySnapshot(...)` reads only current UTC-day D1 rows and filters them against the same `RESEARCH_TELEMETRY_METRICS` allowlist.

`pruneResearchTelemetry(...)` is invoked by the scheduled Worker path and retains the intended current UTC day plus seven previous UTC-day buckets.

### Privacy / failure semantics

No query text, normalized query, user ID/email, topic, DOI/title, result body, raw provider body or research-interest content is persisted.

Telemetry remains best-effort: a telemetry failure cannot change an otherwise valid retrieval/fallback result.

## Staging migration evidence

Migration run: `34569103893`

Result:

- list pending staging migrations: PASS;
- apply staging migrations: PASS;
- verify telemetry table: PASS.

The temporary one-shot workflow was removed afterward.

Production migration was not applied.

## Test / CI evidence

CI run `34569559519`:

- syntax PASS;
- lint PASS;
- `23` test files PASS;
- `98` tests PASS;
- staging Wrangler dry-run PASS;
- semantic-primary flag in dry-run: `false`;
- build PASS.

Required A-I coverage includes:

A. concurrent same-metric exact increment;
B. concurrent mixed deltas;
C. allowlist-only persistence/read;
D. privacy/content exclusion;
E. UTC-day isolation;
F. system-health auth/allowlist/privacy regressions;
G. existing `1499/1500 ms` semantic pacing regression;
H. full quality gate;
I. concurrent cross-metric invariant, all-success case exactly attempts=N and successes=N, with successes<=attempts.

Retention pruning also has a test.

A later comment-only deploy-trigger commit `1fe5c50945e17038059e0926a1a59e5320232364` changed no runtime behavior beyond the already-tested implementation. CI run `34569629908`: SUCCESS.

## Flag-OFF staging deployment evidence

Deploy Workers run `34569629970`, head `1fe5c50945e17038059e0926a1a59e5320232364`:

- Quality gate: PASS;
- staging deploy: PASS;
- production deploy: SKIPPED;
- deployed staging flag: `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- Worker version: `de70736e-8851-45b8-aed1-99e25013aa19`.

No semantic retry/smoke occurred after deployment.

## Review questions

1. Does the D1 UPSERT remove the lost-update race that caused the live incident?
2. Does `recordResearchMetrics(...)` preserve exact same-metric and cross-metric accounting under concurrent requests?
3. Is event-level batching correctly placed in semantic success/failure and lexical fallback paths without changing retrieval behavior?
4. Is the shared allowlist still the single source of metric names for write/read/system-health exposure?
5. Are the persisted D1 fields and system-health output privacy-safe?
6. Is telemetry failure still best-effort and non-interfering with retrieval/fallback behavior?
7. Does retention pruning preserve the intended eight UTC-day buckets?
8. Are Tests A-I sufficient, especially Test I reproducing the invariant that failed live?
9. Was migration-first sequencing correctly followed for staging?
10. Is the existing-core-D1 failure-domain trade-off sufficiently bounded for staging while remaining a required pre-broad-enable revisit if load/latency/contention evidence warrants it?
11. Does the evidence support progression to a later, separately reviewed retry-preparation stage only?

## Required reviewer output

Return exactly one proposal classification:

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

Also report any material `OUT-OF-SCOPE FINDING` separately.

## Decision boundary

`ACCEPTED` authorizes only main-thread recording of the code/diff acceptance and progression to **retry preparation**.

It does not authorize:

- staging semantic flag ON;
- another live semantic request;
- production D1 migration;
- production semantic enablement;
- broad production enablement;
- relevance retuning;
- H/RRF;
- Vectorize.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `P05-D016-TELEMETRY-ATOMICITY-CODE-REVIEW-2026-09-11`
Branch: `staging`
Runtime/test/docs range: `8a018d6e6c522d863a2571c007653aa9fe0b8f89 -> 390b6edafc055c00de766956ea0aaa63a936e7a3`

RAW MATERIALS

[x] Exact base→head version context supplied and reproducible.
[x] All nine files changed in the runtime/test/docs range explicitly enumerated.
[x] Migration file and its separate creation commit explicitly supplied.
[x] Canonical architecture record and commit supplied.
[x] Canonical implementation record supplied.
[x] Current-state record included in the review range.
[x] Staging migration run ID and exact pass claims supplied.
[x] CI run IDs and exact pass counts supplied.
[x] Flag-OFF staging deployment run and Worker version supplied.
[x] Production SKIPPED boundary supplied.
[x] Reviewer explicitly instructed to refresh/checkout/diff and inspect fresh contents, not merely commit existence.

CONSISTENCY

[x] No false claim that material is attached when it is not.
[x] Implementer summary is separated from repository raw material references.
[x] Repository raw material is authoritative over this summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.
[x] No claim that another semantic retry occurred.
[x] No claim that the telemetry finding is already closed.
[x] Semantic-primary remains OFF.

RESULT: COMPLETE
