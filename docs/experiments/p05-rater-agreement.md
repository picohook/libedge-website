# P0.5 Blind Rater Agreement — Pre-Mapping Diagnostic

Status: `ACTIVE`
Qualifier: `PRE-MAPPING AGREEMENT COMPLETE — MAPPING STILL SEALED`
Locked plan: `2026-09-10`
Computed: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Frozen evaluator bundle: `docs/experiments/p05-hybrid-semantic-evaluator-bundle.md`

## Purpose

Define and record the inter-rater agreement diagnostic before opening the private A/B/C-to-arm mapping. This diagnostic is descriptive only. It cannot change labels, rubric interpretation, query inclusion, gate rules, third-rater triggers, or production decisions.

## Inputs

Exactly two completed primary blind-rater outputs:

- Primary Blind Rater 1 — FINAL / LOCKED
- Primary Blind Rater 2 — FINAL / LOCKED

Both correspond to bundle version `p05-fresh-evaluator-v1` and the same frozen public evaluator bundle.

## Mechanical input-integrity checks — COMPLETE / PASS

Verified before agreement computation:

1. Both rater outputs are explicitly FINAL / LOCKED.
2. Exactly 40 anonymous query IDs `Q01`–`Q40` are present in each output.
3. Every query contains exactly lists `A`, `B`, and `C`.
4. Every list contains exactly 10 labels.
5. Every result ID matches the same frozen bundle position identifier for the same `queryId + list + rank`.
6. The two outputs contain the same 1,200 result IDs with no missing, extra, duplicate, renumbered, or reordered comparison units.
7. Every label is exactly one of `R`, `M`, `N`.
8. Intent text is identical across both outputs for all 40 queries.

Rater output schemas differ, but normalization to the frozen comparison key produced 1,200/1,200 exact structural matches.

## Unit of comparison

One evaluator-visible result position, keyed by:

`queryId + anonymous list alias (A/B/C) + rank/resultId`

Total valid comparison units: `1,200`.

## Locked agreement results

### Primary statistic — exact agreement

Exact agreement count: `747 / 1,200`

Exact agreement rate: `62.25%`

### 3×3 confusion matrix

Rows = Primary Blind Rater 1; columns = Primary Blind Rater 2.

|  | R2=R | R2=M | R2=N |
|---|---:|---:|---:|
| **R1=R** | 284 | 80 | 3 |
| **R1=M** | 202 | 384 | 146 |
| **R1=N** | 4 | 18 | 79 |

### Secondary statistic — adjacent disagreement

Adjacent disagreements are only R↔M or M↔N.

Count: `446 / 1,200`

Rate: `37.17%`

### Secondary statistic — extreme disagreement

Extreme disagreements are only R↔N.

Count: `7 / 1,200`

Rate: `0.58%`

Control total: `747 + 446 + 7 = 1,200`.

## Query-level descriptive diagnostic

Queries with at least one R↔N disagreement, ordered by frozen descriptive rule:

| Query | Exact | Adjacent | R↔N |
|---|---:|---:|---:|
| Q36 | 13/30 | 14 | 3 |
| Q27 | 19/30 | 9 | 2 |
| Q20 | 16/30 | 13 | 1 |
| Q33 | 19/30 | 10 | 1 |

Low exact-agreement examples with no R↔N disagreement:

| Query | Exact | Adjacent | R↔N |
|---|---:|---:|---:|
| Q30 | 7/30 | 23 | 0 |
| Q14 | 9/30 | 21 | 0 |
| Q24 | 10/30 | 20 | 0 |
| Q32 | 10/30 | 20 | 0 |

High exact-agreement examples:

| Query | Exact | Adjacent | R↔N |
|---|---:|---:|---:|
| Q19 | 29/30 | 1 | 0 |
| Q40 | 28/30 | 2 | 0 |

The full 40-query computation was completed; only representative/query-extreme rows are reproduced here because the locked protocol requires the counts, not a mandatory full table in this canonical file.

## Rater marginal label distributions — descriptive only

Primary Blind Rater 1:
- R = `367`
- M = `732`
- N = `101`

Primary Blind Rater 2:
- R = `490`
- M = `482`
- N = `228`

These marginal differences are descriptive only and may not be used to relabel, exclude, adjudicate, or modify gate logic.

## Mapping and slice boundary

The private A/B/C-to-L/S/H mapping remained SEALED throughout this pre-mapping agreement computation.

The frozen public bundle does not expose holdout slice tags. Therefore:

- no arm-specific agreement statistic was computed before mapping opens;
- no conjunctive / lexical-ambiguity / technical-jargon slice agreement statistic was computed before mapping opens;
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

This diagnostic describes rater consistency, not retrieval quality. No A/B/C list was interpreted as lexical, semantic, or hybrid during computation. No mapping inference was attempted from agreement patterns, list overlap, label distributions, or query behavior.

Observed pattern, descriptive only: extreme R↔N disagreement is rare (`0.58%`), while most disagreement is adjacent to M (`37.17%`). This may reflect different rater strictness around the M boundary, but this observation has no protocol consequence.

## Reviewer verification

Independent reviewer mechanically normalized both FINAL/LOCKED rater outputs, confirmed 1,200/1,200 structural alignment, and independently reproduced the same confusion matrix and exact/adjacent/R↔N counts. Reviewer reports no blocker to opening the frozen private mapping under the parent protocol.

## Next permitted operation

Because both primary label sets are FINAL / LOCKED and pre-mapping agreement is complete:

1. Open the frozen private A/B/C-to-L/S/H mapping.
2. Reveal the frozen randomization seed and verify it against the recorded seed commitment.
3. Compute Gate A, Gate B, and S-vs-L component vectors separately per primary rater under the preregistered mechanical-validity rules.
4. Request a third blind rater only if the two primary raters differ on the binary disposition of Gate A or Gate B.

Last updated: 2026-09-10
