# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The first controlled semantic-primary staging smoke exposed a live semantic `429`; pacing was corrected from `1000 ms` to `1500 ms` and independently accepted.

A later controlled retry returned two uncached semantic HTTP `200` responses but exposed a non-atomic KV telemetry lost-update defect. That retry was **NOT PASS**.

The telemetry defect was corrected with D1 atomic counters, migration-first sequencing was followed, code/diff review returned **ACCEPTED WITH MODIFICATION**, and the reviewer-required live semantic-OFF D1 concurrency verification then **PASSED** with an exact `research_requests +5` under five near-concurrent lexical requests and no semantic-counter movement.

A subsequent separately authorized single controlled semantic retry has now **PASSED** and been independently **ACCEPTED**.

The semantic-primary flag is currently OFF in both staging and production.

The project is now at a **next rollout-stage preparation** gate only. No production D1 migration, production semantic enablement, broad rollout, or further semantic retry is authorized.

## Independently verified controlled semantic retry — PASS / ACCEPTED

Canonical PASS record:

`docs/reviews/2026-09-11-d016-controlled-semantic-retry-pass.md`

Canonical closure acceptance:

`docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`

PRE D1 telemetry:

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

Controlled near-concurrent pair:

- request 1: HTTP `200`, `retrievalSource="semantic"`, uncached, 10 results;
- request 2: HTTP `200`, `retrievalSource="semantic"`, uncached, 10 results.

POST D1 telemetry:

- `research_requests = 7`
- `semantic_attempts = 2`
- `semantic_successes = 2`
- `semantic_429 = 0`
- `semantic_pacing_wait_ms_total = 1500`
- `semantic_charged_responses = 2`
- `semantic_cost_microusd_total = 2000`
- `semantic_credits_total = 20`
- `lexical_fallback_attempts = 0`
- `lexical_fallback_successes = 0`.

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
- `lexical_fallback_successes +0`.

Independent reviewer conclusion:

- pacing was live-enforced for the controlled pair;
- no new semantic `429` occurred;
- corrected D1 telemetry did not reproduce the prior lost-update defect;
- attempts/successes/cost/credits were internally consistent;
- the single-retry authorization boundary was respected.

No relevance judgment was made.

## Post-retry safety state

The single authorized retry was followed by immediate staging disable.

Enable commit:

`dbdc8c4cc0469d481e80f594c4ad992673081f81`

Enable deploy:

- CI `34574860041`: SUCCESS;
- Deploy Workers `34574859960`: SUCCESS;
- staging deploy: SUCCESS;
- production deploy: SKIPPED.

Disable commit:

`ba64615aa1958f4c378dcddcb3c32ed98bf4dff5`

Disable deploy:

- CI `34575618103`: SUCCESS;
- Deploy Workers `34575618051`: SUCCESS;
- staging deploy: SUCCESS;
- production deploy: SKIPPED.

Current flags:

- staging semantic-primary: OFF;
- production semantic-primary: OFF.

## Telemetry atomicity correction — COMPLETE / ACCEPTED

Canonical architecture:

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

Canonical implementation:

`docs/architecture/p05-research-telemetry-atomicity-implementation.md`

Independent code/diff acceptance:

`docs/reviews/2026-09-11-d016-telemetry-atomicity-code-review-acceptance.md`

Accepted properties:

- exact counters moved from KV read-modify-write to D1 atomic UPSERTs;
- dedicated `research_telemetry_counters` table on existing staging `env.DB`;
- single shared `RESEARCH_TELEMETRY_METRICS` allowlist;
- semantic success/failure and lexical fallback accounting structurally preserves `semantic_successes <= semantic_attempts`;
- telemetry remains best-effort and does not alter retrieval/fallback behavior;
- no global telemetry Durable Object;
- production migration not applied.

Reviewer-required real-D1 concurrency verification also passed before the successful semantic retry:

- PRE `research_requests = 0`;
- five near-concurrent lexical requests, all HTTP `200` / lexical / uncached;
- POST `research_requests = 5` exactly;
- semantic counters remained zero.

## Finding status

### CLOSED

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction.
   - Closed by independent reviewer after the controlled retry produced `semantic_pacing_wait_ms_total +1500` and `semantic_429 +0`.

2. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race.
   - Closed by independent reviewer after both the flag-OFF real-D1 concurrency verification and the successful semantic retry showed exact, internally consistent D1-backed counters.

### ACKNOWLEDGED / DEFERRED

3. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk.
4. Shared-core-D1 telemetry failure-domain coupling — revisit before broad enablement if measured write QPS/latency/contention suggests material impact.
5. Wrangler declarative `exports` migration path — revisit only during a deliberate toolchain upgrade.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until a separately reviewed rollout decision.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain globally paced through the dedicated pacing Durable Object at `1500 ms` minimum spacing.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second`.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.
10. Production D1 migration remains a separate migration-first proposal and review sequence.
11. Production semantic enablement remains a separate later decision.

## NEXT

Two independent preparation tracks are now required before any broad/production enablement decision:

1. **Traffic/capacity guardrail evidence**
   - obtain real or defensibly estimated peak eligible research-query rate;
   - document the measurement window/source/method;
   - compare the peak against the locked `<=0.5 requests/second` broad-enablement guardrail;
   - if the rate cannot be credibly established at or below the guardrail, broad enablement remains blocked.

2. **Production D1 migration proposal**
   - prepare a separate production migration-first proposal for `research_telemetry_counters`;
   - do not apply the migration until that proposal receives independent review acceptance;
   - migration acceptance does not itself authorize production semantic-primary enablement.

These two tracks must remain independent. Neither one authorizes the other and neither authorizes production rollout by itself.

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
- Controlled semantic retry PASS: `docs/reviews/2026-09-11-d016-controlled-semantic-retry-pass.md`
- Controlled semantic retry closure acceptance: `docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
