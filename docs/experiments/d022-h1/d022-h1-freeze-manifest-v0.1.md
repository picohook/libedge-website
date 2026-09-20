# D022-H1 Fresh Holdout Candidate Pool Freeze Manifest v0.1

Status: `POOL FREEZE CANDIDATE / INDEPENDENT REVIEW REQUIRED BEFORE MERGE OR RATING`

Prepared: 2026-09-20

Frozen upstream controls:
- `docs/experiments/d022-supportcheck-evaluation-preregistration-v0.1.md`
- `docs/experiments/d022-supportcheck-statistical-holdout-freeze-v0.1.md`
- `docs/experiments/d022-supportcheck-holdout-construction-spec-v0.1.md`
- `docs/experiments/d022-supportcheck-construction-diversity-qa-addendum-v0.1.md`

## Canonical identity

Canonical pool: `docs/experiments/d022-h1/d022-h1-pool.jsonl`

SHA-256: `8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb`

Records: **720**; Scenarios: **120**; first claim: `D022-H1-S001-C01`; last: `D022-H1-S120-C06`.

Validator/build script: `scripts/d022-h1-validate.mjs`  
Script SHA-256: `4270fae060e687d449ec5fd207c76d824cfbb532a671edc14b34169ea992f00e`

## Artifact hashes

- source: `4142c1785ea5409ddbf27ff790ae1ba9ffc543802e7165e79c2dde731839daf7`
- canonical pool: `8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb`
- domain metadata: `f68cc483f241a9aef914b06c53644ee1a6c96c9d8b080625b4a4ac4784a08d69`
- construction QA: `067f8bdf328a5444f913b1e6d0cc661dffc81aa2bb57362f5e7eeb25e809cb32`
- QA summary: `75a7593ca18b6e44020c1afd7a846f5a05f135d993592a8f85fe45201153051e`
- validator: `4270fae060e687d449ec5fd207c76d824cfbb532a671edc14b34169ea992f00e`
- tests: `861e49052755f3b6913586d1208ba727e08b8abefd869ee70ae7d6c94e3126b6`

## Distribution

U1-U6: **80 each**; S_SUPPORTED: **150**; P_PARTIAL_EXTENSION: **90**. S001-S080 contain exactly one U1-U6 each; S081-S105 six supported each; S106-S120 six partial each.

## Domain QA

Negative S001-S080: all 12 domains represented; D01-D08=7 each, D09-D12=6 each. Full S001-S120: each domain=10. All frozen domain gates pass.

## Lexical clone QA

Frozen rule: different-scenario records within each stratum; `J >= 0.70` fails.

- U1 max 0.555555555556
- U2 max 0.608247422680
- U3 max 0.545454545455
- U4 max 0.573770491803
- U5 max 0.620689655172
- U6 max 0.577777777778
- S_SUPPORTED max 0.654545454545
- P_PARTIAL_EXTENSION max 0.692307692308

Every stratum has **0 pairs >=0.70**. Global normalized exact duplicates: claim=0, evidence=0, comparison=0. Lexical gate: **PASS**.

Full max-pair IDs and >=0.50/>=0.60 diagnostics are in `d022-h1-qa-summary.json`.

## Construction QA

All 720 QA rows pass the frozen per-record checks. Supported features: numeric/bounded 100; multi-evidence 50; uncertainty/limitation 75; conflict-aware 25; explicit absence 50. Partial subtypes: exactly 15 each for scope, mechanism, temporal, conflict, evaluative strengthening, denominator/generalization.

## Tests and validation

`node scripts/d022-h1-validate.test.mjs` -> **6/6 PASS**:
changed-number detection; J=0.70 fail; J<0.70 pass; exact-duplicate detection; same-scenario exclusion; domain violation detection.

Canonical validator result: `overall_pass=true`, pool SHA-256 `8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb`, 720 records, 120 scenarios.

## Freeze boundary

Opening this PR does not freeze the pool. Freeze occurs only at merge after independent reviewer acceptance. Before merge, a frozen-rule or semantic defect may require a changed pool hash and re-review. After accepted merge, the pool cannot be silently amended in place; a validity-affecting defect requires a new preregistered holdout version.

## Rating boundary

No primary rater has received D022-H1. No candidate checker has been run against it. Rating/checker evaluation remain unauthorized until independent acceptance and merge.

## Known limitation

If holdout author and future checker developer are the same person or AI system, sealed labels do not eliminate familiarity with the author's trap-design style. This limitation must remain visible in the final report.
