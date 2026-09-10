# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. The tested hybrid retrieval architecture H is rejected. The separate D-016 production-architecture proposal received independent `ACCEPTED WITH MODIFICATION`; requested modifications are now incorporated in `docs/architecture/p05-production-retrieval-decision.md` and await focused follow-up review.

Production behavior is **not yet changed**. D-016 remains `PROPOSED` until the modified architecture is independently accepted and explicitly locked.

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

## ACTIVE — D-016 modified production architecture review

Canonical proposal: `docs/architecture/p05-production-retrieval-decision.md`.
Architecture review record: `docs/reviews/2026-09-10-d016-production-architecture-review.md`.

Core direction accepted by reviewer:

- S primary for existing top-10 research-result contract.
- L only as objective availability fallback/rollback.
- H not adopted.
- Vectorize not added now.

Reviewer-requested modifications now incorporated:

1. A valid successful S response with zero candidates is explicitly **not** an availability failure and does not trigger L fallback. Empty/short valid S responses cannot cause result-dependent switching.
2. Before broad enablement, aggregate/no-query-text traffic evidence or a documented conservative forecast must show peak eligible research-query arrival rate `<=0.5 requests/second`; otherwise broad enablement is blocked pending explicit capacity review. This is headroom against the current canonical `<=1 request/second` semantic dependency, not a relevance gate.
3. First production-scale D-013 telemetry checkpoint occurs after `1,000` charged semantic responses or `7 calendar days` of enabled real traffic, whichever occurs first, using aggregate cost/credit telemetry only.
4. Q08 `-10pp` and Q27 `-40pp` remain named historical weak examples; they do not authorize content-dependent routing.
5. Vectorize capacity/availability revisit finding is `ACKNOWLEDGED / DEFERRED`; revisit only if measured capacity/availability evidence shows the provider semantic path is insufficient for product requirements.

## NEXT

1. Focused independent reviewer inspects the exact modifications in `docs/architecture/p05-production-retrieval-decision.md` against the prior `ACCEPTED WITH MODIFICATION` findings.
2. Reviewer classifies the modified proposal `ACCEPTED`, `ACCEPTED WITH MODIFICATION`, or `REJECTED`.
3. Only if the modified proposal is accepted does the main thread transition D-016 `PROPOSED -> LOCKED`.
4. No production retrieval code is changed before D-016 is LOCKED.
5. After lock, implementation remains staging/feature-flag first; broad enablement remains subject to the operational capacity guardrail and rollout checks.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Conditional/global lexical phrase heuristics rejected in P0.5-A.
- Reranking restricted to lexical candidates.
- Frozen H RRF architecture as a production candidate.
- Frozen P0.5 labels, mappings, gate calculations or harm diagnostic.
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
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- Production architecture proposal: `docs/architecture/p05-production-retrieval-decision.md`
- D-016 architecture review: `docs/reviews/2026-09-10-d016-production-architecture-review.md`
- Final P0.5 outcome: `docs/experiments/p05-final-outcome.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-10
