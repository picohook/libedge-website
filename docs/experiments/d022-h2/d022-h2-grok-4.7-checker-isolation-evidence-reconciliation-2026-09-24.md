# D022-H2 Grok 4.7 checker-isolation evidence reconciliation — 2026-09-24

Status: **EVIDENCE RECONCILED / V0.2 ISOLATION MECHANISM NOT CLOSED**

This record preserves the recovered evidence concerning the Grok 4.7 Candidate supportCheck Implementer/Tuner without changing the frozen candidate implementation or overstating the accepted v0.2 checker-isolation gate.

## Recovered evidence

- Actual candidate session identity is `grok-4.7`. A pre-implementation eligibility gate recorded:
  - prior D-022 substantive role: NO;
  - prior H1/H2 evaluation-artifact exposure: NO;
  - prior H2 taxonomy/rating/holdout/qualification exposure: NO;
  - role conflict: NO;
  - eligible: YES.
- The candidate task established an allowed-input boundary limited to:
  - `IMPLEMENTER_TASK.md`;
  - `PRODUCT_CONTRACT.md`;
  - `REFERENCE_BOUNDARY.js`;
  - `PACKAGE_MANIFEST.json`.
- Recovered session history is consistent with that boundary: the implementation flow checked/read the named allowed inputs and the candidate-created outputs; no recovered evidence establishes inspection of prohibited H1/H2 artifacts.
- The interrupted implementation turn was resumed under the same allowed-input boundary.
- The recovered candidate package remains byte-frozen. Existing authoritative candidate hashes and the independent 15/15 mechanical test result are unchanged.
- Independent checker-freeze review by Claude Haiku 4.5 remains ACCEPT / FINAL / LOCKED. This record does not reopen that review.

## Session capability evidence

Recovered `resources_state.json` for candidate session `01a0cdb8-858f-74a1-a99b-797927daef60` records Grok Build capabilities including `ReadFile`, `Bash`, `Grep`, `ListDir`, `SearchReplace`, and `WebFetch`.

The recovered configuration does **not** establish a filesystem sandbox or workspace rule that made the LibEdge repository technically inaccessible. In particular, the recorded `Bash.cmd_prefix` is null and no repository-specific denial is evidenced in this state record.

Therefore actual non-use/non-exposure evidence must not be converted into a claim that the workspace/account **could not access** the LibEdge repository.

## Accepted v0.2 mechanism assessment

The accepted operational specification requires exactly one checker-isolation mechanism.

### Checker-first freeze

**NOT SATISFIED by recovered chronology.**

The protected `staging` ancestry already contained H2 prerequisites before the Grok candidate provenance merge. In particular, the H2 taxonomy prerequisite was locked by PR #139 (merge commit `8786055cd2b0ce422c6c472a069464896f407260`) before candidate provenance PR #161 (merge commit `54fac4ca4f7981702f7957523ce52eab019dc946`). Git comparison establishes the PR #139 merge commit as an ancestor of the PR #161 merge commit.

### Workspace exclusion

**NOT ESTABLISHED by recovered evidence.**

The pre-implementation gate and raw session history strongly support actual non-exposure and adherence to the four-input boundary. However, the recovered session configuration does not establish that the workspace/account could not access the LibEdge repository and prohibited H1/H2 artifacts, and no contemporaneous independently reviewed workspace-exclusion attestation has been recovered.

## Governance consequence

- Do **not** mark the accepted v0.2 checker-isolation gate PASS on the basis of current evidence.
- Do **not** claim that Grok 4.7 accessed prohibited H1/H2 artifacts; no such access is established by the recovered evidence.
- Do **not** modify, tune, or replace the frozen Grok candidate merely to repair this governance gap.
- Preserve the candidate, exact hashes, mechanical test evidence, pre-implementation non-exposure evidence, raw-session provenance, and Haiku 4.5 checker-freeze acceptance as historical evidence.
- H2 authorship remains CLOSED.
- The checker-isolation governance gap requires an explicit successor/reconciliation decision before a canonical v0.2 freeze manifest can be accepted. Any successor path must preserve the historical record and must not retrospectively manufacture a workspace-exclusion attestation.

This is an evidence/provenance reconciliation record only. It is not H2 semantic acceptance, production authorization, deployment authorization, or a canonical freeze-manifest acceptance.
