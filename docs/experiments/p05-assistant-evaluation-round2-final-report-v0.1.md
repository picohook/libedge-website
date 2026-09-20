# P0.5 Assistant Evaluation — Round 2 Final Report v0.1

Status: `FINAL REPORT CANDIDATE / INDEPENDENT AUDIT REVIEW REQUIRED`

## Scope

Round 2 is a single-route paired-protocol characterization. Its sole intended intervention relative to Round 1 was provider-enforced JSON Schema structured output. It is not a model comparison, model-selection decision, deployment authorization, production-adoption decision, or legal/compliance conclusion.

Round 1 remains closed and unchanged.

Measured protocol SHA: `bbe131075e2178d223d7ec11a5afbd84ba46516d`  
Round 2 config fingerprint: `6f9556ebf835fdd139a24d88a75f31bee191b6f73d6d9a7e293630344dc2c92f`  
Measured design: 24 frozen cases × 3 repetitions = 72 serial measured requests.

## Integrity and preflight

Before measured execution, retention mode was `none`, the exact inference profile was ACTIVE, and the exact frozen structured-output schema succeeded on a trivial non-benchmark preflight request.

Preflight wall-clock was 4.9407079 s with 314 input and 27 output tokens and zero cache read/write. Preflight is excluded from C1-C7. The preflight response shortened `PF:e1` to `e1`; this was not normalized or repaired, and case-local evidence membership remained the separate deterministic C2 check.

Measured execution contained 72/72 successful requests, all 24 cases, all three repetitions, consistent protocol/config identifiers, no replacement of failures, and no parser repair, fence/prose stripping, JSON extraction/coercion, fallback, or retry.

## C1 — response-contract validity

**Round 2: 72/72 (100%).**

Every measured response passed the unchanged strict local response-contract/schema checker.

For the paired descriptive comparison, Round 1 remains **0/72**. The change from 0/72 to 72/72 is consistent with the intended structured-output intervention, but this result does not by itself establish semantic grounding safety or production readiness.

## C2 — evidence-reference validity

**Round 2: 72/72 measured responses passed case-local evidence-ID membership validation.**

- unknown evidence IDs: 0
- claims without evidence IDs: 0

Round 1 strict C2 remained parser-gated at 0/72 because C1 failed. Round 2 does not repair or reinterpret Round 1.

## Independent semantic rating procedure

C3-C6 were rated from the frozen blind evaluator bundle by two isolated primary AI raters from different model families:

- R1: isolated ChatGPT conversation
- R2: isolated Claude conversation

Both received the same anonymized frozen material, did not receive one another's judgments before locking, and produced `FINAL / LOCKED` packets. They are AI raters, not human experts. Model-family diversity reduces same-model correlated-error risk but does not eliminate correlated errors. Blinding was best-effort; stylistic identification cannot be fully excluded.

The original preregistration required two locked primary ratings before reconciliation but did not preregister an adjudication rule. After the disagreement pattern became visible, a separately reviewed reporting decision froze **no reconciliation / no adjudicated single semantic score** for the primary Round 2 report. The two locked ratings are therefore reported side by side. This post-rating reporting decision is not represented as preregistered.

## C3 — evidence support / unsupported-claim rate

Each rater evaluated the same 191 factual claims.

| Rater | SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | Unsupported-claim rate |
| --- | ---: | ---: | ---: | ---: |
| R1 | 170 | 19 | 2 | 2/191 = **1.05%** |
| R2 | 179 | 12 | 0 | 0/191 = **0.00%** |

Exact claim-label agreement was **178/191 = 93.2%**; 13 claim labels disagreed.

The disagreements were concentrated in E21 and E23 rather than distributed across the benchmark. The pattern reflects different treatment of inferential/evaluative language: R1 applied a stricter evidentiary boundary to some added characterization, while R2 treated more of that language as supported or partially supported. This describes the locked ratings; it does not declare either rater correct.

No reconciled C3 value is reported.

## C4 — fail-closed correctness

Applicable frozen cases: E13-E16, three repetitions each = 12 case observations per rater.

- R1: **12/12 PASS (100%)**
- R2: **12/12 PASS (100%)**

The result is concordant across the two locked raters. The underlying rater-specific observations remain the primary record.

## C5 — conflict handling

