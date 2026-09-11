# D-016 — Controlled Semantic Retry v2 — Observed PASS Evidence

Status: `ACTIVE`

Date: 2026-09-11

## Scope

This record captures the observed mechanical outcome of the single reviewer-authorized controlled semantic-primary staging retry executed after:

- the 1500 ms pacing correction;
- D1 atomic telemetry correction;
- successful live semantic-OFF D1 concurrency verification;
- independent reviewer authorization for exactly one controlled retry;
- fresh human confirmation that the staging window contained controlled test traffic only.

This is not a production-enable decision and does not perform relevance evaluation.

## Authorization

Independent reviewer classification before execution:

`ACCEPTED`

Canonical authorization acceptance:

`docs/reviews/2026-09-11-d016-semantic-retry-authorization-acceptance-v2.md`

## Fresh human gate

Immediately before the retry window, the human gatekeeper confirmed:

> This staging retry window contains controlled test traffic only; ordinary real end-user research traffic is not expected.

## PRE D1-backed telemetry

Immediately before staging semantic-primary enablement:

- date UTC: `2026-09-11`
- `research_requests = 5`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`
- `semantic_pacing_wait_ms_total = 0`
- `semantic_charged_responses = 0`
- `semantic_cost_microusd_total = 0`
- `semantic_credits_total = 0`
- `lexical_fallback_attempts = 0`
- `lexical_fallback_successes = 0`

## Staging-only enablement

Enablement commit:

`dbdc8c4cc0469d481e80f594c4ad992673081f81`

Change:

- staging `RESEARCH_SEMANTIC_PRIMARY_ENABLED`: `false -> true`
- production remained `false`

GitHub Actions:

- CI run `34574860041`: `SUCCESS`
- Deploy Workers run `34574859960`: `SUCCESS`
- Quality gate: `SUCCESS`
- Deploy backend to staging: `SUCCESS`
- Deploy backend to production: `SKIPPED`

## Controlled near-concurrent pair

Two distinct ordinary non-sensitive authenticated staging research requests were issued programmatically near-concurrently using `Promise.all`.

Observed request results:

Request 1:

- HTTP `200`
- `retrievalSource = "semantic"`
- `cached = false`
- `resultCount = 10`
- browser elapsed approximately `4094 ms`

Request 2:

- HTTP `200`
- `retrievalSource = "semantic"`
- `cached = false`
- `resultCount = 10`
- browser elapsed approximately `3431 ms`

Total browser elapsed approximately `4096 ms`.

No relevance scoring, labeling, S-vs-L comparison, query retuning, or result-quality judgment was performed.

## POST D1-backed telemetry

Immediately after the pair:

- `research_requests = 7`
- `semantic_attempts = 2`
- `semantic_successes = 2`
- `semantic_429 = 0`
- `semantic_pacing_wait_ms_total = 1500`
- `semantic_charged_responses = 2`
- `semantic_cost_microusd_total = 2000`
- `semantic_credits_total = 20`
- `lexical_fallback_attempts = 0`
- `lexical_fallback_successes = 0`

## Mechanical deltas

Relative to PRE:

- `research_requests`: `+2`
- `semantic_attempts`: `+2`
- `semantic_successes`: `+2`
- `semantic_429`: `+0`
- `semantic_pacing_wait_ms_total`: `+1500`
- `semantic_charged_responses`: `+2`
- `semantic_cost_microusd_total`: `+2000`
- `semantic_credits_total`: `+20`
- `lexical_fallback_attempts`: `+0`
- `lexical_fallback_successes`: `+0`

## Locked success criteria check

All preregistered mechanical success criteria were observed:

1. both requests returned HTTP success — PASS;
2. both valid responses identified `retrievalSource="semantic"` — PASS;
3. pacing wait total increased by `>0` — PASS (`+1500`);
4. `semantic_429` delta was exactly `0` — PASS;
5. attempts/successes/cost/credits were internally consistent — PASS;
6. no content-bearing fields were exposed by aggregate telemetry — PASS by unchanged allowlisted telemetry surface;
7. no browser/runtime blocker was observed — PASS.

Observed result classification in the main engineering thread:

**PASS — pending independent closure review.**

The record deliberately does not itself close reviewer-derived open findings until independent review returns.

## Immediate post-retry disable

After the single authorized pair, staging semantic-primary was disabled again.

Disable commit:

`ba64615aa1958f4c378dcddcb3c32ed98bf4dff5`

Current config:

- staging semantic-primary: `false`
- production semantic-primary: `false`

GitHub Actions for disable commit:

- CI run `34575618103`: `SUCCESS`
- Deploy Workers run `34575618051`: `SUCCESS`
- Quality gate: `SUCCESS`
- Deploy backend to staging: `SUCCESS`
- Deploy backend to production: `SKIPPED`

## Decision boundary

This observed PASS does not by itself authorize:

- production D1 migration;
- production semantic-primary enablement;
- broad production rollout;
- additional semantic retries;
- relevance retuning;
- H/RRF;
- Vectorize;
- weakening the 1500 ms pacing interval;
- content-dependent fallback.

Independent closure review is required before reviewer-derived open findings are marked resolved or before the project advances to the next rollout decision stage.
