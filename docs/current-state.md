# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Hybrid Semantic Retrieval fresh-holdout construction under FROZEN preregistration.

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
- D-013 semantic pricing reconciliation — CLOSED / LOCKED at observed `$0.001/call` (`$1/1,000`) for P0.5 planning; raw evidence in `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`.
- P0.5 Hybrid Semantic Retrieval preregistration — FROZEN 2026-09-10 before any fresh gate holdout generation.
- Pre-holdout economic amendment — CLOSED before holdout generation/results: total provider budget corrected to include both L and S calls.

## ACTIVE

- Construct and freeze the fresh 40-query hypothesis-driven holdout under the frozen protocol.
- Candidate architecture under test:
  - L: OpenAlex lexical top-100 baseline.
  - S: OpenAlex semantic top-50 retrieval.
  - H: L/S union -> canonical deduplication -> RRF `k=60` -> deterministic tie-break -> top 10; no additional provider call.
- OpenAlex semantic-search operational constraint: <=1 request/second.
- P0.5 frozen economic assumption: measured `$0.001 / provider call` for both D-013 semantic observations and lexical control. Base plan: 45 lexical + 45 semantic = 90 provider calls / `$0.090`. Operational cap: 120 charged provider calls / `$0.120`, allowing 30 retry calls across L+S.
- Passive charged-cost/credit monitoring is ACTIVE for the upcoming 40-query batch and later 5-query harm slice, not only future production. Cost monitoring stores no query/topic/user research-interest content. Material semantic price deviation or body/header conflict reopens D-013; lexical price deviation is also recorded as a provider-pricing anomaly because it affects the frozen total-cost budget.
- Production semantic/hybrid retrieval remains NOT ADOPTED pending fresh-holdout evidence and a later architecture decision.

## NEXT

1. Generate exactly 40 previously unseen intents after the preregistration freeze: 10 Materials/Energy, 10 Biomedical, 10 Social Science, 10 Humanities.
2. Freeze domain and slice tags before retrieval; conjunctive >=12, lexical ambiguity >=8, technical/jargon >=8.
3. Do not inspect retrieval results while constructing/revising the holdout.
4. Execute one L and one S provider request per frozen intent with passive cost telemetry; H reuses those candidate sets and applies frozen RRF rules with no tuning.
5. Prepare/freeze the randomized evaluator bundle and its evidence fields.
6. Obtain two independent blind-rater label sets in separate fresh lineages; third rater only for Gate A/B disagreement.
7. Report all component vectors per rater and apply the frozen A/B matrix.
8. Only after fresh-gate reconciliation run the separate A1/A2/A5/A6/A7 two-rater harm diagnostic with the same provider-cost monitoring.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as the semantic gate set.
- Reranking-only architecture restricted to lexical candidates.
- Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- D-013 pricing unless materially different authenticated charged-cost telemetry appears.
- Frozen P0.5 retrieval/fusion/gate parameters in response to observed holdout results.

## Evaluation invariants

- Conjunctive-intent rule: R only if available evaluation evidence directly covers all essential explicitly stated components; one essential component only is M; indirect/topic-adjacent is N.
- Seen diagnostic data and fresh gate data remain physically/procedurally separated.
- Reviewer receives summary plus raw materials and may challenge implementer framing.
- Blind evaluator receives only frozen evaluation materials/rubric; no mapping, prior labels, gate metrics, or discussion history.
- Numeric rater metrics remain per-rater; only preregistered binary Gate A/B dispositions may use the third-rater 2-of-3 rule.

## Privacy invariants

1. Never claim more evidence than the system has actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Future institutional analytics, if implemented, must use aggregate counters only; no queries, topics, or user IDs.
4. Cost/rate telemetry used for passive provider-price monitoring must not add stored query text or research-interest content.

## Canonical records

- Project decisions: `docs/decisions.md`
- Current operational state: `docs/current-state.md`
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- P0.5 frozen hybrid experiment/preregistration: `docs/experiments/p05-hybrid-semantic.md`
- D-013 live reconciliation: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`
- Research privacy/evidence invariants: `docs/privacy/research-privacy.md`
- Reviewer packet completeness control: `docs/reviewer-packet-checklist.md`
- Governance red-team review: `docs/reviews/2026-09-10-governance-red-team.md`
- P0.5-A experiment history: `docs/experiments/p05a-lexical.md`

## Status semantics

Decision lifecycle status is defined in `docs/decisions.md` and is distinct from file-level canonical-record status.

Canonical file statuses:
- `ACTIVE` — current/governing operational record.
- `HISTORICAL` — closed canonical audit/history record.
- `SUPERSEDED` — file itself replaced; replacement must be named.

Last updated: 2026-09-10
