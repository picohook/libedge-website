# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. The tested hybrid retrieval architecture H is rejected. A separate production-architecture decision is now open under D-016; the current proposal is semantic-primary retrieval (S) for the existing top-10 research-result contract, with lexical retrieval (L) retained only as an objective availability fallback.

Production behavior is **not yet changed**. D-016 remains `PROPOSED` pending independent architecture review.

## CLOSED — P0.5 evidence chain

- P0.5 hybrid preregistration — FROZEN before fresh holdout construction.
- Fresh 40-query holdout — FROZEN before retrieval.
- Fresh retrieval — 40 L + 40 S provider calls, zero retries/failures, `$0.080`; H mechanically constructed for 40/40.
- Fresh retrieval mechanical review — `ACCEPTED`.
- Fresh blind bundle — FROZEN; two independent primary label sets FINAL / LOCKED.
- Pre-mapping agreement diagnostic — exact `747/1200 = 62.25%`, adjacent `446/1200 = 37.17%`, extreme R<->N `7/1200 = 0.58%`; diagnostic only.
- Fresh mapping/seed reveal — commitment verified.
- Fresh Gate A/B — independently `ACCEPTED`:
  - Rater 1: Gate A H-v-L PASS; Gate B H-v-S FAIL.
  - Rater 2: Gate A H-v-L PASS; Gate B H-v-S FAIL.
  - Third-rater trigger: NOT TRIGGERED.
  - Predeclared matrix: `H REJECTED`.
- Fresh S-v-L relevance diagnostic:
  - Rater 1 mean `+26.75pp`, non-worse `39/40`.
  - Rater 2 mean `+25.25pp`, non-worse `37/40`.
  - All four domain means positive for both raters.
  - Conjunctive and lexical-ambiguity slice means positive for both raters.
  - Frozen-rule coverage regression remains `40/40` because L=100 and provider-constrained S<=50; this caveat must remain adjacent to the statistic.
- Seen A1/A2/A5/A6/A7 harm retrieval — 5 L + 5 S, zero retries/failures, `$0.010`; cumulative experiment usage `90/120` calls / `$0.090`.
- Harm retrieval mechanical review — `ACCEPTED`.
- Harm evaluator bundle — built PROVISIONAL only after retrieval acceptance, independently structurally `ACCEPTED`, then byte-identically promoted to FROZEN.
- Two new harm primary blind-rater label sets — FINAL / LOCKED before mapping reveal.
- Harm seed commitment — verified after both raters locked.
- Harm diagnostic reconstruction — independently `ACCEPTED` with zero discrepancies.
- Harm aggregate Relevant@10:
  - Rater 1: L `44%`, H `72%`, S `78%`.
  - Rater 2: L `46%`, H `72%`, S `82%`.
- Harm slice remains diagnostic only; unfavorable per-case results are retained and no third-rater/adoption gate was introduced.
- Automatic provider-call `push` triggers were removed; retrieval workflows now require explicit manual dispatch.

## Final P0.5 experimental conclusion

Canonical outcome: `docs/experiments/p05-final-outcome.md`.

1. **H is rejected.** It improves L but fails non-inferiority versus S for both independent fresh raters; the seen harm diagnostic is directionally consistent.
2. **S is the strongest remaining architecture candidate on relevance evidence.** It substantially outperforms L on the fresh S-v-L diagnostic for both raters and on aggregate in the seen harm slice.
3. **S is not automatically production-adopted.** Production adoption is a separate D-016 architecture decision.
4. **L remains the operational baseline** until D-016 is explicitly LOCKED and implemented.
5. **Vectorize is not justified by current evidence.** Revisit only if new evidence shows the provider semantic path is insufficient.

## ACTIVE — D-016 production architecture review

Canonical proposal: `docs/architecture/p05-production-retrieval-decision.md`.

Proposed architecture:

- Primary retrieval: OpenAlex corpus-level semantic retrieval S.
- Scope: existing top-10 research-result contract only.
- Query handling: existing user intent; no LLM rewrite, phrase injection, or result-dependent transformation.
- Candidate depth: provider-supported semantic depth `<=50`.
- L retained only as an **objective availability fallback** for timeout/network/429/5xx/semantic endpoint unavailability conditions.
- A valid successful S response is never replaced/supplemented by L based on content, candidate count, apparent relevance, topic, or discipline.
- H is not adopted as primary, fallback, or reranking/fusion stage.
- Vectorize is not added.
- Rollout, if approved: controlled staging/feature-flag implementation first; preserve L rollback; verify pacing, latency, error handling, cost telemetry, privacy and evidence rendering before broad production enablement.

### Open operational constraints for review

- Semantic pacing is currently treated as `<=1 request/second`; production requires explicit concurrency/queueing or equivalent compliant request shaping.
- S candidate depth is <=50 versus L=100; P0.5 establishes superiority for the current top-10 relevance contract, not deep pagination or exhaustive recall.
- D-013 observed price remains `$0.001` per successful semantic call and retains its existing reopen trigger for materially changed authenticated telemetry.
- Semantic-primary increases provider-endpoint dependency; L provides rollback/availability fallback without recreating result-dependent hybrid behavior.

## NEXT

1. Independent reviewer inspects `docs/architecture/p05-production-retrieval-decision.md` against the complete P0.5 evidence chain.
2. Reviewer classifies the proposal as `ACCEPTED`, `ACCEPTED WITH MODIFICATION`, or `REJECTED`, plus any material OUT-OF-SCOPE finding.
3. Only after that review does the main thread resolve D-016:
   - if accepted, transition D-016 `PROPOSED -> LOCKED` with the reviewed production scope/guardrails;
   - if modified, incorporate the accepted architecture modifications and then lock;
   - if rejected, record `PROPOSED -> REJECTED` and retain the existing production baseline.
4. No production retrieval code is changed before D-016 is resolved.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Conditional/global lexical phrase heuristics rejected in P0.5-A.
- Reranking restricted to lexical candidates.
- The frozen H RRF architecture as a production candidate.
- Frozen P0.5 labels, mappings, gate calculations or harm diagnostic.
- Vectorize before evidence shows provider semantic retrieval is insufficient.

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
4. Cost/rate telemetry must not add stored query text or research-interest content.

## Canonical records

- Decisions: `docs/decisions.md`
- Current state: `docs/current-state.md`
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- Production architecture proposal: `docs/architecture/p05-production-retrieval-decision.md`
- Frozen P0.5 protocol: `docs/experiments/p05-hybrid-semantic.md`
- Fresh evaluation: `docs/experiments/p05-hybrid-semantic-evaluation.md`
- Harm retrieval: `docs/experiments/p05-harm-regression-retrieval.md`
- Harm evaluation: `docs/experiments/p05-harm-regression-evaluation.md`
- Final P0.5 outcome: `docs/experiments/p05-final-outcome.md`
- Final harm review: `docs/reviews/2026-09-10-p05-harm-diagnostic-review.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-10
