# P0.5 — Seen Harm-Regression Evaluation

Status: `ACTIVE`
Qualifier: `BOTH PRIMARY RATERS FINAL/LOCKED — MAPPING REVEALED — DIAGNOSTIC COMPUTED / PENDING INDEPENDENT REVIEW`
Evaluated: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Retrieval record: `docs/experiments/p05-harm-regression-retrieval.md`
Frozen evaluator-bundle record: `docs/experiments/p05-harm-evaluator-bundle.md`

## Preconditions

- Primary Blind Rater 1 — Harm Diagnostic: `FINAL / LOCKED`, 150/150 labels.
- Primary Blind Rater 2 — Harm Diagnostic: `FINAL / LOCKED`, 150/150 labels.
- Neither rater saw the private mapping or the other rater's output before locking.
- No labels were reconciled, averaged, relabeled, excluded, or changed.
- Under the frozen parent protocol this slice is diagnostic only, cannot rescue/create Gate PASS, and rater disagreement does not trigger a third rater.
- Private mapping was opened only after both primary harm label sets were locked.

## Mapping reveal and seed verification

Frozen exact artifact pair was independently reviewed before blind-rater use. The byte-identical private mapping retained its construction-time `PROVISIONAL` field because freeze promotion was governance-only and explicitly prohibited rebuild/rerandomization.

Private mapping:

- Mapping file: `p05-harm-evaluator-mapping.json`
- Mapping-file SHA-256: `b631edb52b79ba2f48a4a8199521a5db2f9f412be9f9a03b84264f00058f3a14`
- Private mapping ZIP SHA-256: `26a76e571492326a893a9cf7606e596579e2b63c8fa8ff0c31ea872f4cd34e40`

Revealed seed:

`2c8962a7f6ce1914d09cb9e45a148cc3077bf584d33052d6a673842dd6dba0c2`

Frozen seed commitment:

`3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`

Verification: `SHA-256(UTF-8(revealed seed)) = 3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`.

Result: **MATCH / commitment verified**.

## Frozen mapping

| Anonymous query | Historical case | A | B | C |
| --- | --- | --- | --- | --- |
| Q01 | A6 | L | H | S |
| Q02 | A2 | H | S | L |
| Q03 | A1 | S | H | L |
| Q04 | A7 | S | H | L |
| Q05 | A5 | L | S | H |

## Mechanical validity / coverage

Accepted harm retrieval established:

- all five L and all five S retrievals succeeded;
- H available for all five cases;
- no `retrieval-failure`;
- no low-corpus pair (minimum unique S pool was 13);
- H vs L coverage regressions: `0/5`;
- H vs S coverage regressions: `0/5`;
- S vs L coverage regressions: `5/5` under the frozen rule because L=100 while S<=50. This remains reported as the preregistered candidate-depth asymmetry artifact and is not reinterpreted as a standalone relevance conclusion.

## Primary Blind Rater 1

Arm-level labels across 50 displayed results per arm:

| Arm | R | M | N | Relevant@10 mean | (R+M)@10 mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| L | 22 | 23 | 5 | 44% | 90% |
| S | 39 | 11 | 0 | 78% | 100% |
| H | 36 | 11 | 3 | 72% | 94% |

Primary Relevant@10 deltas across the five cases:

- H-L mean: `+28pp`.
- H-S mean: `-6pp`.
- S-L mean: `+34pp`.

| Historical case | L R@10 | S R@10 | H R@10 | H-L | H-S | S-L |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1 | 7 | 10 | 9 | +20pp | -10pp | +30pp |
| A2 | 2 | 9 | 6 | +40pp | -30pp | +70pp |
| A5 | 8 | 9 | 10 | +20pp | +10pp | +10pp |
| A6 | 1 | 8 | 6 | +50pp | -20pp | +70pp |
| A7 | 4 | 3 | 5 | +10pp | +20pp | -10pp |

Unfavorable results are retained: H is below S on A1, A2 and A6; S is below L on A7.

## Primary Blind Rater 2

Arm-level labels across 50 displayed results per arm:

| Arm | R | M | N | Relevant@10 mean | (R+M)@10 mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| L | 23 | 21 | 6 | 46% | 88% |
| S | 41 | 9 | 0 | 82% | 100% |
| H | 36 | 11 | 3 | 72% | 94% |

Primary Relevant@10 deltas across the five cases:

- H-L mean: `+26pp`.
- H-S mean: `-10pp`.
- S-L mean: `+36pp`.

| Historical case | L R@10 | S R@10 | H R@10 | H-L | H-S | S-L |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1 | 8 | 10 | 9 | +10pp | -10pp | +20pp |
| A2 | 2 | 9 | 6 | +40pp | -30pp | +70pp |
| A5 | 8 | 9 | 10 | +20pp | +10pp | +10pp |
| A6 | 1 | 7 | 4 | +30pp | -30pp | +60pp |
| A7 | 4 | 6 | 7 | +30pp | +10pp | +20pp |

Unfavorable results are retained: H is below S on A1, A2 and A6.

## Rater-specific diagnostic conclusion

The two locked raters are preserved separately; no synthetic consensus labels or averaged item judgments are created.

Both raters show the same arm-level directional pattern on Relevant@10:

`S > H > L`.

Both also identify the same three historical cases — A1, A2 and A6 — where H has lower Relevant@10 than S. Rater 1 additionally records an S-vs-L regression on A7; Rater 2 does not.

This is descriptive harm-regression evidence only. There is no harm-slice PASS/FAIL gate and no third-rater trigger.

## Relationship to fresh-gate result

The already independently accepted fresh-gate result remains unchanged:

- Gate A H vs L: PASS for both primary fresh raters.
- Gate B H vs S: FAIL for both primary fresh raters.
- Predeclared matrix: `H REJECTED`.

The seen harm slice cannot rescue or create a gate result. Its observed pattern is directionally consistent with the fresh evaluation in showing H above L on aggregate while below S on aggregate, but this statement is descriptive and does not modify the frozen gate outcome.

S remains a separate architecture candidate only; neither the fresh S-vs-L diagnostic nor this seen slice automatically adopts S into production.

## Review state and next permitted operation

This mapping reveal, seed verification, mechanical reconstruction, and rater-specific diagnostic are canonicalized as **PENDING INDEPENDENT REVIEW**.

Before closing the final P0.5 experiment outcome or making the separate production-architecture decision, obtain independent reviewer verification of:

1. both 150-label FINAL/LOCKED sets;
2. seed commitment;
3. private mapping;
4. per-case arm reconstruction;
5. R/M/N arm totals and Relevant@10 / (R+M)@10 calculations;
6. all H-L, H-S and S-L deltas;
7. mechanical coverage accounting;
8. the diagnostic-only / no-third-rater interpretation boundary.

No locked rater label may be changed during review.

Last updated: 2026-09-10
