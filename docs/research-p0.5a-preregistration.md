# P0.5-A Conditional Lexical Feasibility Test — Preregistration

Status: PREREGISTERED BEFORE HOLDOUT RESULTS

## Question
Can LibEdge identify, from query text/structure alone, the narrow cases where applying exactly one phrase constraint improves OpenAlex relevance without reproducing the large regressions seen in the global phrase experiment?

This is the final lexical-heuristic round. If either Gate A or Gate B fails, no additional lexical heuristic tuning round will be opened; P0.5 semantic reranking becomes the next path.

## Fixed strategy
- Baseline is the current unmodified lexical OpenAlex search.
- Phrase constraints are OFF by default.
- The heuristic may inspect query text/structure only. It may not inspect retrieval results, provider scores, titles, abstracts, citations, or metadata before deciding.
- At most ONE multi-word phrase may be quoted.
- A technical/jargon veto always overrides an ambiguity/established-phrase allow signal.
- If signals conflict, outcome = baseline/no phrase.

## Fixed holdout
30 queries total, fixed before retrieval results are inspected:
- 10 lexical-ambiguity / wrong-sense-risk queries
- 10 technical-compound / jargon-heavy queries
- 10 neutral controls

Queries are distributed across materials/energy, biomedicine, social science, and humanities. The old eight A/B queries are not reused as holdout cases.

## Heuristic under test
The heuristic is deliberately conservative and default-off.

1. Jargon veto: phrase rewriting is disabled when the query contains strong technical markers such as domain acronyms, chemical/material formulas, gene/protein nomenclature, model/version tokens, or two or more terms from the fixed technical-marker lexicon in the script.
2. Narrow allow: otherwise, rewriting is allowed only when the query contains exactly one fixed ambiguity-risk/established phrase from the preregistered phrase lexicon in the script.
3. If allowed, quote only that one phrase and leave all remaining query terms as ordinary keywords.
4. If more than one allow phrase matches, do not rewrite (ambiguity of the heuristic itself -> default-off).

The phrase lexicon and technical-marker lexicon are frozen in `scripts/research-query-conditional.mjs` before the holdout run.

## Ground-truth label for Gate A
After blind result-level relevance judgments are returned, phrase treatment for a query is considered:
- BENEFICIAL if phrase candidate Relevant@10 exceeds baseline by >= 20 percentage points;
- HARMFUL if phrase candidate is below baseline by >= 20 percentage points;
- NEUTRAL if absolute difference is <= 10 percentage points.

Because top-10 judgments move in 10-point increments, there is no unclassified interval between these bands.

For Gate A, the heuristic's positive prediction is `apply phrase`; negative prediction is `keep baseline`. BENEFICIAL is the positive ground truth. HARMFUL and NEUTRAL are negative ground truth.

## Gate A — heuristic classification
All must pass:
- Precision for predicting BENEFICIAL >= 0.85.
- Recall for BENEFICIAL >= 0.70.
- False-positive rate within jargon-heavy group <= 0.10 (max 1/10).
- Overall harmful-application rate <= 0.10 (max 3/30 queries where heuristic applies phrase and observed effect is HARMFUL).

Precision is intentionally stricter than recall because false positives can recreate severe regressions. If no BENEFICIAL cases occur in the holdout, Gate A fails rather than being treated as vacuously successful.

## Gate B — downstream conditional relevance
Construct the conditional system output per query: use phrase candidate only where the heuristic predicted `apply phrase`; otherwise use baseline.

All must pass:
- Mean Relevant@10 gain across all 30 queries >= +5 percentage points.
- At least 24/30 queries are non-worse than baseline (>=80%).
- At least 5/30 queries improve by >=20 percentage points.
- No discipline mean may regress by >5 percentage points.
- No single query may regress by >20 percentage points.
- Conditional result count must be >=8 for every query.

The mean-gain threshold is lower than the prior global A/B gate because the strategy is intentionally sparse/default-off; most queries should remain identical to baseline. Safety/regression thresholds are correspondingly stricter.

## Ceiling cases
A baseline Relevant@10 of 90% or 100% is flagged as a ceiling case and reported separately. It still counts normally for regression/non-worse gates; the flag is interpretive only and does not erase observed harm.

## Blind evaluation
- Baseline and candidate are presented as X/Y with query-specific randomized ordering.
- Evaluator receives intent plus titles, not mapping or strategy details.
- Each title is labeled Relevant / Marginal / Not relevant.
- Primary metric is Relevant@10. Marginal counts are reported separately as diagnostic context and do not count as Relevant for gates.

## Diagnostic interpretation
Gate A and Gate B are reported independently:
- A PASS / B PASS: conditional lexical strategy is viable for P1.
- A PASS / B FAIL: query-type detection is plausible, but phrase quoting is the wrong/insufficient retrieval intervention.
- A FAIL / B PASS: operational gain exists but classifier is not trustworthy; do not ship.
- A FAIL / B FAIL: both detection and intervention are inadequate.

Any failure -> no further lexical-heuristic tuning round; proceed to P0.5 semantic reranking evaluation.
