# P0.5 Hybrid Semantic Retrieval — Fresh-Gate Evaluation

Status: `ACTIVE`
Qualifier: `MAPPING OPENED AFTER BOTH PRIMARY RATERS LOCKED — GATE RESULTS COMPUTED / PENDING INDEPENDENT REVIEW`
Evaluated: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Agreement diagnostic: `docs/experiments/p05-rater-agreement.md`
Frozen holdout: `docs/experiments/p05-hybrid-semantic-holdout.md`

## Preconditions

- Primary Blind Rater 1: FINAL / LOCKED, 1,200/1,200 labels.
- Primary Blind Rater 2: FINAL / LOCKED, 1,200/1,200 labels.
- Pre-mapping agreement diagnostic completed under its locked diagnostic-only plan.
- No item labels were reconciled, averaged, relabeled, excluded, or changed.
- Private mapping was opened only after both primary label sets were locked.

## Mapping reveal and seed verification

Frozen private mapping artifact:

- GitHub Actions run: `34499706628`
- Artifact ID: `10161316449`
- Mapping file: `p05-evaluator-mapping.json`
- Mapping-file SHA-256: `defd6b39361dff452a826966769b680254d2bc43924143a52cfe2af7ed0b6b0c`

Revealed randomization seed:

`41cd61e3f6fd6cef1a58422e95585f1e1493f692d2308b7fc3d31169680dc34d`

Precommitted seed hash:

`388813fddbb0d2519baafa62cbc28af7e82f3a0cd665314c61ed4c1ddf801bd1`

Verification procedure:

`SHA-256(UTF-8(revealed seed string))`

Observed verification hash:

`388813fddbb0d2519baafa62cbc28af7e82f3a0cd665314c61ed4c1ddf801bd1`

Result: **MATCH / commitment verified**.

## Frozen mapping

| Query | Holdout ID | A | B | C |
| --- | --- | --- | --- | --- |
| Q01 | BM03 | S | H | L |
| Q02 | HU08 | L | H | S |
| Q03 | ME03 | S | H | L |
| Q04 | SS09 | L | H | S |
| Q05 | SS08 | S | L | H |
| Q06 | BM08 | S | L | H |
| Q07 | HU02 | S | H | L |
| Q08 | BM01 | H | L | S |
| Q09 | SS04 | S | H | L |
| Q10 | SS07 | L | H | S |
| Q11 | HU05 | H | S | L |
| Q12 | ME01 | S | L | H |
| Q13 | BM10 | L | H | S |
| Q14 | BM07 | S | L | H |
| Q15 | SS03 | S | H | L |
| Q16 | HU04 | L | S | H |
| Q17 | ME10 | H | S | L |
| Q18 | SS02 | S | H | L |
| Q19 | ME06 | L | S | H |
| Q20 | ME02 | S | H | L |
| Q21 | BM02 | L | H | S |
| Q22 | ME04 | H | L | S |
| Q23 | HU01 | H | L | S |
| Q24 | BM06 | L | S | H |
| Q25 | SS05 | H | L | S |
| Q26 | BM05 | S | H | L |
| Q27 | ME08 | S | H | L |
| Q28 | ME07 | L | H | S |
| Q29 | ME05 | H | S | L |
| Q30 | BM09 | S | H | L |
| Q31 | BM04 | H | L | S |
| Q32 | HU06 | S | H | L |
| Q33 | HU07 | S | L | H |
| Q34 | ME09 | H | L | S |
| Q35 | SS10 | H | S | L |
| Q36 | HU03 | S | L | H |
| Q37 | SS06 | H | S | L |
| Q38 | HU10 | S | H | L |
| Q39 | SS01 | S | H | L |
| Q40 | HU09 | H | S | L |

## Mechanical validity

Fresh retrieval review previously established:

- H vs L: `N_eff = 40`, coverage regressions `0/40`.
- H vs S: `N_eff = 40`, coverage regressions `0/40`.
- S vs L: `N_eff = 40`, coverage regressions `40/40` under the frozen rule because of the preregistered L=100 / S<=50 depth asymmetry. This statistic is reported as a structural coverage-rule artifact and is not reinterpreted as a standalone relevance conclusion.

No low-corpus pair and no retrieval-failure occurred.

## Rater 1 component vectors

Rater 1 arm-level R counts across 400 displayed results per arm:

- L: `65/400 = 16.25%`
- S: `172/400 = 43.00%`
- H: `130/400 = 32.50%`

### Gate A — H vs L

`N_eff = 40`

