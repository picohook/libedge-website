# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. The tested hybrid retrieval architecture H is rejected.

D-016 is now **LOCKED** after independent architecture review (`ACCEPTED WITH MODIFICATION`) and focused follow-up review (`ACCEPTED`). Governing production architecture for the existing top-10 research-result contract is semantic-primary retrieval (`S`) with lexical retrieval (`L`) retained only as objective availability fallback/rollback.

Production implementation work is now authorized **in staging/feature-flag form only**. Broad production enablement is NOT yet authorized and remains subject to the locked capacity and rollout controls.

## CLOSED — P0.5 evidence chain

- P0.5 hybrid preregistration — FROZEN before fresh holdout construction.
- Fresh 40-query holdout — FROZEN before retrieval.
- Fresh retrieval — 40 L + 40 S provider calls, zero retries/failures, `$0.080`; H mechanically constructed for 40/40.
- Fresh retrieval mechanical review — `ACCEPTED`.
- Fresh blind bundle — FROZEN; two independent primary label sets FINAL / LOCKED.
- Pre-mapping agreement diagnostic — exact `747/1200 = 62.25%`, adjacent `446/1200 = 37.17%`, extreme R<->N `7/1200 = 0.58%`; diagnostic only.
- Fresh mapping/seed reveal — commitment verified.
- Fresh Gate A/B — independently `ACCEPTED`: Gate A H-v-L PASS / PASS; Gate B H-v-S FAIL / FAIL; third rater NOT TRIGGERED; `H REJECTED`.
- Fresh S-v-L diagnostic — Rater 1 `+26.75pp`, non-worse `39/40`; Rater 2 `+25.25pp`, non-worse `37/40`; all domain and frozen key-slice means positive for both.
- Frozen S-v-L coverage regression remains `40/40` because L=100 and provider-constrained S<=50; caveat remains adjacent.
- Known fresh weak examples retained: Q08 `-10pp` for Rater 1 and Q27 `-40pp` for Rater 2.
- Seen harm diagnostic independently accepted: Rater 1 L/H/S `44/72/78%`; Rater 2 `46/72/82%`; diagnostic only.
- Automatic provider-call push triggers removed; retrieval workflows require explicit manual dispatch.

Canonical final experimental outcome: `docs/experiments/p05-final-outcome.md`.

## CLOSED — D-016 architecture decision

Canonical locked architecture: `docs/architecture/p05-production-retrieval-decision.md`.

Review chain:

- `docs/reviews/2026-09-10-d016-production-architecture-review.md` — `ACCEPTED WITH MODIFICATION`.
- `docs/reviews/2026-09-10-d016-production-architecture-followup-review.md` — `ACCEPTED`.

Locked architecture:

- Primary retrieval: OpenAlex corpus-level semantic retrieval S.
- Scope: existing top-10 research-result contract only.
- Query handling: existing user intent unchanged; no LLM rewrite, phrase injection, or result-dependent transformation.
- Candidate depth: provider-supported semantic depth `<=50`.
- Lexical L retained only for objective semantic-path availability/validity failures.
- Valid zero-candidate or valid short S responses do NOT trigger L fallback/supplementation.
- H is not used as primary, fallback, supplement, or reranking/fusion stage.
- Vectorize is not added without new evidence.

## ACTIVE — implementation / rollout preparation

Implementation may now begin in staging behind a controlled feature flag.

Mandatory locked constraints:

1. **Objective-only L fallback.** Allowed for timeout/network failure, 429 after permitted handling, provider 5xx, semantic endpoint unavailable/disabled, or malformed/unprocessable provider response. Not allowed based on content, candidate count after a valid response, apparent relevance, expected quality, topic, discipline, or lexical preference.
2. **Valid-empty semantics.** HTTP-success + syntactically valid zero-candidate S response is returned as valid empty semantic result and does not trigger L fallback.
3. **Provider pacing.** Treat semantic search as `<=1 request/second` until new provider evidence changes the constraint.
4. **Pre-broad-enable capacity guardrail.** Aggregate/no-query-text telemetry or a documented conservative forecast must show peak eligible research-query arrival rate `<=0.5 requests/second`; otherwise broad enablement is blocked pending explicit capacity review/plan.
5. **D-013 checkpoint.** Review aggregate authenticated cost/credit telemetry after the first `1,000` charged semantic responses or `7 calendar days` of enabled real traffic, whichever occurs first.
6. **Privacy.** Capacity/cost/availability telemetry must not store query text, topics, research interests, or user IDs.
7. **No relevance retuning.** P0.5 holdouts/labels may not be used to retune rollout relevance behavior.
8. **Top-10 scope only.** No deep-pagination/exhaustive-recall superiority claim is authorized because S depth remains <=50 vs L=100 and frozen coverage regression was 40/40.

Monitoring must include aggregate semantic success/failure, valid zero-result count, objective fallback count/rate, latency, 429/5xx/network-failure rates, and charged-cost/credit telemetry.

## NEXT

1. Inspect the current production/staging research retrieval implementation and identify the narrowest code path for introducing S-primary behind a feature flag while preserving the external contract.
2. Before modifying code, produce an implementation plan that maps each D-016 invariant to concrete code/tests/telemetry.
3. Implement in staging only.
4. Run mechanical/integration tests for query preservation, semantic request construction, pacing, valid-empty behavior, objective fallback, privacy-safe telemetry, and rollback.
5. Obtain independent review of the implementation before broad enablement.
6. Measure/estimate peak eligible research-query traffic and enforce the `<=0.5 requests/second` pre-broad-enable guardrail.
7. Broad production enablement remains a separate operational decision after these controls are satisfied.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Conditional/global lexical phrase heuristics rejected in P0.5-A.
- Reranking restricted to lexical candidates.
- Frozen H RRF architecture as a production candidate.
- Frozen P0.5 labels, mappings, gate calculations or harm diagnostic.
- Result-dependent L/S switching.
- Vectorize before evidence shows provider semantic retrieval is insufficient for product requirements, including capacity/availability requirements.

## Evaluation / governance invariants

- Reviewer packets include raw materials and permit proposal-external findings.
- Blind evaluator outputs remain immutable once FINAL / LOCKED.
- Seen diagnostic data are not reused as a fresh gate set.
- H experimental disposition and S production adoption remain separate decisions.
- D-017 sequencing remains active for future irreversible derived artifacts.

## Privacy invariants

1. Never claim more evidence than actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Institutional analytics, if implemented, use aggregate counters only; no stored queries, topics, or user IDs.
4. Cost/rate/capacity telemetry must not add stored query text or research-interest content.

## Canonical records

- Decisions: `docs/decisions.md`
- Current state: `docs/current-state.md`
- Retrieval architecture overview: `docs/architecture/research-retrieval.md`
- Locked production architecture: `docs/architecture/p05-production-retrieval-decision.md`
- D-016 architecture review: `docs/reviews/2026-09-10-d016-production-architecture-review.md`
- D-016 follow-up acceptance: `docs/reviews/2026-09-10-d016-production-architecture-followup-review.md`
- Final P0.5 outcome: `docs/experiments/p05-final-outcome.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-10
