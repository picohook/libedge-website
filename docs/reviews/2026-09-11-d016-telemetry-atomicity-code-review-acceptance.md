# D-016 — Telemetry Atomicity Code/Diff Review Acceptance

Date: 2026-09-11
Status: `ACTIVE`

## Reviewer classification

**ACCEPTED WITH MODIFICATION**

The independent reviewer reported that GitHub API verification of the cited CI/deploy runs was rate-limited, but performed a fresh code-level inspection of the migration and the complete `telemetry.js`, `router.js`, and `worker.js` changes, including the cross-metric Test I.

## Accepted findings

The reviewer independently accepted the following implementation properties:

1. The D1 UPSERT removes the KV read-modify-write lost-update race structurally by replacing a multi-call get/put sequence with one atomic SQL mutation.
2. Router telemetry restructuring preserves the `semantic_successes <= semantic_attempts` invariant by recording attempts exactly once per semantic terminal event and success only on actual success.
3. Semantic success/failure and lexical fallback branches were found to batch the intended event-level counters without changing retrieval/fallback decisions.
4. `RESEARCH_TELEMETRY_METRICS` / `ALLOWED_METRICS` remains the single metric allowlist for persistence and read exposure.
5. The D1 table and system-health read surface remain aggregate-only and privacy-safe.
6. Telemetry failures remain best-effort and do not alter otherwise valid retrieval/fallback behavior.
7. Retention and migration-first sequencing were accepted.
8. Use of the existing core D1 is acceptable for this staging correction, with a dedicated telemetry D1 remaining an explicit pre-broad-enable revisit if measured load/latency/contention becomes material.
9. Progression to retry-preparation is allowed; no semantic retry, flag enablement, or production migration is authorized by this review.

## Required modification

The reviewer identified a methodological limitation in Test I: the fake D1 used by the unit test is backed by a synchronous in-memory JavaScript `Map`. Even when invoked through `Promise.all`, the fake does not contain an asynchronous yield point that can reproduce real D1 concurrency/transaction scheduling.

Therefore Test I validates the application's event-accounting logic, but cannot by itself prove the real staging D1 serializes near-concurrent increments without loss.

Before any semantic-primary flag enablement or semantic retry, retry preparation must add a **live, flag-OFF staging D1 concurrency verification** using ordinary lexical research requests from an authenticated staging browser session.

Required live verification properties:

- semantic-primary remains OFF throughout;
- production remains untouched;
- capture super-admin D1 telemetry immediately before and after;
- issue multiple distinct ordinary non-sensitive lexical requests programmatically near-concurrently (for example with `Promise.all`);
- use the exact number of requests as the expected `research_requests` delta;
- require no lost increment in the real D1-backed counter;
- do not perform relevance judgments or compare result quality;
- if the exact expected delta is not observed, stop and investigate; do not proceed to semantic retry authorization.

This live lexical-only verification is a prerequisite for the next semantic retry authorization packet.

## Authorization boundary

This review authorizes only:

- recording this acceptance in the main engineering/control-plane records;
- progressing to retry preparation;
- performing the required semantic-OFF lexical D1 concurrency verification as part of retry preparation.

It does **not** authorize:

- staging semantic-primary ON;
- a semantic provider retry/smoke;
- production D1 migration;
- production semantic enablement;
- relevance retuning, H/RRF, or Vectorize.
