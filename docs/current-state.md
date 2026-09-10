# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Frozen fresh-holdout retrieval preparation/execution under FROZEN preregistration.

## CLOSED

- P0 Academic Metadata Gateway — CLOSED.
- P0 metadata/plumbing validation — CLOSED; plumbing GREEN, lexical relevance YELLOW.
- Global selective-phrase rewrite A/B — CLOSED / REJECTED.
- P0.5-A conditional lexical feasibility — CLOSED / FAIL.
- P0.5-A rater reconciliation — CLOSED; rater-definition robust A2 FAIL / B FAIL.
- Lexical top-100 depth diagnostic — CLOSED.
- Semantic-vs-lexical gap diagnostic — CLOSED; material retrieval-level recall gap found.
- Governance red-team review 2026-09-10 — CLOSED; findings triaged and control-plane corrections applied.
- P0.5 hybrid preregistration methodology review — CLOSED; reviewer reports no remaining methodological FREEZE blocker.
- D-013 semantic pricing reconciliation — CLOSED / LOCKED at observed `$0.001/call` (`$1/1,000`) for P0.5 planning.
- P0.5 Hybrid Semantic Retrieval preregistration — FROZEN 2026-09-10 before fresh gate holdout generation.
- Pre-holdout economic amendment — CLOSED before holdout generation/results: total provider budget corrected to include both L and S calls.
- Fresh 40-query holdout construction/tagging — CLOSED / FROZEN before retrieval. Canonical holdout: `docs/experiments/p05-hybrid-semantic-holdout.md`.

## ACTIVE

- Frozen holdout contains exactly 40 unseen intents: 10 Materials/Energy, 10 Biomedical, 10 Social Science, 10 Humanities.
- Frozen slices: conjunctive 17, lexical ambiguity 15, technical/jargon 16; overlap permitted.
- No L/S/H retrieval result was inspected during holdout construction/tagging/audit.
- Candidate architecture under test:
  - L: OpenAlex lexical top-100 baseline.
  - S: OpenAlex semantic top-50 retrieval.
  - H: L/S union -> canonical deduplication -> RRF `k=60` -> deterministic tie-break -> top 10; no additional provider call.
- OpenAlex semantic-search operational constraint: <=1 request/second.
- P0.5 frozen economic assumption: measured `$0.001 / provider call` for both semantic observations and lexical control. Base plan: 45 lexical + 45 semantic = 90 provider calls / `$0.090`. Operational cap: 120 charged provider calls / `$0.120`, allowing 30 retry calls across L+S.
- Passive charged-cost/credit monitoring is ACTIVE for the upcoming 40-query batch and later 5-query harm slice. Cost monitoring stores no query/topic/user research-interest content.
- Production semantic/hybrid retrieval remains NOT ADOPTED pending fresh-holdout evidence and a later architecture decision.

## NEXT

1. Execute exactly one L and one S provider retrieval per frozen holdout intent with passive cost telemetry; H reuses those pools.
2. Preserve raw candidate pools and mechanical coverage counts without relevance judgments or tuning.
3. Compute H strictly with frozen dedup/RRF/tie-break rules.
4. Prepare/freeze randomized evaluator bundle and bibliographic/evidence fields.
5. Obtain two independent blind-rater label sets in separate fresh lineages; third rater only for Gate A/B disagreement.
6. Report all component vectors per rater and apply frozen A/B matrix.
7. Only after fresh-gate reconciliation run A1/A2/A5/A6/A7 two-rater harm diagnostic with the same provider-cost monitoring.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as semantic gate set.
- Reranking-only architecture restricted to lexical candidates.
- Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- D-013 pricing unless materially different authenticated charged-cost telemetry appears.
- Frozen P0.5 retrieval/fusion/gate parameters in response to observed holdout results.
- Frozen holdout wording/domain/slice tags after retrieval begins.

## Evaluation invariants

- Conjunctive-intent rule: R only if available evaluation evidence directly covers all essential explicitly stated components; one essential component only is M; indirect/topic-adjacent is N.
- Seen diagnostic data and fresh gate data remain physically/procedurally separated.
- Reviewer receives summary plus raw materials and may challenge implementer framing.
- Blind evaluator receives only frozen evaluation materials/rubric; no mapping, prior labels, gate metrics, or discussion history.
- Numeric rater metrics remain per-rater; only preregistered binary Gate A/B dispositions may use third-rater 2-of-3 rule.

## Privacy invariants

1. Never claim more evidence than actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Future institutional analytics, if implemented, use aggregate counters only; no queries, topics, or user IDs.
4. Cost/rate telemetry used for passive provider-price monitoring must not add stored query text or research-interest content.

## Canonical records

- Project decisions: `docs/decisions.md`
- Current operational state: `docs/current-state.md`
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- P0.5 frozen preregistration: `docs/experiments/p05-hybrid-semantic.md`
- P0.5 frozen fresh holdout: `docs/experiments/p05-hybrid-semantic-holdout.md`
- D-013 live reconciliation: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`
- Research privacy/evidence invariants: `docs/privacy/research-privacy.md`
- Reviewer packet completeness control: `docs/reviewer-packet-checklist.md`
- Governance red-team review: `docs/reviews/2026-09-10-governance-red-team.md`
- P0.5-A experiment history: `docs/experiments/p05a-lexical.md`

Last updated: 2026-09-10