Applicable frozen cases: E09-E12, three repetitions each = 12 case observations per rater.

For each rater independently:

| Requirement | R1 | R2 |
| --- | ---: | ---: |
| material conflict identified | 12/12 | 12/12 |
| unsupported side avoided | 12/12 | 12/12 |
| uncertainty/limitation stated | 12/12 | 12/12 |

The C5 observations are concordant across the two locked raters. No consensus replacement is created.

## C6 — usefulness within evidence boundary

Across 72 case-level observations:

| Rater | Score 2 | Score 1 | Score 0 | Mean score |
| --- | ---: | ---: | ---: | ---: |
| R1 | 60 | 12 | 0 | **1.833/2** |
| R2 | 72 | 0 | 0 | **2.000/2** |

R1 assigned score 1 to all three repetitions of E05, E14, E21, and E23; R2 assigned score 2 to those observations. Thus there were **12/72 usefulness disagreements**, with agreement on the remaining **60/72** observations.

No reconciled C6 value or composite semantic score is reported.

## Latency

Measured requests only, warm-schema steady state:

- successful requests: 72/72
- mean: 2312 ms
- median: **2097 ms**
- p95: **3777 ms**
- min: **1222 ms**
- max: **7041 ms**

The 4.9407079 s structured-output preflight is separately disclosed and excluded. Round 2 latency therefore does not characterize cold-schema/cold-start production latency.

## C7 — measured cost

Execution-date official AWS Bedrock pricing snapshot immediately before measured execution:

- Standard input: USD 3.00 / 1M tokens
- Standard output: USD 15.00 / 1M tokens
- 5-minute cache write: USD 3.75 / 1M tokens
- 1-hour cache write: USD 6.00 / 1M tokens
- cache read: USD 0.30 / 1M tokens

Measured usage:
- input: 31,326 tokens
- output: 9,255 tokens
- cache read: 0
- cache creation: 0

Measured cost:
- input: USD 0.093978
- output: USD 0.138825
- total: **USD 0.232803**
- mean per successful request: **USD 0.003233375**
- median per successful request: **USD 0.0031545**
- projected per 1,000 successful requests from the observed mean mix: **USD 3.233375**

Preflight and unscored warm-up are excluded from C7.

## Round 1 → Round 2 descriptive result

The preregistered Round 2 question was whether provider-enforced JSON Schema structured output eliminates the response-envelope failure while preserving frozen evidence-grounding behavior.

The deterministic envelope result changed from Round 1 C1 **0/72** to Round 2 **72/72**, with no parser relaxation or output repair. Round 2 C2 was 72/72 with zero unknown or missing evidence IDs.

The independently rated semantic record is reported without adjudication: unsupported-claim rate was **1.05% for R1** and **0.00% for R2**; both raters recorded **12/12 fail-closed PASS** and all three C5 conflict-handling requirements at **12/12**; usefulness was **1.833/2 for R1** and **2.000/2 for R2**.

These observations characterize this frozen synthetic benchmark and exact route/configuration. They do not establish that the route is production ready, do not validate a future production semantic `supportCheck`, do not select a model, and do not authorize deployment.

## Reporting decision and limitations

The primary semantic result intentionally preserves rater disagreement. There is no post-hoc winner, stricter-label substitution, averaging of ordinal labels, majority vote, or third-rater adjudication.

Known limitations include:
- single admitted route; no comparative model winner can be inferred;
- synthetic 24-case benchmark;
- three repetitions per case under one frozen configuration;
- AI rather than human semantic raters;
- possible correlated AI-rater errors despite model-family diversity;
- best-effort rather than guaranteed identity blinding;
- known interpretation sensitivity around E21/E23;
- warm-schema latency rather than cold-start production latency.

Any future adjudication or third-rater exercise must be labeled separately as post-hoc/sensitivity analysis and cannot replace these locked primary results.

## Decision boundary

This report supplies evaluation evidence only. It does **not**:
- select the production model;
- authorize production deployment or live user research queries;
- relax the Provider Privacy Gate;
- validate the production grounding validator or D-022 semantic `supportCheck`;
- alter the separate retrieval/hybrid experiment;
- alter the paused production go-live/migration state;
- make a general provider/model-family safety or compliance claim.

A later model-selection or deployment decision requires its own explicit, reviewed decision record.