| Component | Observed | Frozen requirement | Result |
| --- | ---: | ---: | --- |
| Mean Relevant@10 delta | `+16.25pp` | `>= +5pp` | PASS |
| Non-worse | `40/40 = 100%` | `>= ceil(0.70*40)=28` | PASS |
| Strong improvement >=+20pp | `16/40 = 40%` | `>= ceil(0.25*40)=10` | PASS |
| Materials/Energy mean | `+10.0pp` | no domain `< -5pp` | PASS |
| Biomedical mean | `+14.0pp` | no domain `< -5pp` | PASS |
| Social Science mean | `+25.0pp` | no domain `< -5pp` | PASS |
| Humanities mean | `+16.0pp` | no domain `< -5pp` | PASS |
| Worst single-query delta | `0pp` | no query `< -20pp` | PASS |
| Conjunctive slice | `+17.65pp`, `N=17` | `>= -3pp` | PASS |
| Lexical-ambiguity slice | `+14.67pp`, `N=15` | `>= -3pp` | PASS |
| Coverage regression pattern | `0/40` | none under frozen rule | PASS |

**Gate A (Rater 1): PASS.**

Worst-query delta is `0pp`; tied QIDs: `Q03, Q12, Q17, Q19, Q21, Q22, Q27, Q36, Q40`.

### Gate B — H vs S non-inferiority

`N_eff = 40`

| Component | Observed | Frozen requirement | Result |
| --- | ---: | ---: | --- |
| Mean Relevant@10 delta | `-10.50pp` | `>= 0pp` | FAIL |
| Non-worse | `14/40 = 35%` | `>= ceil(0.60*40)=24` | FAIL |
| Materials/Energy mean | `-8.0pp` | no domain `< -5pp` | FAIL |
| Biomedical mean | `-4.0pp` | no domain `< -5pp` | PASS |
| Social Science mean | `-10.0pp` | no domain `< -5pp` | FAIL |
| Humanities mean | `-20.0pp` | no domain `< -5pp` | FAIL |
| Worst single-query delta | `-40pp` at `Q11` | no query `< -20pp` | FAIL |
| Conjunctive slice | `-8.24pp`, `N=17` | `>= -3pp` | FAIL |
| Lexical-ambiguity slice | `-9.33pp`, `N=15` | `>= -3pp` | FAIL |
| Coverage regression pattern | `0/40` | none under frozen rule | PASS |

**Gate B (Rater 1): FAIL.**

Failed components: mean delta, non-worse, Materials/Energy domain, Social Science domain, Humanities domain, worst-query guardrail, conjunctive slice, lexical-ambiguity slice.

### S vs L diagnostic

`N_eff = 40`

- Mean Relevant@10 delta: `+26.75pp`.
- Non-worse: `39/40 = 97.5%`.
- Strong improvement >=+20pp: `28/40 = 70%` (descriptive).
- Domain means: Materials/Energy `+18.0pp`; Biomedical `+18.0pp`; Social Science `+35.0pp`; Humanities `+36.0pp`.
- Worst single-query delta: `-10pp` at `Q08`.
- Conjunctive slice: `+25.88pp`, `N=17`.
- Lexical-ambiguity slice: `+24.0pp`, `N=15`.
- Frozen-rule coverage regressions: `40/40`, structurally induced by L=100 / S<=50 depth asymmetry; diagnostic only.

S vs L has no adoption PASS/FAIL status under the frozen protocol.

## Rater 2 component vectors

Rater 2 arm-level R counts across 400 displayed results per arm:

- L: `106/400 = 26.50%`
- S: `207/400 = 51.75%`
- H: `177/400 = 44.25%`

### Gate A — H vs L

`N_eff = 40`

| Component | Observed | Frozen requirement | Result |
| --- | ---: | ---: | --- |
| Mean Relevant@10 delta | `+17.75pp` | `>= +5pp` | PASS |
| Non-worse | `34/40 = 85%` | `>= ceil(0.70*40)=28` | PASS |
| Strong improvement >=+20pp | `25/40 = 62.5%` | `>= ceil(0.25*40)=10` | PASS |
| Materials/Energy mean | `+10.0pp` | no domain `< -5pp` | PASS |
| Biomedical mean | `+23.0pp` | no domain `< -5pp` | PASS |
| Social Science mean | `+18.0pp` | no domain `< -5pp` | PASS |
| Humanities mean | `+20.0pp` | no domain `< -5pp` | PASS |
| Worst single-query delta | `-20pp` at `Q12, Q27, Q37` | no query `< -20pp` | PASS |
| Conjunctive slice | `+18.24pp`, `N=17` | `>= -3pp` | PASS |
| Lexical-ambiguity slice | `+13.33pp`, `N=15` | `>= -3pp` | PASS |
| Coverage regression pattern | `0/40` | none under frozen rule | PASS |

