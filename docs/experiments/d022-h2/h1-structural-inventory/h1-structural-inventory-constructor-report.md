# H1 Structural Inventory Constructor Report

## Source Artifacts and Hashes
Source repository commit `3c46ef9c774d62ce9d178b65893bd69507ec8646`.
The following supplied artifacts were verified:

| File | SHA-256 |
|---|---|
| `d022-h1-domain-metadata.jsonl` | `f68cc483f241a9aef914b06c53644ee1a6c96c9d8b080625b4a4ac4784a08d69` |
| `d022-h1-construction-qa.jsonl` | `067f8bdf328a5444f913b1e6d0cc661dffc81aa2bb57362f5e7eeb25e809cb32` |
| `d022-h1-pool.jsonl` | `8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb` |
| `d022-supportcheck-h2-construction-rating-spec-v0.1.md` | `2d5460e57361c2aac9b71418758895c364344420175b8a95ba89159af00c7996` |

## Prohibited Artifacts Not Accessed
- H1 blind bundle/id map
- Rater prompts/outputs
- Normalized/raw rating files
- Consensus file
- Intake report

## Identity and Attestation
- **Constructor identity:** Gemini family / Gemini 3.1 Pro Preview (API/deployment string: `gemini-3.1-pro-preview`; identity evidence: operator-provided Run settings screenshot for this exact constructor session)
- **H1 exposure attestation:** I attest that before beginning this role I had not served as H1 R1/R2 and had not inspected H1 claim-level ratings, rater outputs, consensus rows, semantic evaluation results, or claim-level outcome labels, and that none of those prohibited artifacts were accessed during construction.

## Inventory QA Summary
- **Total H1 claims in pool:** 720
- **Total claims mapped:** 720
- **Missing IDs:** 0
- **Duplicate/Multiply mapped IDs:** 0
- **Number of H1T transformations:** 30

**Cross-Stratum Membership and Per-Template Counts:**
- **H1T001** (16 claims): `U2_SCOPE_SHIFT` (16)
- **H1T002** (20 claims): `U5_CONFLICT_SIDE` (20)
- **H1T003** (35 claims): `U5_CONFLICT_SIDE` (20), `P_PARTIAL_EXTENSION` (15)
- **H1T004** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T005** (35 claims): `U3_CAUSAL_MECHANISTIC` (20), `P_PARTIAL_EXTENSION` (15)
- **H1T006** (20 claims): `U3_CAUSAL_MECHANISTIC` (20)
- **H1T007** (25 claims): `S_SUPPORTED` (25)
- **H1T008** (20 claims): `U3_CAUSAL_MECHANISTIC` (20)
- **H1T009** (20 claims): `U3_CAUSAL_MECHANISTIC` (20)
- **H1T010** (25 claims): `S_SUPPORTED` (25)
- **H1T011** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T012** (15 claims): `P_PARTIAL_EXTENSION` (15)
- **H1T013** (20 claims): `U5_CONFLICT_SIDE` (20)
- **H1T014** (20 claims): `U5_CONFLICT_SIDE` (20)
- **H1T015** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T016** (25 claims): `S_SUPPORTED` (25)
- **H1T017** (95 claims): `U4_TEMPORAL_GENERALIZATION` (80), `P_PARTIAL_EXTENSION` (15)
- **H1T018** (16 claims): `U2_SCOPE_SHIFT` (16)
- **H1T019** (95 claims): `U1_NEAR_MISS` (80), `P_PARTIAL_EXTENSION` (15)
- **H1T020** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T021** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T022** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T023** (25 claims): `S_SUPPORTED` (25)
- **H1T024** (25 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10), `P_PARTIAL_EXTENSION` (15)
- **H1T025** (16 claims): `U2_SCOPE_SHIFT` (16)
- **H1T026** (16 claims): `U2_SCOPE_SHIFT` (16)
- **H1T027** (10 claims): `U6_CITATION_SEMANTIC_MISMATCH` (10)
- **H1T028** (25 claims): `S_SUPPORTED` (25)
- **H1T029** (25 claims): `S_SUPPORTED` (25)
- **H1T030** (16 claims): `U2_SCOPE_SHIFT` (16)

## Borderline Merge/Split Decisions
1. **Merged `U4_TEMPORAL_GENERALIZATION` and `P_PARTIAL_EXTENSION` (H1T017):** Both involve extrapolating finite observed performance into indefinite long-term persistence beyond the documented temporal endpoint. Because the underlying extrapolation transformation is structurally equivalent, they were merged.
2. **Merged `U5_CONFLICT_SIDE` and `P_PARTIAL_EXTENSION` (H1T003):** Both revolve around resolving an explicit, unadjudicated numerical conflict between two sources by arbitrarily asserting one source's value is definitively correct. 
3. **Merged `U6_CITATION_SEMANTIC_MISMATCH` and `P_PARTIAL_EXTENSION` (H1T024):** Both establish market or industry leadership from a raw metric, explicitly ignoring the stated absence of comparative market/sales data. The inferential leap operates the exact same way.
4. **Merged `U3_CAUSAL_MECHANISTIC` and `P_PARTIAL_EXTENSION` (H1T005):** Both draw a causal conclusion based merely on observing a pre/post change observation where causal design/testing is explicitly noted as absent. 
5. **Merged `U1_NEAR_MISS` and `P_PARTIAL_EXTENSION` (H1T019):** Both overgeneralize a measurement extracted from a highly restricted scope to a universal scope. Although `U1` extends from "one condition" to "all operating conditions" and the partial extension stretches from "one sample" to "all comparable populations," this substitution (conditions vs populations) is treated as a surface domain substitution acting on the identical generalizing operation.

**Status:** `PROPOSED / INDEPENDENT REVIEW REQUIRED`