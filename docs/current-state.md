# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

A controlled semantic-primary staging smoke exposed one live semantic `429` during a near-concurrent pair. The flag was immediately rolled back to OFF and rollback deployment succeeded.

The pacing/observability correction has now passed independent code/diff review with classification **ACCEPTED**. Correction code is deployed to staging with semantic-primary OFF. The project is now at a **retry-preparation gate only**: the next live semantic retry still requires separate explicit authorization plus fresh human confirmation that the staging window contains controlled test traffic only.

No semantic retry is currently authorized.

## Controlled semantic smoke incident

Canonical incident record:

`docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`

Enablement commit:

`acb418c47ae190cf6cb587c3d4903a92c92a4a0b`

Enablement deploy run `34563626451`:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

Observed live near-concurrent pair:

- one HTTP `200` response with `retrievalSource="semantic"`;
- one HTTP `200` response with `retrievalSource="lexical"` after semantic stage `rate_limited` and lexical stage `ok`;
- no relevance comparison/judgment was performed.

This proves live semantic reachability and correct objective `429 -> L` fallback, but **does not** prove successful live pacing enforcement.

## Rollback — COMPLETE

Rollback commit:

`b99843654614c326e390a3f42e5108210e66d7c2`

Rollback deploy run `34564642518`: SUCCESS.

Current production semantic flag remains OFF and untouched. Staging semantic-primary is also OFF pending separate retry authorization.

## Pacing / observability correction — IMPLEMENTED AND ACCEPTED

Canonical proposal/review record:

`docs/reviews/2026-09-11-d016-pacing-correction-review.md`

Canonical implementation record:

`docs/architecture/p05-production-retrieval-pacing-correction.md`

Independent code-review acceptance:

`docs/reviews/2026-09-11-d016-pacing-correction-code-review-acceptance.md`

Accepted changes:

- `backend/src/research/semantic-pacer.js`: minimum grant interval `1000 -> 1500 ms`;
- `backend/src/research/telemetry.js`: read-only current-day aggregate telemetry snapshot using the existing shared metric allowlist;
- `backend/src/system-health.js`: super-admin-only `research_telemetry` section using that shared snapshot;
- `test/backend/research-semantic-pacing.test.js`: deterministic `1499/1500 ms` boundary test;
- `test/backend/system-health-research-telemetry.test.js`: auth, exact shared-allowlist and privacy-surface tests.

The independent reviewer classified the correction code/diff `ACCEPTED` and authorized **retry preparation only**.

No result-dependent routing, cache policy, relevance behavior, H/RRF, Vectorize or production flag behavior changed.

## Shared-key alternative-cause check

Both repository P0.5 retrieval workflows that use the staging `OPENALEX_API_KEY` are `workflow_dispatch`-only. GitHub Actions staging history showed no repository workflow-dispatch retrieval run during the 2026-09-11 semantic smoke window.

Therefore there is no evidence that a repository GitHub Actions P0.5 retrieval job competed for the semantic 1 req/s account limit during the incident.

This does **not** prove exclusive account/key use: secret values cannot be inspected and non-GitHub/external consumers cannot be excluded. Grant-to-fetch boundary sensitivity remains a plausible cause, not a uniquely proven cause.

## Correction CI / deployment evidence

CI run `34565285661`, head `08edd0d85d1d041ab36065a4827ba2d247557509`: PASS.

Actual CI log:

- `23` test files PASS;
- `93` tests PASS;
- updated semantic pacing suite: PASS;
- new system-health research telemetry suite: `3` PASS;
- lint/syntax/build: PASS;
- staging Wrangler dry-run: PASS;
- dry-run flag evidence: `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`.

Flag-OFF staging deploy run `34565273515`: PASS.

