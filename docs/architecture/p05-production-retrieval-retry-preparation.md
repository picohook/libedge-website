# P0.5 Production Retrieval — Controlled Semantic Retry Preparation

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Prepare the next controlled semantic-primary staging retry after the first live smoke exposed a semantic `429` and the later retry exposed non-atomic KV telemetry, without yet authorizing the semantic retry itself.

This document is preparation-only. It does not change D-016 and does not authorize staging semantic-primary enablement.

## Preconditions already satisfied

- pacing safety margin changed from `1000 ms` to `1500 ms`;
- aggregate research telemetry is readable through the existing super-admin-only `/api/admin/system-health` surface;
- telemetry read/write metric names share one canonical allowlist;
- exact telemetry counters were moved from KV read-modify-write to D1 atomic UPSERTs;
- staging D1 schema migration was applied before the D1-backed runtime was deployed;
- Tests A-I, CI and staging Wrangler dry-run passed;
- corrected runtime is deployed to staging with semantic-primary OFF;
- independent telemetry correction code/diff review classified the implementation `ACCEPTED WITH MODIFICATION`;
- the reviewer-required live semantic-OFF staging D1 concurrency verification has now PASSED.

Independent acceptance record:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-code-review-acceptance.md`

## Flag-OFF live D1 concurrency verification — PASS

A real staging D1 concurrency check was executed with semantic-primary OFF, using one authenticated staging browser session and five distinct ordinary non-sensitive research queries fired programmatically near-concurrently with `Promise.all`.

No relevance judgment or result-quality comparison was performed.

### PRE snapshot

- date: `2026-09-11`
- `research_requests = 0`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`

### Five-request burst

All five responses were:

- HTTP `200`;
- `meta.retrievalSource = "lexical"`;
- `cached = false`;
- `resultCount = 10`.

Observed browser elapsed times were approximately:

- 2421 ms
- 2724 ms
- 2008 ms
- 2356 ms
- 2105 ms

### POST snapshot

- date: `2026-09-11`
- `research_requests = 5`
- `semantic_attempts = 0`
- `semantic_successes = 0`
- `semantic_429 = 0`

### Mechanical result

- `research_requests` delta = **+5 exactly**;
- semantic counters remained unchanged;
- all responses remained lexical and successful;
- no telemetry/runtime/browser error was observed.

Classification of this prerequisite: **PASS**.

This fills the methodological gap identified by the independent reviewer: the unit-test fake D1 could validate accounting logic but not real D1 concurrency scheduling. This live check provides small-scale staging evidence that the deployed D1-backed counter path did not lose increments under a near-concurrent lexical burst.

This PASS does not authorize semantic-primary enablement by itself and does not establish production-scale throughput.

## Preconditions still required before semantic retry execution

A separate semantic retry authorization must explicitly confirm all of the following immediately before any flag change:

1. the lexical-only live D1 concurrency verification above is recorded PASS;
2. human gatekeeper confirms the staging window contains controlled test traffic only and no ordinary real end-user research traffic is expected;
3. staging semantic flag is currently OFF;
4. production semantic flag is OFF;
5. a super-admin D1 telemetry **baseline** is captured immediately before the semantic pair;
6. two distinct ordinary non-sensitive test queries are selected that are not P0.5 frozen holdout queries;
7. queries are fired near-concurrently/programmatically back-to-back from an authenticated staging browser session;
8. no relevance evaluation, result labeling, or S-vs-L quality comparison will be performed.

## Required semantic-retry telemetry baseline

Immediately before the semantic retry pair, record only aggregate values from `/api/admin/system-health` for the current UTC date:

- `semantic_attempts`
- `semantic_successes`
- `semantic_429`
- `semantic_pacing_wait_ms_total`
- `semantic_charged_responses`
- `semantic_cost_microusd_total`
- `semantic_credits_total`
- `lexical_fallback_attempts`
- `lexical_fallback_successes`

Do not record query text, user identity, topic, result content, DOI/title, or raw provider errors.

## Semantic retry execution shape

After separate semantic retry authorization only:

1. change only staging `RESEARCH_SEMANTIC_PRIMARY_ENABLED` from `false` to `true`;
2. production remains `false`;
3. deploy staging;
4. from one authenticated staging browser session, issue two distinct ordinary non-sensitive research requests using `Promise.all` or equivalent back-to-back programmatic dispatch;
5. do not manually click the requests sequentially;
6. inspect only operational metadata needed for mechanical verification;
7. immediately capture the same aggregate telemetry counters after the pair;
8. if any stop condition occurs, rollback staging flag to `false` and redeploy before further investigation.

## Semantic retry success criteria

The retry is considered a successful live pacing verification only if all are true:

1. both requests return HTTP success;
2. valid semantic successes identify `meta.retrievalSource === "semantic"` unless a genuinely independent objective provider failure occurs;
3. `semantic_pacing_wait_ms_total` increases by `> 0` across the pair;
4. `semantic_429` increases by exactly `0` across the pair;
5. semantic attempts/successes/cost/credits are internally consistent with the observed requests;
6. no query/user/topic/result content appears in the aggregate telemetry surface;
7. no browser-visible/runtime blocker is observed.

## Stop conditions

Any of the following means **STOP / INVESTIGATE** and no semantic success claim:

- `semantic_pacing_wait_ms_total` delta is `0`;
- `semantic_429` delta is `> 0`;
- pacing gate is unavailable;
- unexpected fallback occurs without an objective availability reason;
- runtime/browser error occurs;
- telemetry cannot be read reliably before/after the pair;
- staging traffic isolation can no longer be confirmed.

A stop condition does not authorize an immediate retry. Any further retry must return through reviewer/main-thread authorization.

## Rollback

Rollback remains configuration-only:

- staging `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- redeploy staging;
- production remains untouched.

No cache destruction or data migration is required.

## Privacy / relevance invariants

Both the completed lexical D1 concurrency verification and any later semantic retry are purely mechanical/operational.

They must not:

- score relevance;
- reuse P0.5 holdout labels;
- compare semantic result quality with lexical result quality;
- tune query content based on returned results;
- persist query text in operational records;
- expose user research interests in telemetry.

## Authorization boundary

The reviewer-required flag-OFF lexical D1 concurrency verification is complete and PASS.

This preparation record still authorizes **no live semantic traffic**.

A separate reviewer/main-thread gate is required before:

- staging semantic flag ON;
- semantic retry execution;
- any later production rollout decision.
