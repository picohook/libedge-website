# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

A controlled semantic-primary staging smoke exposed one live semantic `429` during a near-concurrent pair. The flag was immediately rolled back to OFF and rollback deployment succeeded. The incident remains the governing reason that no semantic retry is currently authorized.

The independent incident review classified the proposed pacing/observability correction `ACCEPTED WITH MODIFICATION`. Those modifications have now been implemented with semantic-primary OFF and CI is green. The project is now at a **correction code/diff review gate** before any retry authorization.

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

Current production semantic flag remains OFF and untouched. Staging semantic-primary is also OFF pending new authorization.

## Pacing / observability correction — IMPLEMENTED, REVIEW REQUIRED

Canonical review disposition:

`docs/reviews/2026-09-11-d016-pacing-correction-review.md`

Canonical implementation record:

`docs/architecture/p05-production-retrieval-pacing-correction.md`

Implemented code range starts after the rollback/control-plane state and includes:

- `backend/src/research/semantic-pacer.js`: minimum grant interval `1000 -> 1500 ms`;
- `backend/src/research/telemetry.js`: read-only current-day aggregate telemetry snapshot using the existing shared metric allowlist;
- `backend/src/system-health.js`: super-admin-only `research_telemetry` section using that shared snapshot;
- `test/backend/research-semantic-pacing.test.js`: deterministic `1499/1500 ms` boundary test;
- `test/backend/system-health-research-telemetry.test.js`: auth, shared-allowlist and privacy-surface tests.

No result-dependent routing, cache policy, relevance behavior, H/RRF, Vectorize or production flag behavior changed.

## Shared-key alternative-cause check

Both repository P0.5 retrieval workflows that use the staging `OPENALEX_API_KEY` are `workflow_dispatch`-only. GitHub Actions staging history shows only two workflow-dispatch runs in the accessible history, both on 2026-09-06; none occurred during the 2026-09-11 semantic smoke window.

Therefore there is no evidence that a repository GitHub Actions P0.5 retrieval job competed for the semantic 1 req/s account limit during the incident.

This does **not** prove exclusive account/key use: secret values cannot be inspected and non-GitHub/external consumers cannot be excluded. Grant-to-fetch boundary sensitivity remains a plausible cause, not a uniquely proven cause.

## Correction CI evidence

CI run `34565285661`, head `08edd0d85d1d041ab36065a4827ba2d247557509`: PASS.

Actual CI log:

- `23` test files PASS;
- `93` tests PASS;
- updated semantic pacing suite: PASS;
- new system-health research telemetry suite: `3` PASS;
- lint/syntax/build: PASS;
- staging Wrangler dry-run: PASS;
- dry-run flag evidence: `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`.

## Pacing finding — OPEN / BLOCKS RETRY

`OOS-D016-CODE-01` remains `OPEN / BLOCKS SEMANTIC RETRY` until an independent code/diff review accepts the correction and a subsequent live retry actually demonstrates privacy-safe pacing wait `>0` with no new semantic 429 during the controlled pair.

The 1500 ms setting is a conservative operational margin against OpenAlex semantic search's hard 1 request/second limit. It is not treated as proof that grant-to-fetch jitter was the sole cause of the incident.

## Telemetry privacy boundary

The super-admin health surface reads only names from the existing `RESEARCH_TELEMETRY_METRICS` allowlist and numeric aggregate values from `RATE_LIMIT_KV` for the current UTC day.

It does not expose or store query text, normalized query, user ID/email, topic, DOI/title, result body, raw provider error body, or research-interest content.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until correction code review and separate retry authorization.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain globally paced through the shared Durable Object; corrected grant spacing is `1500 ms`.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second`.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## Open non-blocking / blocking findings

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction: `OPEN / BLOCKS SEMANTIC RETRY`.
2. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk: `ACKNOWLEDGED / DEFERRED`.
3. Wrangler declarative `exports` migration path: `ACKNOWLEDGED / DEFERRED` until deliberate toolchain upgrade.

## NEXT

1. Independent reviewer inspects the full correction code/diff and CI evidence.
2. Reviewer accepts/modifies/rejects the 1500 ms pacer change and super-admin telemetry read surface.
3. No semantic retry occurs unless that code/diff review is accepted.
4. After acceptance, verify corrected staging deployment with semantic-primary OFF and read the aggregate health telemetry surface as super-admin.
5. A separate retry authorization and fresh human controlled-traffic confirmation are required before flag ON.
6. Any retry must use two distinct near-concurrent authenticated requests, demonstrate `semantic_pacing_wait_ms_total` delta `>0`, and show no increase in `semantic_429` across the pair. A new semantic 429 is a stop/investigate event.
7. Broad production enablement remains a separate later decision.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Pacing correction review: `docs/reviews/2026-09-11-d016-pacing-correction-review.md`
- Pacing correction implementation: `docs/architecture/p05-production-retrieval-pacing-correction.md`
- Code review: `docs/reviews/2026-09-11-d016-code-review.md`
- Controlled semantic smoke incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