- Quality gate: PASS;
- Deploy backend to staging: PASS;
- Deploy backend to production: SKIPPED;
- deployed flag remained `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- Worker version: `12b8a9e1-f3f3-487e-b556-59333c34b304`.

## Retry preparation — ACTIVE / EXECUTION NOT AUTHORIZED

Canonical preparation record:

`docs/architecture/p05-production-retrieval-retry-preparation.md`

A future retry must, before any semantic flag change:

1. receive separate explicit retry authorization;
2. receive fresh human gatekeeper confirmation that the staging window contains controlled test traffic only and no ordinary real end-user research traffic is expected;
3. capture a super-admin aggregate telemetry baseline immediately before the pair;
4. keep production semantic-primary OFF;
5. use two distinct ordinary non-sensitive non-holdout queries fired near-concurrently/programmatically back-to-back;
6. avoid all relevance scoring/comparison/retuning.

Required success criteria for the separately authorized retry:

- `semantic_pacing_wait_ms_total` delta `> 0`;
- `semantic_429` delta `= 0`;
- semantic attempt/success/cost/credit aggregates internally consistent;
- no privacy leakage in telemetry;
- no browser/runtime blocker.

Any new semantic 429, zero pacing-wait delta, telemetry failure or loss of staging traffic isolation is `STOP / INVESTIGATE`; it does not authorize an immediate second retry.

## Pacing finding — OPEN / BLOCKS RETRY EXECUTION

`OOS-D016-CODE-01` remains `OPEN / BLOCKS SEMANTIC RETRY EXECUTION`.

The correction implementation and independent code review do not themselves close the finding. Closure requires a separately authorized live retry demonstrating privacy-safe pacing wait `>0` and no new semantic 429 during the controlled pair.

The 1500 ms setting is a conservative operational margin against OpenAlex semantic search's hard 1 request/second limit. It is not treated as proof that grant-to-fetch jitter was the sole cause of the incident.

## Telemetry privacy boundary

The super-admin health surface reads only names from the existing `RESEARCH_TELEMETRY_METRICS` allowlist and numeric aggregate values from `RATE_LIMIT_KV` for the current UTC day.

It does not expose or store query text, normalized query, user ID/email, topic, DOI/title, result body, raw provider error body, or research-interest content.

Future additions to the shared telemetry allowlist automatically become visible on the super-admin health surface; such additions therefore require conscious privacy review at the time they are introduced.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until separate retry authorization and fresh controlled-traffic confirmation.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain globally paced through the shared Durable Object; corrected grant spacing is `1500 ms`.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second`.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## Open non-blocking / blocking findings

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction: `OPEN / BLOCKS SEMANTIC RETRY EXECUTION`.
2. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk: `ACKNOWLEDGED / DEFERRED`.
3. Wrangler declarative `exports` migration path: `ACKNOWLEDGED / DEFERRED` until deliberate toolchain upgrade.

## NEXT

1. Retry preparation is complete and canonicalized.
2. Before retry execution, obtain separate explicit reviewer/main-thread authorization for the exact controlled retry procedure.
3. Immediately before flag ON, human gatekeeper must freshly confirm controlled-test-only staging traffic.
4. Capture super-admin aggregate telemetry baseline.
5. Only then may staging semantic-primary be enabled for the minimal controlled pair; production remains OFF.
6. Capture post-pair telemetry and evaluate only the locked mechanical criteria (`pacing wait >0`, `semantic_429 delta=0`, operational/privacy consistency).
7. Any stop condition requires rollback/investigation and a new authorization before another attempt.
8. Broad production enablement remains a separate later decision.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Pacing correction review: `docs/reviews/2026-09-11-d016-pacing-correction-review.md`
- Pacing correction implementation: `docs/architecture/p05-production-retrieval-pacing-correction.md`
- Pacing correction code-review acceptance: `docs/reviews/2026-09-11-d016-pacing-correction-code-review-acceptance.md`
- Retry preparation: `docs/architecture/p05-production-retrieval-retry-preparation.md`
- Controlled semantic smoke incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
