# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Hybrid Semantic Retrieval feasibility and preregistration.

## CLOSED

- P0 Academic Metadata Gateway — CLOSED.
- P0 metadata/plumbing validation — CLOSED; plumbing GREEN, lexical relevance YELLOW.
- Global selective-phrase rewrite A/B — CLOSED / REJECTED.
- P0.5-A conditional lexical feasibility — CLOSED / FAIL.
- P0.5-A rater reconciliation — CLOSED; rater-definition robust A2 FAIL / B FAIL.
- Lexical top-100 depth diagnostic — CLOSED.
- Semantic-vs-lexical gap diagnostic — CLOSED; material retrieval-level recall gap found.
- Governance red-team review 2026-09-10 — CLOSED; findings triaged and control-plane corrections applied.

## ACTIVE

- Define and preregister P0.5 Hybrid Semantic Retrieval experiment.
- Candidate architecture under test:
  - L: OpenAlex lexical retrieval baseline.
  - S: OpenAlex semantic retrieval.
  - H: lexical + semantic candidate union -> deduplication -> preregistered deterministic fusion/ranking -> top 10.
- H-arm fusion/ranking algorithm is NOT YET DEFINED and must be frozen before execution.
- OpenAlex semantic-search operational constraint: <=1 request/second.
- Current planning price for OpenAlex semantic search: $1/1,000 calls as of 2026-09-10 official documentation check; historical contrary pricing report retained as reopenable conflict evidence.

## NEXT

1. Freeze P0.5 Hybrid Semantic Retrieval preregistration before implementation tuning.
2. Define and freeze H-arm candidate depths, dedup identity rule, fusion/ranking algorithm, normalization (if any), tie-breaking, and truncation rule.
3. Construct a fresh, previously unseen hypothesis-driven holdout.
4. Include a predeclared conjunctive-intent slice.
5. Preserve the existing 30-query P0.5-A benchmark as diagnostic-only.
6. Preserve A1/A2/A5/A6/A7 as a mandatory harm-regression slice; it cannot determine Gate PASS by itself.
7. Pace semantic retrieval at <=1 request/second and account for current documented semantic-search pricing.
8. Run blind evaluation in a physically separate evaluator thread with minimum necessary context only.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as the semantic gate set.
- Reranking-only architecture restricted to lexical candidates.
- Vectorize before evidence shows OpenAlex semantic retrieval / hybrid retrieval is insufficient.

## Evaluation invariants

- Conjunctive-intent rule: an item is R only if the available evaluation evidence directly covers all essential explicitly stated intent components. One essential component only is M; indirect/topic-adjacent is N.
- Seen diagnostic data and fresh gate data are physically and procedurally separated.
- Reviewer thread receives summary plus raw materials and may challenge the implementer framing.
- Blind evaluator receives only frozen evaluation materials and rubric; no mapping, prior labels, gate metrics, or discussion history.

## Privacy invariants

1. Never claim more evidence than the system has actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Future institutional analytics, if implemented, must use aggregate counters only; no queries, topics, or user IDs.

## Canonical records

- Project decisions: `docs/decisions.md`
- Current operational state: `docs/current-state.md`
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- Research privacy/evidence invariants: `docs/privacy/research-privacy.md`
- Reviewer packet completeness control: `docs/reviewer-packet-checklist.md`
- Governance red-team review: `docs/reviews/2026-09-10-governance-red-team.md`
- P0.5-A experiment history: `docs/experiments/p05a-lexical.md`
- Future P0.5 hybrid experiment: `docs/experiments/p05-hybrid-semantic.md` (to be created at preregistration)

## Status semantics

Decision lifecycle status is defined in `docs/decisions.md` and is distinct from file-level canonical-record status.

Canonical file statuses:
- `ACTIVE` — current/governing operational record.
- `HISTORICAL` — closed canonical audit/history record.
- `SUPERSEDED` — file itself replaced; replacement must be named.

Last updated: 2026-09-10
