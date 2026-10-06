# LibEdge Research Changelog

This ledger is independent from the website/product `CHANGELOG.md`. Historical entries through 0.9.0 are a retrospective reconstruction from repository evidence; they do not imply that Git tags existed at the time.

## 0.9.0 — 2026-10-06 — experimental

### Milestone
Pilot-preparation diagnostics and explicit quality governance.

- Added cache-aware controlled Research benchmark diagnostics (#578; merge `be51f769`).
- Added content-free support-check call-duration and application concurrency-wait decomposition (#579; merge `8a8b7a6`).
- #536 closure now requires domain evidence on a versioned fixed-rubric golden set or an explicit written pilot-scope limitation.
- #399 authorization packet now includes mandatory domain-scope gate item 13.
- Current diagnostic benchmark remains narrow: one query per topic across three retrieval configurations; it is not domain validation.

## 0.8.0 — 2026-10-05 — experimental

### Milestone
Verified-result cache and trust-identity orchestration.

- Added staging-gated, user-scoped verified-result cache foundation (#570; `186a389`).
- Bound cache identity to stable runtime evidence (#572; `de7bbf4`).
- Restored fail-closed cache regression guard (#573; `7a45340`).
- Completed runtime orchestration (#574; `090cefd`), enabled staging only (#575; `d493787`), and added cache-hit operational telemetry (#576; `bd6a4a0`).
- Production cache enablement remained out of scope.

## 0.7.0 — 2026-10-05 — experimental

### Milestone
Language-path hardening and Research operations observability.

- Added end-to-end language rejection diagnostics (#554; `4dd8deb`).
- Narrowed the evidence-language exception to text-detected English (#564; `266c44a`).
- Aligned the Research operations dashboard and checker health with infrastructure state (#566/#568; `1564653`, `e66e9af`).

## 0.6.0 — 2026-10-03 — experimental

### Milestone
Controlled retrieval-mode/depth benchmark capability.

- Separated lexical candidate depth from final Research result depth (#473; `1b3eb92`) and pinned the staging candidate-depth baseline (#479; `4e1948c`).
- Established controlled lexical/semantic candidate-depth measurement used for lexical-10, lexical-50 and semantic-50 comparisons.
- Retrieval configuration became measurable independently from grounding outcome; subsequent #536 evidence showed mode/depth alone did not resolve the observed humanities/biomedical failures.

## 0.5.0 — 2026-10-02 — experimental

### Milestone
Operational readiness evidence and bounded pilot governance.

- Research operational telemetry, usage/cost evidence, checker invocation controls, lifecycle/teardown discipline and bounded pilot capacity evidence were consolidated.
- Production activation was separated from readiness evidence through #399 authorization governance.

## 0.4.0 — 2026-09-28 — experimental

### Milestone
Independent Fresh-Checker transport integrated into fail-closed grounding.

- Direct SageMaker checker qualification documented (#213; `c67562f`).
- Routed `supportCheck` through SageMaker transport (`7077f9c`).
- Added fail-closed SageMaker supportCheck transport (#215; `b58080f`).

## 0.3.0 — 2026-09-13 — experimental

### Milestone
Evidence authorization and fail-closed claim grounding.

- Added the EvidencePack boundary (`29c0c69`).
- Added fail-closed grounding validator (`df4f2a9`).
- Established the architectural separation between retrieved evidence and claims permitted to be presented as grounded.

## 0.2.0 — 2026-09-10 — experimental

### Milestone
Measurable academic retrieval foundation.

- Added Research provider validation benchmark (`f7b727d`).
- Added provider telemetry/hardening needed to evaluate retrieval behavior (including OpenAlex telemetry, `03a33d8`).

## 0.1.0 — historical foundation — experimental

### Milestone
Initial LibEdge Research discovery/retrieval capability.

- Represents the pre-benchmark Research foundation on which the September 2026 measurable retrieval work was built.
- No precise formal release date is asserted because no contemporaneous Research version/tag existed. This entry intentionally avoids inventing one.
