# D-022 Fresh-Checker — H2 Final Status

Status: **CLOSED / PASS / FINAL / LOCKED**

## Frozen architecture
Architecture B: primary blocking decision is SUPPORT vs NOT_SUPPORTED. CONTRADICTS vs NOT_SUPPORTING is diagnostic and non-blocking.
Per-evidence rule: SUPPORT if p_entailment >= 0.85; else CONTRADICTS if p_contradiction >= 0.85; else NOT_SUPPORTING.
Aggregate: any SUPPORT => SUPPORT; otherwise NOT_SUPPORTED.
Frozen acceptance: >=11/12 primary cases and three deterministic complete runs.

## Selected engine
- Model: MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli
- Exact revision: 6f5cf0a2b59cabb106aca4c287eed12e357e90eb
- Qualification: PASS — 11/12
- Determinism: 3/3; max probability difference 0.0

## Stage B
- Job: 6ab9731752d0dbd7f1d9db1f
- Semantic primary: PASS — 11/12
- Structural/fault: PASS — 16/16
- Engine artifact manifest SHA-256: 96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918

## Final independent audit
- Auditor: Qwen/Qwen3-8B
- Exact revision: b968826d9c46dd6066d109eabc6255188de91218
- Job: 6ab975b152d0dbd7f1d9dbe4
- Verdict: ACCEPT_H2_CLOSURE
- Blocking defects: NONE

## Frozen limitations
1. TC11 is the sole primary semantic miss.
2. NOT_SUPPORTING diagnostic accuracy is 0.50, below the non-blocking reporting target 0.80.
3. TC06 and TC12 have correct primary NOT_SUPPORTED decisions but diagnostic subtype disagreement.

No post-result semantic threshold, oracle, fixture, engine-pool, candidate-order, selection-rule, or acceptance-rule change was made to obtain closure. No second final auditor was opened after the verdict.

**FINAL / LOCKED**
