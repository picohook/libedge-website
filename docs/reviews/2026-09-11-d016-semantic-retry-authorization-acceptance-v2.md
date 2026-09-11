# D-016 — Controlled Semantic Retry Authorization v2 — Acceptance

Status: `ACTIVE`
Date: 2026-09-11

## Reviewer classification

`ACCEPTED`

The independent reviewer verified the three supplied commits and confirmed that the reviewer-required live semantic-OFF D1 concurrency verification genuinely exercised the same deployed D1 atomic counter path used by semantic telemetry.

## Verified live D1 concurrency evidence

PRE snapshot:

- `research_requests = 0`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`

Five distinct ordinary non-sensitive authenticated staging research requests were fired near-concurrently with `Promise.all` while semantic-primary remained OFF.

Observed responses:

- 5/5 HTTP `200`
- 5/5 `retrievalSource="lexical"`
- 5/5 `cached=false`
- 5/5 `resultCount=10`

POST snapshot:

- `research_requests = 5`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`

Mechanical result:

- exact `research_requests` delta = `+5`
- no semantic-counter movement
- no lost update observed under the live five-request near-concurrent lexical burst
- no relevance judgment was made

The reviewer explicitly accepted this as sufficient live evidence to fill the methodological gap left by the synchronous in-memory fake D1 used in unit tests.

## Authorization granted

Exactly one controlled staging semantic retry is authorized, subject to all of the following immediately before execution:

1. fresh human confirmation that staging contains controlled test traffic only and no ordinary real end-user research traffic is expected;
2. fresh D1-backed super-admin semantic telemetry baseline;
3. staging-only `RESEARCH_SEMANTIC_PRIMARY_ENABLED=true`;
4. production remains `false`;
5. exactly two distinct ordinary non-sensitive near-concurrent queries;
6. immediate POST D1 telemetry capture;
7. `semantic_pacing_wait_ms_total` delta `> 0`;
8. `semantic_429` delta `= 0`;
9. attempts/successes/cost/credits internally consistent;
10. immediate rollback on any stop condition.

## Decision boundary

This acceptance authorizes only one controlled staging semantic retry after the fresh human traffic-isolation confirmation.

It does not authorize:

- production D1 migration;
- production semantic enablement;
- broad production rollout;
- relevance evaluation or retuning;
- H/RRF;
- Vectorize;
- repeated retry attempts after a stop condition.

Any stop condition requires rollback and a new review cycle.
