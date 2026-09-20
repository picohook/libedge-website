# D-022 Production `supportCheck` Evaluation Preregistration v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE FREEZE OR EXECUTION`

Prepared: 2026-09-20

Canonical requirement: D-022 in `docs/decisions.md`  
Reusable source artifact: `docs/experiments/p05-assistant-evaluation-round2-final-report-v0.1.md`

## Purpose

Define a measurable, fail-closed acceptance experiment for a future production-grade semantic `supportCheck` implementation.

D-022 requires measurement of the false-positive rate: unsupported claims incorrectly accepted as supported. This protocol does not select or implement a checker and does not authorize production use.

## Relationship to the completed Assistant model evaluation

The Assistant-model evaluation workstream is **closed/complete for the currently admitted single PASS route only**: AWS Bedrock `anthropic.claude-sonnet-4-6`, `us.` inference profile, `bedrock-runtime / InvokeModel`, retention `none`, under the frozen configuration already evaluated.

This is not a permanent closure of provider/model evaluation. If another exact route later receives Provider Privacy Gate PASS, that route requires its own capability/cost/latency evaluation under a separately frozen round before it can participate in a comparative model-selection decision. A newly PASS route does not inherit the Sonnet 4.6 evaluation result.

D-022 is a separate architecture/privacy gate. Round 2 did not validate a production `supportCheck`.

## Candidate checker unit

The evaluated unit is the exact semantic checker implementation plus all material inference/configuration dependencies, including:

- checker code/version or commit SHA;
- provider/model/endpoint/hosting route if model-backed;
- prompt/instruction version;
- thresholds and decision mapping;
- temperature/randomness;
- max tokens;
- retries/timeouts;
- evidence truncation/normalization;
- preprocessing/postprocessing;
- any caching/tool behavior.

Any material change after freeze creates a new checker version and requires a new evaluation round.

If the checker is model-backed, its exact route must independently satisfy the Provider Privacy Gate before any research-interest-bearing production use. Synthetic evaluation alone does not waive that requirement.

## Primary decision contract

For each claim, the checker must emit exactly one machine-readable decision:

- `ACCEPT` — claim is sufficiently supported by the supplied cited evidence;
- `REJECT` — claim is not sufficiently supported;
- `ERROR` — checker cannot produce a valid decision.

For the primary safety analysis, `ERROR` is fail-closed and is not counted as `ACCEPT`.

No human or model may repair an invalid checker output during a measured run.

## Ground-truth policy

The primary ground truth is binary:

- `SUPPORTED` -> eligible for `ACCEPT`;
- `UNSUPPORTED` -> must be `REJECT`.

`PARTIALLY_SUPPORTED` is intentionally **not collapsed into either binary class in the primary metric**. Treating partial support as positive or negative would embed an unpreregistered policy choice about whether partially grounded user-visible claims are acceptable.

Report `PARTIALLY_SUPPORTED` separately as an ambiguity/challenge stratum.

A later product decision may define a stricter policy (for example, requiring full support for every rendered claim), but that policy must be frozen before it is used as a production acceptance rule.

## Reuse of the Round 2 blind-rating corpus

The completed Round 2 corpus may be reused as a **locked seed benchmark**, avoiding unnecessary re-annotation:

- 191 claim instances;
- each claim paired with its frozen EvidencePack context;
- two independent `FINAL / LOCKED` AI-rater labels;
- raw exact agreement 178/191 (93.2%);
- known disagreements concentrated in E21 and E23.

Reuse is permitted only with contamination controls:

1. the checker implementation, prompt, thresholds, and mapping must be frozen before its author sees per-claim Round 2 labels for development/tuning;
2. the 191 claims may not be used to tune the candidate checker and then also be represented as an untouched confirmatory test;
3. rater disagreements must remain visible; no post-hoc consensus label may be invented;
4. Round 2 labels are AI-rater judgments, not human-expert truth;
5. because the corpus has already been seen during this project, it is best treated as a locked seed/verification set rather than sufficient standalone production evidence.

### Consensus subset

