# D-022 H2 — vNext Provenance Reconciliation

Status: **PROVENANCE FOLLOW-UP / REVIEW REQUIRED**

Date: 2026-09-28

## Purpose

This record reconciles the repository's existing D-022 H2 closure summaries with additional contemporaneous project records recovered after closure. It does **not** reopen the scientific result, retroactively convert historical failed/open gates to PASS, or authorize Assistant integration or deployment.

The controlling repository closure remains:
- `docs/d022-h2-final-status-2026-09-27.md`
- `docs/d022-h2-master-final-release-2026-09-27.md`
- the D-022 H2 closure entry in `docs/decisions.md`

## Repository facts already recorded before this follow-up

The current repository final status records:
- Architecture B: blocking SUPPORT vs NOT_SUPPORTED; diagnostic CONTRADICTS vs NOT_SUPPORTING is non-blocking.
- Per-evidence rule: SUPPORT if `p_entailment >= 0.85`; else CONTRADICTS if `p_contradiction >= 0.85`; else NOT_SUPPORTING.
- Frozen acceptance: >=11/12 primary cases and three deterministic complete runs.
- Selected engine: `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli`, exact revision `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`.
- Qualification: 11/12, deterministic 3/3.
- Stage B: job `6ab9731752d0dbd7f1d9db1f`, 11/12 semantic primary + 16/16 structural/fault, engine artifact manifest SHA-256 `96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918`.
- Final independent audit: Qwen/Qwen3-8B revision `b968826d9c46dd6066d109eabc6255188de91218`, job `6ab975b152d0dbd7f1d9dbe4`, verdict `ACCEPT_H2_CLOSURE`, blocking defects NONE.
- TC11 is the sole primary semantic miss; TC06 and TC12 are primary-correct NOT_SUPPORTED cases with diagnostic subtype disagreement.
- No post-result semantic threshold, oracle, fixture, engine-pool, candidate-order, selection-rule, or acceptance-rule change was made to obtain closure.

These statements are not newly created by this provenance follow-up; they are already present in the current canonical closure summary.

## Additional contemporaneous records recovered outside the repository

The following records were recovered from the project file archive / conversation record after closure. They are **not represented here as first-class repository artifacts unless and until their original bytes are imported and hash-linked**.

### 1. Prospective vNext freeze record

A recovered record titled `VNEXT_FROZEN_SPEC.md` states:
- `STATUS: FROZEN BEFORE vNext ENGINE EXECUTION`;
- reviewer: `swiss-ai/Apertus-70B-Instruct-2509`;
- selected Architecture B;
- primary aggregate SUPPORT vs NOT_SUPPORTED is blocking;
- diagnostic CONTRADICTS vs NOT_SUPPORTING is separately scored and non-blocking;
- primary acceptance is >=11/12;
- three complete deterministic runs are required;
- candidate pool/order, exact immutable revisions, suite, code, runtime, acceptance rule and stopping rule are frozen before observing candidate output;
- no candidate addition/deletion/substitution/reordering or post-execution oracle/fixture/threshold/mapping/acceptance-rule change is permitted;
- selection stops at the first candidate in the frozen order satisfying acceptance + determinism; pool exhaustion is a closed failure;
- Stage B requires a frozen artifact manifest/hashes before execution and a final independent audit after checker freeze.

This record supports the prospective nature of the vNext architecture and qualification governance.

### 2. Contemporaneous final model-role / execution registry

Recovered contemporaneous registry records identify:
- `swiss-ai/Apertus-70B-Instruct-2509` as the accepted vNext Independent Qualification-Design Reviewer;
- the same model as vNext Decision-Rule Addendum Author;
- the recorded addendum rule as SUPPORT if `p_entailment >= 0.85`; else CONTRADICTS if `p_contradiction >= 0.85`; else NOT_SUPPORTING, with SUPPORT precedence;
- C1 `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` at exact revision `6f5cf0a2b59cabb106aca4c287eed12e357e90eb` as the first preregistered passing candidate, 11/12 primary and deterministic 3/3, sole primary miss TC11;
- C2 `FacebookAI/roberta-large-mnli` and C3 `mujeensung/albert-base-v2_mnli_bc` as preregistered but not evaluated after the frozen first-pass stopping rule selected C1;
- the same frozen C1 engine as the Stage-B semantic engine;
- Qwen/Qwen3-8B as final independent closure auditor with `ACCEPT_H2_CLOSURE`.