**Gate A (Rater 2): PASS.**

### Gate B — H vs S non-inferiority

`N_eff = 40`

| Component | Observed | Frozen requirement | Result |
| --- | ---: | ---: | --- |
| Mean Relevant@10 delta | `-7.50pp` | `>= 0pp` | FAIL |
| Non-worse | `16/40 = 40%` | `>= ceil(0.60*40)=24` | FAIL |
| Materials/Energy mean | `+2.0pp` | no domain `< -5pp` | PASS |
| Biomedical mean | `-8.0pp` | no domain `< -5pp` | FAIL |
| Social Science mean | `-9.0pp` | no domain `< -5pp` | FAIL |
| Humanities mean | `-15.0pp` | no domain `< -5pp` | FAIL |
| Worst single-query delta | `-40pp` at `Q06, Q31` | no query `< -20pp` | FAIL |
| Conjunctive slice | `-7.06pp`, `N=17` | `>= -3pp` | FAIL |
| Lexical-ambiguity slice | `-4.00pp`, `N=15` | `>= -3pp` | FAIL |
| Coverage regression pattern | `0/40` | none under frozen rule | PASS |

**Gate B (Rater 2): FAIL.**

Failed components: mean delta, non-worse, Biomedical domain, Social Science domain, Humanities domain, worst-query guardrail, conjunctive slice, lexical-ambiguity slice.

### S vs L diagnostic

`N_eff = 40`

- Mean Relevant@10 delta: `+25.25pp`.
- Non-worse: `37/40 = 92.5%`.
- Strong improvement >=+20pp: `26/40 = 65%` (descriptive).
- Domain means: Materials/Energy `+8.0pp`; Biomedical `+31.0pp`; Social Science `+27.0pp`; Humanities `+35.0pp`.
- Worst single-query delta: `-40pp` at `Q27`.
- Conjunctive slice: `+25.29pp`, `N=17`.
- Lexical-ambiguity slice: `+17.33pp`, `N=15`.
- Frozen-rule coverage regressions: `40/40`, structurally induced by L=100 / S<=50 depth asymmetry; diagnostic only.

S vs L has no adoption PASS/FAIL status under the frozen protocol.

## Rater-robust gate outcome

Primary raters agree on both binary gate dispositions:

| Gate | Rater 1 | Rater 2 |
| --- | --- | --- |
| Gate A — H vs L | PASS | PASS |
| Gate B — H vs S | FAIL | FAIL |

Result: **RATER-ROBUST** under the frozen two-rater rule.

Third-rater trigger: **NOT TRIGGERED**.

No third blind evaluator may be requested on the basis of S-vs-L disagreement or the inter-rater agreement diagnostic.

## Predeclared A/B decision matrix application

Frozen matrix row:

- Gate A = PASS
- Gate B = FAIL

Therefore:

**H disposition: `H REJECTED`.**

Frozen consequence: H improves L but is inferior to the simpler S arm; use the S-vs-L evidence for separate S consideration.

This does **not** automatically adopt S as production architecture. D-016 remains pending a separate architecture decision and the remaining frozen experiment sequence.

## Interpretation boundary

- Gate results above are calculated independently per rater from their locked labels; labels were never averaged or reconciled.
- Inter-rater agreement results did not alter gate computation.
- S-vs-L is a secondary architecture diagnostic, not an adoption gate.
- The frozen S-vs-L `40/40` coverage-regression count is a consequence of the frozen candidate-depth asymmetry and must remain adjacent to that caveat in any final summary.
- Production semantic/hybrid retrieval is not automatically adopted by this result.

## Review state and next permitted operation

These calculations are canonicalized as **PENDING INDEPENDENT REVIEW**.

Before starting the next irreversible derived stage (the seen A1/A2/A5/A6/A7 harm-regression slice), D-017 requires independent reviewer acceptance of this mapping reveal, seed verification, and per-rater gate computation.

After independent review acceptance:

1. Record the review outcome and any explicitly triaged findings.
2. Run the preregistered A1/A2/A5/A6/A7 harm-regression slice under its own two-rater blind protocol and passive provider-cost monitoring.
3. Only after the harm diagnostic is complete may the final experiment outcome and separate production-architecture decision be closed.

Last updated: 2026-09-10
