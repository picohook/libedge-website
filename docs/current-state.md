# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Hybrid Semantic Retrieval preregistration freeze and fresh-holdout construction.

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
- D-013 semantic pricing reconciliation — CLOSED by live authenticated telemetry on 2026-09-10. Three successful `search.semantic` calls each returned `meta.cost_usd = 0.001` and `X-RateLimit-Cost-USD = 0.001`; lexical control produced a distinct result set. Observed charged price: `$1 / 1,000` semantic calls. Canonical evidence: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`.

## ACTIVE

- Freeze `docs/experiments/p05-hybrid-semantic.md` before fresh holdout generation.
- Candidate architecture under test:
  - L: OpenAlex lexical top-100 baseline.
  - S: OpenAlex semantic top-50 retrieval.
  - H: L/S union -> canonical deduplication -> RRF `k=60` -> deterministic tie-break -> top 10.
- OpenAlex semantic-search operational constraint: <=1 request/second.
- P0.5 economic assumption: `$0.001 / semantic call` (`$1 / 1,000`), reconciled by authenticated live telemetry. Reopen only on materially different authenticated charge telemetry.
- Production semantic/hybrid retrieval remains NOT ADOPTED pending the frozen fresh-holdout experiment.

## NEXT

1. Mark the reviewed P0.5 Hybrid Semantic Retrieval preregistration FROZEN.
2. Generate and freeze the fresh 40-query hypothesis-driven holdout only after freeze.
3. Preserve four-domain balance and preregistered conjunctive, lexical-ambiguity, jargon and broad/straightforward structure.
4. Execute L/S/H without tuning, pacing semantic calls at <=1 request/second.
5. Prepare the frozen randomized evaluator bundle.
6. Obtain two independent blind-rater label sets in physically separate fresh lineages; use a third fresh lineage only for Gate A/B disagreement as preregistered.
7. Report Gate A, Gate B and S-vs-L component vectors per rater; never synthesize numeric consensus metrics.
8. After gate reconciliation, run A1/A2/A5/A6/A7 as the separate two-rater blind harm-regression diagnostic.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as the semantic gate set.
- Reranking-only architecture restricted to lexical candidates.
- Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- D-013 pricing conflict unless materially different authenticated charge telemetry appears.

## Evaluation invariants

- Conjunctive-intent rule: an item is R only if the available evaluation evidence directly covers all essential explicitly stated intent components. One essential component only is M; indirect/topic-adjacent is N.
- Seen diagnostic data and fresh gate data are physically and procedurally separated.
- Reviewer thread receives summary plus raw materials and may challenge the implementer framing.
- Blind evaluator receives only frozen evaluation materials and rubric; no mapping, prior labels, gate metrics, or discussion history.
- Numeric rater metrics remain per-rater; only preregistered binary Gate A/B dispositions may use the third-rater 2-of-3 rule.

## Privacy invariants

1. Never claim more evidence than the system has actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Future institutional analytics, if implemented, must use aggregate counters only; no queries, topics, or user IDs.

## Canonical records

- Project decisions: `docs/decisions.md`
- Current operational state: `docs/current-state.md`
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- P0.5 hybrid experiment/preregistration: `docs/experiments/p05-hybrid-semantic.md`
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
