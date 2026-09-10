# P0.5-A — Conditional Lexical Feasibility

Status: `ACTIVE CANONICAL RECORD — EXPERIMENT CLOSED / OUTCOME REJECTED`
Canonical decision: `docs/decisions.md` D-005
Supersession rule: this historical experiment record remains canonical for P0.5-A even after later experiments supersede its product direction; if the record itself is replaced, mark it `SUPERSEDED` and name the replacement explicitly.

## CURRENT LOCKED PROTOCOL

Status: `CLOSED — FAIL`

Purpose: test whether a query-only conditional phrase heuristic can improve lexical relevance without unacceptable regressions.

Heuristic:
1. Jargon/technical veto overrides any allow signal.
2. Otherwise, if exactly one allowlisted phrase is present, quote that phrase.
3. Otherwise use baseline query.
4. Maximum one quoted phrase.
5. Default off.
6. No result inspection when deciding whether to apply.

Evaluation labels:
- `R` = directly relevant.
- `M` = materially related but not fully relevant.
- `N` = indirect/topic-adjacent or irrelevant.
- For conjunctive intent, `R` requires direct coverage of all essential explicitly stated components; one essential component only is `M`.

Coverage rule:
- Coverage is baseline-relative and symmetric.
- Coverage regression if baseline_count >= 8 and selected_count < 8, OR selected_count / baseline_count < 0.80.
- Any query where baseline or selected count < 8 is `low-corpus` and excluded from aggregate relevance metrics.

Gate A2 empirical classifier metrics:
- Precision >= 0.85.
- Recall >= 0.70.
- False-veto <= 0.10 among coverage-valid jargon-veto queries.
- Harmful-application <= 0.10 among coverage-valid apply=true queries.
- Beneficial = delta Relevant@10 >= +10pp and no phrase coverage regression.
- Harmful = delta Relevant@10 <= -10pp OR phrase coverage regression.

Gate B selected-strategy metrics:
- Mean Relevant@10 gain >= +5pp.
- Non-worse count >= ceil(0.625 * N_eff).
- Strong improvement count >= ceil(0.375 * N_eff), where strong = >= +20pp.
- No discipline mean regression worse than -5pp.
- No single-query regression worse than -20pp.
- Low-corpus queries excluded from aggregate calculations.

Rater reconciliation rule:
- Existing rating sets are never altered after mapping open.
- Run the entire Gate A2 and Gate B chain separately on both sets.
- Rater-definition convergence requires the same Gate A2 PASS/FAIL and Gate B PASS/FAIL pattern.
- If either gate differs between raters, result is rater-sensitive/inconclusive and a third evaluator is required.
- Third evaluator, if required, must receive only query ID, intent, X/Y titles, and the locked rubric in a fresh isolated context.

Final result:
- Rating Set 1: Gate A2 FAIL / Gate B FAIL.
- Rating Set 2: Gate A2 FAIL / Gate B FAIL.
- Result: `RATER-DEFINITION ROBUST FAIL`.
- Third evaluator not required.
- The heuristic is rejected and no second lexical heuristic round will be opened.

Known diagnostic-only set:
- The 30-query P0.5-A benchmark is now seen/contaminated and may only be used for diagnostics/regression, never as a future gate benchmark for the same development line.
- A1, A2, A5, A6, A7 form a mandatory harm-regression slice for later semantic/hybrid work but cannot by themselves determine future Gate PASS.

## FINAL METRICS

### Rating Set 1

Gate A2:
- TP=4, FP=6, FN=5, TN=14.
- Precision 40.0% — FAIL.
- Recall 44.44% — FAIL.
- False-veto 1/9 = 11.11% — FAIL.
- Harmful application 5/10 = 50.0% — FAIL.
- Harmful applied queries: A1, A2, A5, A6, A7.

Gate B:
- N_eff=29.
- Mean gain +1.03448pp — FAIL.
- Non-worse 24/29 — PASS.
- Strong improvement 3/29 — FAIL.
- Discipline means: social +0.9091pp; materials -6.25pp FAIL; humanities +14.0pp; biomedical 0.0pp.
- Worst single query -40pp — FAIL.
- Coverage handling PASS.

### Rating Set 2

Gate A2:
- TP=3, FP=7, FN=4, TN=15.
- Precision 30.0% — FAIL.
- Recall 42.857% — FAIL.
- False-veto 1/9 = 11.11% — FAIL.
- Harmful application 5/10 = 50.0% — FAIL.
- Harmful applied queries: A1, A2, A5, A6, A7.

Gate B:
- N_eff=29.
- Mean gain -1.37931pp — FAIL.
- Non-worse 24/29 — PASS.
- Strong improvement 2/29 — FAIL.
- Discipline means: social -6.3636pp FAIL; materials -5.0pp PASS; humanities +14.0pp; biomedical 0.0pp.
- Worst single query -40pp — FAIL.
- Coverage handling PASS.

## AMENDMENT HISTORY

This section is append-only. New amendments may be added only before the relevant evaluation stage they govern; they must never silently rewrite the historical record.

### A-001 — Original preregistration

Original experiment used a 30-query holdout: 10 ambiguity, 10 jargon, 10 neutral.
Original Gate A thresholds: precision 0.85, recall 0.70, jargon false-positive rate 0.10, harmful application 0.10.
Original Gate B: mean +5pp; >=24/30 non-worse; >=5/30 strong >=+20pp; no discipline regression >5pp; no single query < -20pp; selected >=8 results for every query.
Decision tree already specified that a failed lexical heuristic would not trigger a second lexical round; next step would be semantic work.

### A-002 — Coverage amendment

Before blind labels, absolute selected>=8 was replaced with baseline-relative coverage plus low-corpus exclusion because OpenAlex itself returned sparse result sets for some queries.

### A-003 — Harm definition clarification

Before evaluation, harmful was clarified as delta <= -10pp OR phrase-treatment coverage regression. Weak-negative values between 0 and -10pp remained non-harmful.

### A-004 — False-veto terminology

The jargon metric was renamed `false-veto` because the mechanism predicts non-application rather than a conventional positive class.

### A-005 — Gate A split

Gate A was separated into structural correctness (A1) and empirical classifier quality (A2).

### A-006 — N_eff scaling

Gate B count thresholds were converted from fixed 30-query counts to proportions over N_eff: non-worse >=62.5%, strong >=37.5%.

### A-007 — Binary beneficial class

For empirical Gate A2, only `beneficial` counts as positive. Weak-positive, neutral, weak-negative, and harmful are negative; low-corpus queries are excluded.

### A-008 — Rater reconciliation lock

Before mapping open, the two-rating-set reconciliation rule was locked, including the requirement that gate-pattern agreement, not ship-level agreement alone, determines rater-definition robustness.

## FINAL INTERPRETATION

The experiment failed in both directions: precision and recall were both far below threshold. This is not a simple aggressiveness or threshold-calibration problem. The conditional lexical phrase heuristic is therefore not a production path.

The jargon-veto result is treated as low-N/inconclusive, not as strong evidence that the veto nearly succeeded.

The experiment remains useful as diagnostic evidence and as a regression source for later semantic/hybrid retrieval work.

Last updated: 2026-09-10
