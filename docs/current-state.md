# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. The tested hybrid retrieval architecture H is rejected.

D-016 is **LOCKED**. Governing architecture for the existing top-10 research-result contract is semantic-primary retrieval (`S`) with lexical retrieval (`L`) retained only as objective availability fallback/rollback.

The staging implementation plan received independent `ACCEPTED WITH MODIFICATION`. The required cache-provenance correction and the S+L dual-failure reporting clarification are now incorporated in `docs/architecture/p05-production-retrieval-implementation-plan.md` and await focused follow-up acceptance.

**No D-016 production retrieval code has been changed yet.** Broad production enablement remains unauthorized.

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

## ACTIVE — staging implementation pre-code review

Canonical plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`.
Review record: `docs/reviews/2026-09-11-d016-preimplementation-review.md`.

The first pre-implementation review classification was `ACCEPTED WITH MODIFICATION`.

### Required correction now incorporated

Cache identity/read policy is now based on the **actual retrieval source** rather than only the feature-flag/request architecture state:

- `semantic` cache = only valid S output, including valid-empty/short S;
- `lexical` cache = only valid L output, including objective S->L fallback output;
- `crossref` cache = only final Crossref search contingency, if retained as cacheable.

A semantic-primary request cannot be satisfied directly by a cached lexical fallback response. A lexical fallback cache may be consulted only after the current S attempt itself has failed objectively. Thus a transient S outage cannot cause lexical output to masquerade as semantic output or suppress later S attempts for the TTL.

### Additional clarification now incorporated

If both S and L fail before Crossref contingency, implementation must preserve structured privacy-safe provenance for both failure stages. It may not arbitrarily collapse one error into a single misleading OpenAlex status. No raw provider error/query/user/result content may be exposed or persisted.

### Other locked implementation constraints

1. Feature flag defaults OFF; code implementation is staging/feature-flag only.
2. One shared OpenAlex provider/normalization implementation with explicit `lexical`/`semantic` mode.
3. Valid empty/short S does not trigger L.
4. Objective-only S->L fallback; no content/count/relevance/topic routing.
5. S and L never run in parallel and are never merged.
6. Crossref search remains final provider contingency; Crossref DOI enrichment remains separate.
7. Global semantic request-start pacing uses one shared serialization primitive; process-local timers are insufficient.
8. Pacing-gate failure is fail-closed to L fallback, never ungated S.
9. Aggregate-only telemetry; no stored query text, topics, research interests or user IDs.
10. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
11. Broad enablement remains blocked unless peak eligible research-query arrival rate is documented `<=0.5 requests/second`.

## NEXT

1. Focused reviewer verifies the actual-source cache correction and dual S/L failure provenance clarification.
2. Only after follow-up `ACCEPTED` may D-016 retrieval code implementation begin.
3. Implement with feature flag default OFF.
4. Run unit/integration suite and obtain independent code/diff review.
5. Deploy staging with flag OFF, verify baseline, then controlled staging enablement and mechanical operational verification.
6. Broad production enablement remains a separate later decision after capacity/rollout controls.

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
- Staging implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Pre-implementation review: `docs/reviews/2026-09-11-d016-preimplementation-review.md`
- Final P0.5 outcome: `docs/experiments/p05-final-outcome.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
