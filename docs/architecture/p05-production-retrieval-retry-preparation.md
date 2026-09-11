# P0.5 Production Retrieval — Controlled Semantic Retry Preparation

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Prepare the next controlled semantic-primary staging retry after the first live smoke exposed a semantic `429`, without yet authorizing the retry itself.

This document is preparation-only. It does not change D-016 and does not authorize staging semantic-primary enablement.

## Preconditions already satisfied

- pacing safety margin changed from `1000 ms` to `1500 ms`;
- aggregate research telemetry is readable through the existing super-admin-only `/api/admin/system-health` surface;
- telemetry read/write metric names share one canonical allowlist;
- correction tests and CI passed;
- correction code is deployed to staging with semantic-primary OFF;
- independent correction code review classified the implementation `ACCEPTED`.

## Preconditions still required before retry execution

A separate retry authorization must explicitly confirm all of the following immediately before any flag change:

1. human gatekeeper confirms the staging window contains controlled test traffic only and no ordinary real end-user research traffic is expected;
2. staging semantic flag is currently OFF;
3. production semantic flag is OFF;
4. a super-admin telemetry **baseline** is captured immediately before the pair;
5. two distinct ordinary non-sensitive test queries are selected that are not P0.5 frozen holdout queries;
6. queries are fired near-concurrently/programmatically back-to-back from an authenticated staging browser session;
7. no relevance evaluation, result labeling, or S-vs-L quality comparison will be performed.

## Required telemetry baseline

Immediately before the retry pair, record only aggregate values from `/api/admin/system-health` for the current UTC date:

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

## Retry execution shape

After separate retry authorization only:

1. change only staging `RESEARCH_SEMANTIC_PRIMARY_ENABLED` from `false` to `true`;
2. production remains `false`;
3. deploy staging;
4. from one authenticated staging browser session, issue two distinct ordinary non-sensitive research requests using `Promise.all` or equivalent back-to-back programmatic dispatch;
5. do not manually click the requests sequentially;
6. inspect only operational metadata needed for mechanical verification;
7. immediately capture the same aggregate telemetry counters after the pair;
8. if any stop condition occurs, rollback staging flag to `false` and redeploy before further investigation.

## Success criteria

The retry is considered a successful live pacing verification only if all are true:

1. both requests return HTTP success;
2. valid semantic successes identify `meta.retrievalSource === "semantic"` unless a genuinely independent objective provider failure occurs;
3. `semantic_pacing_wait_ms_total` increases by `> 0` across the pair;
4. `semantic_429` increases by exactly `0` across the pair;
5. semantic attempts/successes/cost/credits are internally consistent with the observed requests;
6. no query/user/topic/result content appears in the aggregate telemetry surface;
7. no browser-visible/runtime blocker is observed.

## Stop conditions

Any of the following means **STOP / INVESTIGATE** and no success claim:

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

The retry is purely mechanical/operational.

It must not:

- score relevance;
- reuse P0.5 holdout labels;
- compare semantic result quality with lexical result quality;
- tune query content based on returned results;
- persist query text in operational records;
- expose user research interests in telemetry.

## Authorization boundary

This preparation record authorizes **no live semantic traffic**.

A separate reviewer/main-thread gate is still required before:

- staging flag ON;
- retry execution;
- any later production rollout decision.
