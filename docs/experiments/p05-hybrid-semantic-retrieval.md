# P0.5 Hybrid Semantic Retrieval — Fresh Holdout Retrieval Record

Status: `ACTIVE`
Qualifier: `RETRIEVAL EXECUTED — MECHANICALLY REVIEWED / ACCEPTED — RELEVANCE NOT YET EVALUATED`
Executed: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Frozen holdout: `docs/experiments/p05-hybrid-semantic-holdout.md`

## Execution provenance

- Workflow run: `34498804224` (`P0.5 Frozen Hybrid Retrieval`)
- Workflow head commit: `ae21146c062f6efc0f898c357098fff532a29ffe`
- Executor hardening commit: `fe58e6637f1bc02fe509050c8e5b64d7d6c1d9e1`
- Raw artifact ID: `10161068719`
- Raw artifact SHA-256: `79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8`
- Artifact contains 41 files: 40 query records plus `summary.json`.
- No relevance labels, tuning, result-dependent retries, query rewrites, or holdout edits were performed during retrieval.

## Mechanical execution result

- Provider attempts: `80` = 40 L + 40 S; no retries were needed.
- Successful retrievals: L `40/40`, S `40/40`, H mechanically available `40/40`.
- Persistent retrieval failures: none.
- Charged responses: `80`; observed total provider charge: `$0.080`.
- Every recorded request returned `requestCostUsd = 0.001`; body/header cost evidence agreed on all 80 calls; `requestCredits = 10` on all 80 calls.
- D-013 pricing anomalies: none.
- Semantic pacing audit: minimum observed semantic request-start separation `2.886 s`, satisfying the `<=1 request/second` constraint.
- Independent mechanical recomputation of frozen RRF/tie-break produced exact H top-10 agreement for all 40 queries.

## Mechanical coverage

- L unique normalized candidates: min `100`, max `100`, mean `100.000`.
- S unique normalized candidates: min `31`, max `50`, mean `47.875`.
- H union unique normalized candidates: min `128`, max `149`, mean `144.450`.
- Low-corpus query/pairs (`<8` unique on either arm): none.
- Frozen coverage-regression rule: H-vs-L `0/40`; H-vs-S `0/40`; S-vs-L `40/40`.
- The S-vs-L coverage result is a mechanical consequence of the frozen L=100 / S<=50 depth asymmetry and is reported without reinterpretation or rule change. Any later report or architecture-decision summary MUST preserve this caveat adjacent to the statistic; it is not by itself a relevance conclusion.

## Per-query mechanical counts

| ID | L unique | S unique | H unique | L attempts | S attempts |
| --- | ---: | ---: | ---: | ---: | ---: |
| ME01 | 100 | 50 | 147 | 1 | 1 |
| ME02 | 100 | 50 | 147 | 1 | 1 |
| ME03 | 100 | 50 | 145 | 1 | 1 |
| ME04 | 100 | 50 | 145 | 1 | 1 |
| ME05 | 100 | 50 | 146 | 1 | 1 |
| ME06 | 100 | 50 | 147 | 1 | 1 |
| ME07 | 100 | 50 | 144 | 1 | 1 |
| ME08 | 100 | 50 | 142 | 1 | 1 |
| ME09 | 100 | 50 | 148 | 1 | 1 |
| ME10 | 100 | 50 | 145 | 1 | 1 |
| BM01 | 100 | 50 | 146 | 1 | 1 |
| BM02 | 100 | 49 | 145 | 1 | 1 |
| BM03 | 100 | 50 | 147 | 1 | 1 |
| BM04 | 100 | 50 | 143 | 1 | 1 |
| BM05 | 100 | 50 | 146 | 1 | 1 |
| BM06 | 100 | 50 | 147 | 1 | 1 |
| BM07 | 100 | 49 | 149 | 1 | 1 |
| BM08 | 100 | 50 | 144 | 1 | 1 |
| BM09 | 100 | 46 | 141 | 1 | 1 |
| BM10 | 100 | 50 | 145 | 1 | 1 |
| SS01 | 100 | 50 | 141 | 1 | 1 |
| SS02 | 100 | 50 | 147 | 1 | 1 |
| SS03 | 100 | 50 | 144 | 1 | 1 |
| SS04 | 100 | 50 | 146 | 1 | 1 |
| SS05 | 100 | 50 | 143 | 1 | 1 |
| SS06 | 100 | 50 | 143 | 1 | 1 |
| SS07 | 100 | 50 | 141 | 1 | 1 |
| SS08 | 100 | 50 | 148 | 1 | 1 |
| SS09 | 100 | 50 | 145 | 1 | 1 |
| SS10 | 100 | 50 | 145 | 1 | 1 |
| HU01 | 100 | 50 | 145 | 1 | 1 |
| HU02 | 100 | 50 | 145 | 1 | 1 |
| HU03 | 100 | 50 | 146 | 1 | 1 |
| HU04 | 100 | 50 | 144 | 1 | 1 |
| HU05 | 100 | 50 | 146 | 1 | 1 |
| HU06 | 100 | 50 | 147 | 1 | 1 |
| HU07 | 100 | 31 | 128 | 1 | 1 |
| HU08 | 100 | 46 | 140 | 1 | 1 |
| HU09 | 100 | 45 | 141 | 1 | 1 |
| HU10 | 100 | 48 | 144 | 1 | 1 |