These records corroborate the current repository final-status summary, but they do not substitute for missing original raw artifacts.

### 3. Recovered Apertus-70B HuggingChat transcript

A recovered contemporaneous HuggingChat transcript has now been imported at:

`docs/experiments/d022-h2/d022-vnext-apertus70b-huggingchat-transcript-2026-09-27.txt`

SHA-256 of the recovered source bytes before repository import: `f7e34e3ddb976f454ff6a7534e2552e2bfd06cc1cd1e6f51865182c9b23c7c37` (14,736 bytes).

The transcript contains the Apertus-70B Architecture-B review, the corrected `FINAL / LOCKED` review with TC11 = SUPPORT, and the subsequent Decision-Rule Addendum exchange. Immediately before the addendum, the transcript explicitly records that no vNext engine had yet been executed and no qualification outcome had yet been observed, and requests the missing probability thresholds and precedence prospectively.

The resulting Decision-Rule Addendum records fixed 0.85 thresholds and SUPPORT precedence and ends `FINAL / LOCKED`. This materially strengthens the provenance for the prospective 0.85 decision rule.

The imported transcript is the recovered conversation record as supplied to this reconciliation. It is not represented as a separately saved standalone Decision-Rule Addendum artifact.

## Remaining archival limitation

The original Apertus-70B **vNext Decision-Rule Addendum output has been recovered within the contemporaneous HuggingChat transcript** and that transcript is now imported and hash-linked above.

What has **not** been established is a separately saved standalone addendum artifact with its own independently established standalone-artifact SHA-256. Therefore the repository must not claim that:
- a separate original standalone addendum file has been recovered;
- an original standalone-addendum artifact SHA-256 has been independently verified; or
- a separate standalone addendum artifact can currently be reconstructed byte-for-byte beyond the recovered conversation transcript.

The prospective 0.85 rule is now supported by the imported transcript as well as the current canonical final-status file and contemporaneous final registry records. The remaining limitation is specifically the absence of a separately preserved standalone addendum artifact, not absence of the addendum output itself.

The raw external Stage-B and final-audit execution records also remain subject to the existing repository caveat in `docs/decisions.md`: do not represent them as first-class repository artifacts until imported and hash-linked.

## 1,080-claim H2 construction plan — unresolved governance status

Historical D-022 materials describe a planned larger H2 construction/rating exercise (1,080 claims / 180 scenarios). The records recovered in this follow-up show that H2 Author/Raters/Evaluators were held CLOSED while the successor Fresh-Checker A1/A2/B qualification/freeze path was completed.

This follow-up did **not** recover an explicit adopted decision that permanently cancelled, superseded, or completed the planned 1,080-claim exercise.

Accordingly:
- do not state that the 1,080-claim set was executed;
- do not state that it was permanently superseded unless a canonical decision proving that is recovered/adopted;
- do not equate Fresh-Checker scientific/qualification closure with completion of that originally planned large holdout construction/rating exercise.

This is a governance-status clarification and does not by itself reverse the recorded Fresh-Checker qualification result.

## Activation boundary

This provenance reconciliation creates no application-code or deployment authorization.

Before Assistant activation, the existing requirements remain in force:
1. exact checker/artifact pinning;
2. router integration under the existing all-or-nothing grounding contract;
3. privacy-compatible execution boundary for research-interest-bearing claim/evidence inputs;
4. staging end-to-end verification including fail-closed behavior;
5. separate deployment authorization.

**REVIEW REQUIRED**
