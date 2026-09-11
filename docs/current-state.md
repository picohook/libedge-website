# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The first controlled semantic-primary staging smoke exposed a live semantic `429`; pacing was corrected from `1000 ms` to `1500 ms` and independently accepted.

A later controlled retry returned two uncached semantic HTTP `200` responses but exposed a non-atomic KV telemetry lost-update defect. That retry is **NOT PASS**.

The telemetry defect has now been corrected with D1 atomic counters, migration-first sequencing was followed, code/diff review returned **ACCEPTED WITH MODIFICATION**, and the reviewer-required live semantic-OFF D1 concurrency verification has now **PASSED** with an exact `research_requests +5` under five near-concurrent lexical requests and no semantic-counter movement.

The semantic-primary flag remains OFF in staging and production.

The project is now at a **separate semantic retry authorization review gate**. No new semantic retry is yet authorized.

## Completed telemetry atomicity correction

Canonical architecture:

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

Canonical implementation:

`docs/architecture/p05-research-telemetry-atomicity-implementation.md`

Independent code/diff review acceptance:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-code-review-acceptance.md`

Reviewer classification: **ACCEPTED WITH MODIFICATION**.

Accepted properties:

- exact counters moved from KV read-modify-write to D1 atomic UPSERTs;
- dedicated `research_telemetry_counters` table on existing staging `env.DB`;
- single shared `RESEARCH_TELEMETRY_METRICS` allowlist;
- semantic success/failure and lexical fallback accounting structurally preserves `semantic_successes <= semantic_attempts`;
- telemetry remains best-effort and does not alter retrieval/fallback behavior;
- no global telemetry Durable Object;
- production migration not applied;
- semantic-primary remains OFF.

## Staging D1 migration / CI / deploy evidence

Migration:

`migrations/0048_research_telemetry_counters.sql`

Staging migration run `34569103893`:

- list pending migrations: PASS;
- apply staging migrations: PASS;
- verify `research_telemetry_counters` table: PASS.

CI run `34569559519`:

- syntax PASS;
- lint PASS;
- `23` test files PASS;
- `98` tests PASS;
- staging Wrangler dry-run PASS;
- dry-run showed `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- build PASS.

Later CI run `34569629908`: SUCCESS.

Deploy Workers run `34569629970`:

- Quality gate: PASS;
- Deploy backend to staging: PASS;
- Deploy backend to production: SKIPPED;
- staging binding showed `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- Worker version: `de70736e-8851-45b8-aed1-99e25013aa19`.

## Reviewer-required live semantic-OFF D1 concurrency verification — PASS

Canonical retry-preparation record:

`docs/architecture/p05-production-retrieval-retry-preparation.md`

PRE D1 telemetry snapshot:

- date: `2026-09-11`
- `research_requests = 0`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`

Five distinct ordinary non-sensitive authenticated research requests were fired programmatically near-concurrently with `Promise.all` while semantic-primary remained OFF.

All five responses were:

- HTTP `200`;
- `retrievalSource="lexical"`;
- `cached=false`;
- `resultCount=10`.

POST D1 telemetry snapshot:

- date: `2026-09-11`
- `research_requests = 5`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`.

Mechanical result:

- exact `research_requests` delta = `+5`;
- semantic counters unchanged;
- no lost update observed under the five-request near-concurrent lexical burst;
- no relevance judgment was made.

This fills the specific methodological gap identified by the independent reviewer: unit tests used a synchronous in-memory fake D1 and therefore could not alone prove real D1 concurrency scheduling.

## Telemetry privacy boundary

Persisted telemetry remains restricted to:

- UTC date;
- allowlisted metric name;
- non-negative numeric aggregate value;
- non-content operational update timestamp.

It does not store or expose query text, normalized query, user ID/email, topic, DOI/title, result body, raw provider error body, or research-interest content.

## Locked semantic retry success criteria

A future retry may be considered successful only if all are true:

1. both requests return HTTP success;
2. valid semantic successes report `retrievalSource="semantic"` unless a genuinely independent objective provider failure occurs;
3. `semantic_pacing_wait_ms_total` delta is `> 0`;
4. `semantic_429` delta is exactly `0`;
5. attempts/successes/cost/credits are internally consistent with the observed pair;
6. no content-bearing fields appear in telemetry;
7. no browser/runtime blocker occurs.

Any stop condition requires rollback and a fresh review cycle; no automatic retry is permitted.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until a separately authorized retry.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain globally paced through the dedicated pacing Durable Object at `1500 ms` minimum spacing.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second`.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## Open findings

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction: `OPEN`; closure still requires a valid controlled semantic retry.
2. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk: `ACKNOWLEDGED / DEFERRED`.
3. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race: `OPEN / CORRECTION ACCEPTED WITH MODIFICATION / LIVE FLAG-OFF D1 CONCURRENCY VERIFICATION PASS`; final operational closure still depends on a valid future semantic retry using the corrected D1 counters.
4. Shared-core-D1 telemetry failure-domain coupling: `ACKNOWLEDGED / DEFERRED`; revisit before broad enablement if measured write QPS/latency/contention suggests material impact.
5. Wrangler declarative `exports` migration path: `ACKNOWLEDGED / DEFERRED` until deliberate toolchain upgrade.

## NEXT

1. Submit a separate semantic retry authorization packet to the independent reviewer.
2. Do not enable staging semantic-primary before that packet is accepted.
3. If accepted, obtain a fresh human confirmation that staging carries controlled test traffic only.
4. Capture a fresh D1-backed super-admin semantic telemetry baseline.
5. Enable semantic-primary in staging only; production remains OFF.
6. Execute at most one authorized near-concurrent two-query semantic pair.
7. Capture POST telemetry and enforce the locked mechanical success/stop criteria.
8. Roll back immediately on any stop condition.
9. Production D1 migration and production semantic enablement remain separate later decisions.

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