## Post-retrieval execution correction control

The frozen raw retrieval artifact is immutable. After retrieval has been observed, a correction is permitted only for an objectively demonstrable mechanical computation or recording defect and only when the correction can be derived from the already-frozen raw artifact without changing a query, provider candidate pool, retrieval/fusion parameter, relevance rubric, gate, or label.

Any such correction MUST be recorded append-only as `EXECUTION CORRECTION`, identify the defect and affected query/field, preserve the original artifact/hash, state the deterministic correction procedure, record before/after derived-artifact hashes where applicable, and state whether evaluator-visible material is affected. Provider retrieval MUST NOT be silently re-run to repair a post-retrieval defect. If the defect cannot be corrected solely from the frozen raw artifact, the affected query/arm is marked mechanically invalid pending explicit governance review rather than replaced or re-retrieved.

No execution correction may be justified by apparent relevance quality, expected gate direction, evaluator labels, or production preference.

## Independent reviewer acceptance

Reviewer Packet `P05-RETRIEVAL-EXECUTION-2026-09-10` received classification `ACCEPTED` after fresh raw-content/diff inspection, including independent recomputation of all 40 H top-10 rankings (400/400 positions matched), holdout-text comparison, telemetry/cost verification, and execution-correction diff inspection.

Canonical review record: `docs/reviews/2026-09-10-p05-retrieval-execution-review.md`.

Two non-blocking OUT-OF-SCOPE findings were triaged by the main engineering thread:

1. Dedup DOI/title fallback branches were not exercised by this OpenAlex-native artifact — `ACKNOWLEDGED / DEFERRED`; revisit before any OpenAlex-external or ID-less ingestion path depends on those fallbacks.
2. S-vs-L coverage regression `40/40` is structurally induced by the frozen L=100 / S<=50 depth asymmetry and can be misread — `ACKNOWLEDGED / DEFERRED`; any final evaluation or architecture summary must keep that caveat adjacent to the statistic.

No execution correction is required as a result of the review.

## Execution history

- `2026-09-10 — RETRIEVAL FREEZE`: workflow run `34498804224`; raw artifact ID `10161068719`; SHA-256 `79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8`.
- `2026-09-10 — EXECUTION CORRECTION CONTROL`: before any relevance labels were collected, defined the append-only mechanism for correcting objectively demonstrable mechanical computation/recording defects from the immutable frozen raw artifact. No retrieval result, candidate pool, RRF parameter, holdout item/tag, relevance rule, gate, or evaluator label was changed.
- `2026-09-10 — INDEPENDENT MECHANICAL REVIEW ACCEPTED`: full raw-artifact review accepted execution as compliant; two non-blocking OUT-OF-SCOPE findings explicitly triaged; no correction applied.

## Interpretation boundary

This record contains retrieval execution and mechanical validity/coverage only. It makes no claim about relevance quality, Gate A, Gate B, S-vs-L merit, or production adoption. Those remain pending the frozen blind-evaluator protocol.

## Next permitted operation

Deliver the exact already-frozen public evaluator artifact to two primary blind raters in separate fresh lineages, then collect and lock both complete R/M/N label sets before opening the private mapping.

Last updated: 2026-09-10
