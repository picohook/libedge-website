# P0.5 Retrieval Execution Review

Status: `HISTORICAL`
Reviewed: `2026-09-10`
Packet ID: `P05-RETRIEVAL-EXECUTION-2026-09-10`
Scope: mechanical execution review only; no relevance evaluation.

## Reviewer verification level

The reviewer explicitly reported `fresh contents/diff inspected`, not merely commit/artifact existence.

The reviewer stated that they:

- downloaded and extracted the complete raw retrieval ZIP;
- verified the artifact SHA-256;
- read `summary.json` and all 40 per-query records;
- independently recomputed frozen RRF for all 40 queries;
- checked the frozen protocol and frozen holdout from the repository;
- checked the execution-correction change using the exact base-to-head diff.

## Reviewer classification

`ACCEPTED`

The reviewer found the execution compliant with the frozen protocol across the mechanically verifiable dimensions: retrieval counts/depths, retry handling, semantic pacing, telemetry/cost accounting, holdout identity, canonical deduplication path used by the run, RRF `k=60`, deterministic tie-break, H construction, and coverage accounting.

No relevance evaluation was performed as part of this review.

## Independently reported checks

- Raw artifact SHA-256 matched `79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8`.
- Artifact contained 41 files: 40 query records plus `summary.json`.
- 80 attempts: 40 L + 40 S; zero retries; L `40/40`, S `40/40`, H `40/40`; zero `retrieval-failure`.
- Observed total cost `$0.080`; body/header cost `$0.001` on every call; credits `10`; zero cost conflicts.
- L pool size was exactly 100 for every query; S pool size 31-50; H union 128-149.
- Minimum semantic request separation was independently confirmed as `2.886 s`.
- Frozen holdout ID/domain/intent/slice combinations matched the executed records with zero mismatches.
- Independent RRF/tie-break recomputation matched all 40 H top-10 lists: 400/400 result positions with zero mismatches, including recorded RRF/L-rank/S-rank values.
- The execution-correction change `fb19b0889b3b5f320f0ddc62372807cf16d4aada -> 3fc7a0ef24d7db745aa354e6a92045cdb29f18c6` was confirmed as a +13-line change only to `docs/experiments/p05-hybrid-semantic-retrieval.md`.

## OUT-OF-SCOPE FINDING triage

### OOS-01 — Dedup fallback branches were not exercised

Finding: every observed candidate carried an OpenAlex identity, so the DOI fallback and normalized-title fallback branches of the frozen dedup identity chain were not exercised by this artifact.

Disposition: `ACKNOWLEDGED / DEFERRED`

Reason: this is not an execution defect for an OpenAlex-only retrieval run; the primary identity path is the expected path for provider-native OpenAlex results.

Revisit trigger: before introducing an OpenAlex-external retrieval source, an ID-less ingestion path, or any production behavior that can depend on DOI/title fallback identity, add direct unit/integration coverage for the fallback chain.

### OOS-02 — S-vs-L coverage-regression statistic is structurally easy to misread

Finding: the frozen coverage-regression rule reports S-vs-L `40/40` because L depth is fixed at 100 while S depth is capped at 50. This is a mechanical consequence of the preregistered depth asymmetry and is not by itself evidence that semantic retrieval is relevance-inferior.

Disposition: `ACKNOWLEDGED / DEFERRED`

Reason: the canonical retrieval record already reports the statistic without reinterpretation and explicitly notes the depth-asymmetry cause. No frozen rule should be changed post-retrieval.

Revisit trigger: any final evaluation, architecture-decision, or public/internal summary that presents S-vs-L coverage regression must preserve this caveat adjacent to the statistic so it cannot be read as a standalone relevance conclusion.

## Main-thread consequence

- Mechanical retrieval execution is accepted as valid input to the already-frozen blind evaluator bundle.
- No execution correction is required.
- No frozen retrieval, fusion, holdout, relevance, or gate parameter changes are authorized by this review.
- Production architecture remains undecided; D-016 remains `PROPOSED`.

Last updated: 2026-09-10