For a first deterministic evaluation, the Round 2 **exact-agreement subset** may be used without adjudication:

- both raters `SUPPORTED` -> consensus-supported;
- both raters `UNSUPPORTED` -> consensus-unsupported;
- all disagreements and all exact-agreement `PARTIALLY_SUPPORTED` claims remain separate challenge strata.

The exact counts must be generated mechanically from the frozen rater packets before execution and independently checked. Do not infer counts from prose summaries.

## Required fresh holdout

The reused Round 2 corpus alone is insufficient for production acceptance because it is small, previously inspected, and contains very few clearly unsupported claims.

Before a production decision, create and freeze a **fresh holdout** that the checker author has not used for development. It must intentionally contain enough unsupported claims to estimate false-positive behavior meaningfully.

The holdout must:
- use synthetic or public/non-user-specific evidence;
- contain supported, unsupported, partially supported, conflict, insufficiency, citation-valid-but-semantically-wrong, and distractor cases;
- include difficult near-miss unsupported claims rather than only obvious negatives;
- freeze claim text, EvidencePack, labels/rubric, and case strata before checker execution;
- use independent blind labeling before unsealing checker results.

Sample size and acceptance threshold are **TO FREEZE before execution**. They must be chosen from an explicit statistical design rather than after observing checker performance.

## Primary metric — false-positive rate

On the frozen binary ground-truth set:

`FPR = unsupported claims incorrectly ACCEPTed / all ground-truth unsupported claims`

Report numerator, denominator, point estimate, and a preregistered confidence interval.

The primary production acceptance threshold is **TO FREEZE** before execution.

Because D-022 is a safety requirement, a threshold must constrain the confidence bound or otherwise account for sample size; a point estimate of zero from a tiny negative set is not sufficient evidence.

## Secondary metrics

Report separately:

- false-negative rate: supported claims incorrectly REJECTed / supported claims;
- ERROR rate;
- coverage by benchmark stratum;
- results on `PARTIALLY_SUPPORTED` claims without folding them into primary FPR;
- disagreement/challenge-stratum behavior;
- latency and cost if the checker is model-backed.

No undocumented composite score.

## Independence and blinding

Before execution:
- freeze checker implementation/configuration;
- freeze benchmark and labels;
- seal any mapping needed to prevent implementer tuning against labels;
- obtain independent review of the protocol and bundle.

For a new holdout, use two independent primary raters. Lock both before any reconciliation. If an adjudication rule is desired, preregister it **before** rater outputs are seen; otherwise preserve both ratings side by side.

The PR/audit reviewer is not automatically a semantic rater.

## Execution discipline

- run every frozen claim exactly as specified;
- record checker version/config fingerprint;
- record claim/case identifier, decision, success/error, latency, and provider request ID where privacy-safe;
- no silent retry or replacement;
- no manual repair;
- no threshold adjustment after outputs are observed;
- preserve raw machine-readable results.

If a material defect requires changing the checker, benchmark, mapping, metric, or threshold after measured execution starts, close that round and preregister a new one.

## Acceptance decision

A production `supportCheck` may advance only if the independently reviewed frozen acceptance criterion is met on the required fresh holdout.

The reused Round 2 seed benchmark is supporting evidence and regression coverage; it does not by itself authorize production.

Passing D-022 does not certify retrieval truth/relevance. D-022 measures whether a claim is supported by the evidence supplied to the checker. Retrieval quality remains a separate failure domain.

## Required artifacts before execution

1. exact candidate checker specification and implementation SHA;
2. mechanically derived Round 2 seed-benchmark manifest;
3. fresh holdout construction protocol and frozen bundle;
4. exact binary decision mapping;
5. frozen sample size, confidence-interval method, and production acceptance threshold;
6. deterministic evaluation harness;
7. raw-results schema;
8. independent reviewer acceptance.

No production deployment is authorized by this preregistration.

## Next action

Independent reviewer reviews this preregistration proposal. After acceptance, freeze the statistical acceptance criterion and fresh-holdout design **before** implementing or tuning a candidate checker against evaluation labels.
