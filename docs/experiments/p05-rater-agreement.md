# P0.5 Blind Rater Agreement — Pre-Mapping Diagnostic Plan

Status: `ACTIVE`
Qualifier: `DIAGNOSTIC PLAN LOCKED BEFORE AGREEMENT COMPUTATION — MAPPING SEALED`
Locked: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Frozen evaluator bundle: `docs/experiments/p05-hybrid-semantic-evaluator-bundle.md`

## Purpose

Define the inter-rater agreement diagnostic before computing any agreement statistic and before opening the private A/B/C-to-arm mapping. This diagnostic is descriptive only. It cannot change labels, rubric interpretation, query inclusion, gate rules, third-rater triggers, or production decisions.

## Inputs

Exactly two completed primary blind-rater outputs:

- Primary Blind Rater 1 — FINAL / LOCKED
- Primary Blind Rater 2 — FINAL / LOCKED

Both must correspond to bundle version `p05-fresh-evaluator-v1` and the same frozen public evaluator bundle.

## Mechanical input-integrity checks

Before computing agreement, verify for each rater output:

1. The rater output is explicitly FINAL / LOCKED.
2. Exactly 40 anonymous query IDs `Q01`–`Q40` are present.
3. Every query contains exactly lists `A`, `B`, and `C`.
4. Every list contains exactly 10 labels.
5. Every result ID matches the frozen bundle position identifier for the same `queryId + list + rank`.
6. The two rater outputs use the same frozen query IDs, intents, A/B/C aliases, result IDs, and rank positions; no rater-side renumbering or reordering is permitted.
7. Every label is exactly one of `R`, `M`, `N`.

Any mechanical mismatch is recorded as an input-integrity defect and resolved from the already-frozen rater output / frozen public bundle only. Labels themselves may not be changed.

## Unit of comparison

One evaluator-visible result position, keyed by:

`queryId + anonymous list alias (A/B/C) + rank/resultId`

Total expected comparison units: `40 × 3 × 10 = 1,200`.

## Locked agreement statistics

### Primary statistic

**Exact agreement rate**

A comparison unit agrees exactly only when both raters assign the same label:

- R/R
- M/M
- N/N

Report:

- exact-agreement count
- exact-agreement percentage over all 1,200 valid comparison units
- full 3×3 confusion matrix with Rater 1 as rows and Rater 2 as columns

### Secondary descriptive statistics

**Adjacent disagreement rate**

A disagreement is adjacent only when it is:

- R/M or M/R
- M/N or N/M

Report adjacent-disagreement count and percentage over all 1,200 valid comparison units.

**Extreme disagreement rate**

An extreme disagreement is only:

- R/N or N/R

Report R↔N count and percentage over all 1,200 valid comparison units.

### Query-level descriptive diagnostic

For each Q01–Q40, report:

- exact-agreement count out of 30
- adjacent-disagreement count out of 30
- R↔N count out of 30

Queries may be ranked descriptively by R↔N count, then total disagreement count, then anonymous query ID. This ranking is diagnostic only and cannot trigger any protocol action.

## Mapping and slice boundary

The private A/B/C-to-L/S/H mapping remains SEALED during this pre-mapping agreement computation.

The frozen public bundle does not expose holdout slice tags. Therefore:

- no arm-specific agreement statistic is computed before mapping opens;
- no conjunctive / lexical-ambiguity / technical-jargon slice agreement statistic is computed before mapping opens;
- after both primary rater outputs are already locked and the mapping is legitimately opened under the parent protocol, arm- and slice-stratified agreement may be reported as an additional descriptive diagnostic only.

Post-mapping stratification may not alter any rater label, gate computation, query inclusion, or third-rater trigger.

## Non-trigger / non-intervention invariant

Agreement results are **diagnostic only**.

No exact-agreement threshold, adjacent-disagreement rate, R↔N rate, query-level disagreement concentration, arm-level disagreement, or slice-level disagreement may be used to:

- exclude or downweight any query/result;
- relabel any item;
- reinterpret the frozen R/M/N rubric;
- reopen the frozen evaluator bundle;
- request a third rater;
- change Gate A or Gate B computation;
- change the preregistered third-rater trigger;
- change the A/B decision matrix;
- justify production adoption or rejection.

The only third-rater trigger remains the one already frozen in the parent protocol: after mapping opens and per-rater gate results are computed, a third blind rater is requested only if the two primary raters differ on the binary disposition of Gate A or Gate B. S-vs-L disagreement or inter-rater agreement diagnostics alone do not trigger a third rater.

## Interpretation boundary

This diagnostic describes rater consistency, not retrieval quality. No A/B/C list may be interpreted as lexical, semantic, or hybrid before mapping is legitimately opened. No attempt may be made to infer mapping from agreement patterns, list overlap, label distributions, or query behavior.

## Next permitted operation

1. Mechanically validate both FINAL / LOCKED rater outputs against the frozen public bundle identifiers.
2. Compute only the locked pre-mapping agreement statistics defined above.
3. Record the diagnostic result without interpreting retrieval-arm quality.
4. Then, because both primary label sets are already locked, open the frozen private mapping under the parent protocol, reveal/verify the seed commitment, and compute Gate A, Gate B, and S-vs-L separately per rater.

Last updated: 2026-09-10
