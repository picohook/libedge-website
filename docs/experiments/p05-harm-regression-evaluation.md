# P0.5 — Seen Harm-Regression Evaluation

Status: `HISTORICAL — INDEPENDENTLY ACCEPTED / CLOSED`
Evaluated: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Retrieval record: `docs/experiments/p05-harm-regression-retrieval.md`
Frozen evaluator-bundle record: `docs/experiments/p05-harm-evaluator-bundle.md`
Independent review: `docs/reviews/2026-09-10-p05-harm-diagnostic-review.md`

## Preconditions

- Primary Blind Rater 1 — Harm Diagnostic: `FINAL / LOCKED`, 150/150 labels.
- Primary Blind Rater 2 — Harm Diagnostic: `FINAL / LOCKED`, 150/150 labels.
- Neither rater saw the private mapping or the other rater's output before locking.
- No labels were reconciled, averaged, relabeled, excluded, or changed.
- Under the frozen parent protocol this slice is diagnostic only, cannot rescue/create Gate PASS, and rater disagreement does not trigger a third rater.
- Private mapping was opened only after both primary harm label sets were locked.

## Mapping reveal and seed verification

Private mapping file SHA-256: `b631edb52b79ba2f48a4a8199521a5db2f9f412be9f9a03b84264f00058f3a14`.
Private mapping ZIP SHA-256: `26a76e571492326a893a9cf7606e596579e2b63c8fa8ff0c31ea872f4cd34e40`.

Revealed seed:

`2c8962a7f6ce1914d09cb9e45a148cc3077bf584d33052d6a673842dd6dba0c2`

Frozen seed commitment:

`3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`

Verification result: **MATCH**.

## Frozen mapping

| Anonymous query | Historical case | A | B | C |
| --- | --- | --- | --- | --- |
| Q01 | A6 | L | H | S |
| Q02 | A2 | H | S | L |
| Q03 | A1 | S | H | L |
| Q04 | A7 | S | H | L |
| Q05 | A5 | L | S | H |

## Mechanical validity / coverage

- all five L and all five S retrievals succeeded;
- H available for all five cases;
- no `retrieval-failure`;
- no low-corpus pair;
- H vs L coverage regressions: `0/5`;
- H vs S coverage regressions: `0/5`;
- S vs L coverage regressions: `5/5` under the frozen rule because L=100 while S<=50. This remains a candidate-depth asymmetry artifact and is not interpreted as a standalone relevance conclusion.

## Primary Blind Rater 1

| Arm | R | M | N | Relevant@10 mean | (R+M)@10 mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| L | 22 | 23 | 5 | 44% | 90% |
| S | 39 | 11 | 0 | 78% | 100% |
| H | 36 | 11 | 3 | 72% | 94% |

Mean Relevant@10 deltas:

- H-L: `+28pp`.
- H-S: `-6pp`.
- S-L: `+34pp`.

| Historical case | L R@10 | S R@10 | H R@10 | H-L | H-S | S-L |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1 | 7 | 10 | 9 | +20pp | -10pp | +30pp |
| A2 | 2 | 9 | 6 | +40pp | -30pp | +70pp |
| A5 | 8 | 9 | 10 | +20pp | +10pp | +10pp |
| A6 | 1 | 8 | 6 | +50pp | -20pp | +70pp |
| A7 | 4 | 3 | 5 | +10pp | +20pp | -10pp |

Unfavorable results retained: H<S on A1, A2 and A6; S<L on A7.

## Primary Blind Rater 2

| Arm | R | M | N | Relevant@10 mean | (R+M)@10 mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| L | 23 | 21 | 6 | 46% | 88% |
| S | 41 | 9 | 0 | 82% | 100% |
| H | 36 | 11 | 3 | 72% | 94% |

Mean Relevant@10 deltas:

- H-L: `+26pp`.
- H-S: `-10pp`.
- S-L: `+36pp`.

| Historical case | L R@10 | S R@10 | H R@10 | H-L | H-S | S-L |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1 | 8 | 10 | 9 | +10pp | -10pp | +20pp |
| A2 | 2 | 9 | 6 | +40pp | -30pp | +70pp |
| A5 | 8 | 9 | 10 | +20pp | +10pp | +10pp |
| A6 | 1 | 7 | 4 | +30pp | -30pp | +60pp |
| A7 | 4 | 6 | 7 | +30pp | +10pp | +20pp |

Unfavorable results retained: H<S on A1, A2 and A6.

## Diagnostic conclusion

Both independent locked raters show the same aggregate directional pattern on Relevant@10:

`S > H > L`.

This does not create a harm-slice PASS/FAIL gate and does not adopt S into production.

## Relationship to fresh-gate result

The independently accepted fresh-gate result remains:

- Gate A H vs L: PASS for both primary fresh raters.
- Gate B H vs S: FAIL for both primary fresh raters.
- Predeclared matrix: `H REJECTED`.

The seen harm slice is directionally consistent with that result while remaining diagnostic only.

## Independent review

The post-lock reconstruction was independently reviewed from the raw locked rater outputs and frozen mapping. Classification: **ACCEPTED — unconditional**. The reviewer reported zero discrepancies in seed verification, mapping reconstruction, arm totals, per-case deltas, coverage accounting, unfavorable-result retention, or interpretation boundaries.

Canonical review: `docs/reviews/2026-09-10-p05-harm-diagnostic-review.md`.

## Closure

This completes the frozen P0.5 experimental sequence. The experimental conclusion is that the tested H architecture is rejected. S remains a separate production-architecture candidate and requires an explicit D-016 architecture decision.

Last updated: 2026-09-10
