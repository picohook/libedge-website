# D-016 — Controlled Semantic Retry v2 — Closure Acceptance

Status: `ACCEPTED`

Date: 2026-09-11

## Scope

Independent closure review of the single authorized controlled semantic-primary staging retry.

## Reviewer conclusion

Classification: **ACCEPTED**.

The retry satisfied all locked mechanical success criteria.

Verified evidence:

- two distinct authenticated near-concurrent staging requests;
- both returned HTTP `200`;
- both reported `retrievalSource="semantic"`;
- both were uncached and returned 10 results;
- PRE D1 telemetry:
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
- POST D1 telemetry:
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

Mechanical deltas:

- `research_requests +2`
- `semantic_attempts +2`
- `semantic_successes +2`
- `semantic_429 +0`
- `semantic_pacing_wait_ms_total +1500`
- `semantic_charged_responses +2`
- `semantic_cost_microusd_total +2000`
- `semantic_credits_total +20`
- `lexical_fallback_attempts +0`
- `lexical_fallback_successes +0`

The reviewer specifically concluded:

1. live pacing enforcement is demonstrated for this controlled pair;
2. no new semantic `429` occurred;
3. the corrected D1 telemetry path did not reproduce the prior lost-update defect;
4. cost/credit accounting is internally consistent with two charged semantic responses;
5. zero lexical fallback is consistent with two successful semantic responses;
6. the single-retry authorization boundary was respected.

## Finding closure

The reviewer explicitly approved closure of:

- `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction;
- `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race.

These findings are closed on the strength of the controlled live retry plus the earlier flag-OFF real-D1 concurrency verification.

## Post-retry safety state

After the single authorized retry, staging semantic-primary was disabled again.

Disable commit:

`ba64615aa1958f4c378dcddcb3c32ed98bf4dff5`

CI run:

`34575618103` — SUCCESS

Deploy Workers run:

`34575618051` — SUCCESS

- staging deploy: SUCCESS;
- production deploy: SKIPPED;
- staging semantic-primary: OFF;
- production semantic-primary: OFF.

## Decision boundary

This acceptance authorizes only:

- recording the retry as independently verified PASS;
- closing the two findings listed above;
- preparing the next rollout-stage proposal.

It does **not** authorize:

- production D1 migration;
- production semantic-primary enablement;
- broad production rollout;
- another semantic retry;
- relevance retuning;
- H/RRF;
- Vectorize.

## Next-stage guidance

The reviewer identified two independent preparation tracks before any broad/production enablement decision:

1. document real or defensibly estimated peak eligible research-query rate against the locked `<=0.5 requests/second` broad-enablement guardrail;
2. prepare production D1 migration as a separate migration-first proposal and review sequence.

Neither track is implicitly authorized by this acceptance.
