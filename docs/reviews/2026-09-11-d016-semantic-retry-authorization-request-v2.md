# D-016 — Controlled Semantic Retry Authorization Review v2

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Request authorization for exactly one controlled staging semantic-primary retry after:

- pacing correction to 1500 ms;
- D1 atomic telemetry correction;
- independent code/diff review;
- reviewer-required flag-OFF live D1 concurrency verification PASS.

This request does not authorize production changes or repeated retries.

## Current boundary

- staging semantic-primary: OFF;
- production semantic-primary: OFF;
- production D1 migration: NOT applied;
- no new semantic request has occurred since the D1 live verification;
- no relevance evaluation/retuning is proposed.

## Reviewer-required D1 live verification — PASS

PRE:

- research_requests = 0
- semantic_attempts = 0
- semantic_successes = 0
- semantic_429 = 0

Execution:

- five distinct ordinary non-sensitive authenticated research requests;
- near-concurrent programmatic dispatch with Promise.all;
- semantic-primary OFF throughout.

Observed responses:

- 5/5 HTTP 200;
- 5/5 retrievalSource = lexical;
- 5/5 cached = false;
- 5/5 resultCount = 10.

POST:

- research_requests = 5
- semantic_attempts = 0
- semantic_successes = 0
- semantic_429 = 0.

Mechanical result:

- exact research_requests delta = +5;
- semantic counters unchanged;
- no lost update observed;
- no relevance judgment performed.

Canonical record:

`docs/architecture/p05-production-retrieval-retry-preparation.md`

Commit containing PASS record:

`e7ee7cf808851ca3c9d2680b317acbdae83ab9da`

Current state commit:

`71bce4ae6c448ab9f4f781f64ec4b9e16b3e2ddc`

## Proposed single retry procedure

Only if this review returns ACCEPTED:

1. obtain a fresh human confirmation that the staging window contains controlled test traffic only and no ordinary real end-user research traffic is expected;
2. capture a fresh super-admin D1-backed telemetry baseline;
3. change staging only: RESEARCH_SEMANTIC_PRIMARY_ENABLED=false -> true;
4. production remains false;
5. deploy staging;
6. from one authenticated staging browser session, issue exactly two distinct ordinary non-sensitive queries near-concurrently using Promise.all or equivalent back-to-back dispatch;
7. inspect only operational metadata;
8. capture the same aggregate telemetry counters immediately afterward;
9. if any stop condition occurs, rollback staging flag to false and redeploy before further investigation.

## Locked semantic retry success criteria

All must be true:

1. both requests return HTTP success;
2. valid semantic successes identify retrievalSource = semantic unless a genuinely independent objective provider failure occurs;
3. semantic_pacing_wait_ms_total delta > 0;
4. semantic_429 delta = 0;
5. semantic attempts/successes/cost/credits are internally consistent with the observed pair;
6. no query/user/topic/result content appears in telemetry;
7. no browser-visible/runtime blocker occurs.

## Stop conditions

Any of the following means STOP / INVESTIGATE:

- semantic_pacing_wait_ms_total delta = 0;
- semantic_429 delta > 0;
- pacing gate unavailable;
- unexpected fallback without objective availability failure;
- runtime/browser error;
- D1 telemetry cannot be read reliably before/after;
- cross-metric accounting becomes internally inconsistent;
- staging traffic isolation can no longer be confirmed.

No automatic retry is permitted after a stop condition.

## Privacy / relevance boundary

The retry is mechanical/operational only.

It must not:

- score relevance;
- compare S against L quality;
- reuse frozen P0.5 holdout labels;
- retune query content based on results;
- persist query text in operational records;
- expose user research interests.

## Review questions

1. Does the exact +5 live D1 result adequately satisfy your required modification concerning real D1 concurrency evidence?
2. Is the project now justified in progressing to exactly one separately controlled semantic retry?
3. Are the before/after D1 telemetry criteria sufficient to detect both pacing failure and telemetry inconsistency?
4. Are the stop conditions conservative enough?
5. Does the procedure preserve the production-off and no-relevance-retuning boundaries?
6. If accepted, may the main engineering thread proceed to exactly one controlled staging semantic retry after fresh human traffic-isolation confirmation?

## Required classification

Return exactly one:

ACCEPTED
ACCEPTED WITH MODIFICATION
REJECTED

Also report any material OUT-OF-SCOPE FINDING.

## Decision boundary

ACCEPTED authorizes exactly one controlled staging semantic retry, subject to fresh human traffic-isolation confirmation immediately before flag ON.

It does NOT authorize:

- production migration;
- production semantic enablement;
- repeated retry attempts;
- relevance evaluation/retuning;
- H/RRF;
- Vectorize;
- weakening 1500 ms pacing;
- content-dependent fallback;
- privacy relaxation.

## Reviewer packet completeness attestation

Packet ID:
P05-D016-CONTROLLED-SEMANTIC-RETRY-AUTH-V2-2026-09-11

Branch:
staging

RAW MATERIALS

[x] Canonical retry-preparation file accessible.
[x] Exact live D1 PRE values included.
[x] Exact five-request response pattern included.
[x] Exact live D1 POST values included.
[x] PASS commit supplied.
[x] Current-state commit supplied.
[x] Semantic-primary current boundary stated as OFF.
[x] Reviewer instructed to inspect fresh repository contents if desired.

CONSISTENCY

[x] No claim that semantic retry already occurred.
[x] No claim that staging flag is ON.
[x] Production remains explicitly excluded.
[x] Success and stop criteria are predeclared.
[x] Relevance evaluation is explicitly prohibited.
[x] Raw canonical repository material is authoritative over this summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.

RESULT: COMPLETE
