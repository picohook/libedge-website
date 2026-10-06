# Research Golden Set v1 — Frozen harness specification

**Status:** PROPOSED / must be independently reviewed and frozen before measured execution  
**Protocol:** `docs/experiments/research-golden-set-v1-preregistration.md`

## Purpose

Define deterministic execution and scoring rules that cannot be reinterpreted after results. This artifact does not contain held-out questions and does not authorize production.

## Primary row outcome

A first attempt is executed against the exact frozen candidate. Application `ok:true, code:OK` is a candidate success only if the benchmark usefulness floor also passes:
- at least 2 returned verified/accepted claims; and
- those claims collectively map to at least 2 **distinct scholarly works**.

The distinct-work identity is `work_id` from the returned authorized `evidence` objects. For each accepted claim, map its returned `evidence_ids` to those evidence objects and count the union of distinct non-empty `work_id` values. If any cited evidence ID cannot be mapped to exactly one returned evidence object with a non-empty `work_id`, the row cannot satisfy the usefulness floor and is flagged for integrity review; do not fall back to counting evidence IDs. If a stable DOI is available it may be reported as an audit aid, but DOI absence does not merge distinct `work_id`s. Multiple evidence items referring to the same `work_id` count as one source.

An application-level OK below the floor is benchmark-classified `OK_THIN`; it remains API `OK` but contributes zero to acceptance numerators.

The final report must state that the preregistered 21/30 domain and 7/10 Turkish gate operating characteristics apply to the **floor-adjusted qualifying-answer rate**, not raw API-`OK` frequency; do not reuse the earlier raw-rate interpretation as if thin answers still counted.

## Retry eligibility

A row gets at most one retry. The authoritative eligibility rule is the public row-level rejection rule below: there must be **no semantic/policy/evidence rejection**, and every rejection/failure on the first attempt must be `SUPPORT_CHECK_FAILED_TIMEOUT`. A different claim on the same row may already have received a positive semantic decision; that does not by itself disqualify the timeout retry.

For Golden Set v1, the **only retry-eligible public reason is `SUPPORT_CHECK_FAILED_TIMEOUT`**. This deliberately uses the existing public content-free rejection diagnostic and avoids post-hoc interpretation of internal exception classes.

Explicitly **not retry-eligible**:
- `CLAIM_UNSUPPORTED` with any reason;
- any mixture containing `CLAIM_UNSUPPORTED` plus timeout/transport;
- `SUPPORT_CHECK_FAILED/LANGUAGE`, `LANGUAGE_CLAIM`, `LANGUAGE_EVIDENCE`, or `PIN_OR_RESPONSE`;
- `SUPPORT_CHECK_FAILED/BUDGET`;
- `SUPPORT_CHECK_FAILED_TRANSPORT_OR_OTHER` and all other transport/error catch-alls;
- support-check budget truncation;
- retrieval/evidence insufficiency;
- malformed model/checker content;
- provider/privacy/policy failures;
- `OK_THIN`.

Eligibility is row-level: **every rejection/failure on the row must be `SUPPORT_CHECK_FAILED_TIMEOUT`**. If any other rejection/failure reason is present, the row is not retried. No internal exception name or operator judgment may expand retry eligibility during v1.

For an eligible retry, preserve both attempts; execute the identical question/candidate once more with no tuning/intervention; the second attempt is the product outcome used for the gate. A second infrastructure failure is a fail-closed non-success. No third attempt.

The product path does not add an automatic retry around the support-check transport. Therefore the final report must also show a **first-attempt-only qualifying-answer rate** per domain and language stratum as a sensitivity figure. It is not a second gate and cannot replace the preregistered product outcome, but it makes any uplift caused by evaluation-only timeout retry visible.

## Pre-freeze latency calibration and systemic-infrastructure stop rule

Before the exact candidate fingerprint is frozen, run the bounded #579 latency sample **only on the 15-question development/tuning set**, using the reviewed **2 x ml.m5.large** staging checker shape, cache OFF, and the otherwise intended candidate. Held-out questions remain sealed and are not used. Record individual support-check call duration and application concurrency-wait diagnostics.

This development-set sample may inform the timeout and support-check concurrency values **before freeze**. Any resulting change must remain within the reviewed implementation bounds, be reconciled with #399's 2 x ml.m5.large / 300-per-day pilot boundary and cost/capacity model, and be recorded in the exact candidate fingerprint. Once the fingerprint is frozen, the held-out round may not change timeout or concurrency; a material change requires closing/re-versioning the round.

For held-out execution, infrastructure failure becomes a preregistered **systemic stop condition** if either:
- **2 consecutive held-out first attempts** end with retry-eligible `SUPPORT_CHECK_FAILED_TIMEOUT`; or
- after at least **5 first attempts in any domain x language cell**, that cell has **>=40% first-attempt timeout rows** (for example 2/5, 3/7, 4/10).

Evaluate the stop condition immediately after each first attempt and before consuming an evaluation retry. If triggered, stop the round, preserve the artifact, teardown the endpoint, and review infrastructure/candidate validity. Do not consume further held-out rows or retries merely to improve the rate. Restarting the same v1 round is allowed only if the frozen candidate remains unchanged and the trigger is shown to be an external transient; any timeout/concurrency/capacity change requires a successor freeze/version.

## Daily budget

Before starting a row, the harness must ensure the remaining staging supportCheck budget can safely cover that row including its possible retry. If not, stop before the row, teardown, and resume the untouched remainder in a later UTC-day window. Never raise the temporary 500/day hard ceiling to finish a shard.

## Cache integrity

Measured execution requires deployed staging cache OFF. Every measured attempt must report `verification_reused=false`. Any reused verification invalidates that row and stops the round for review.

## Capacity fingerprint

Acceptance execution requires verified 2 x ml.m5.large Fresh-Checker shape. Record instance type/count, immutable checker image, candidate SHA/config, timeout, support-check concurrency, retrieval config, answer provider/model, checker revision/pin, threshold/contract, language/evidence policy, cache state, and effective daily ceiling.

A 1-instance run is diagnostic only and cannot satisfy #399 pilot-parity acceptance.

## Output record per attempt

Record content-free identifiers/diagnostics sufficient to reproduce scoring:
- frozen question ID, domain, language, provenance class;
- attempt number and retry eligibility decision;
- outward outcome/code;
- rejection reason counts;
- verified/accepted claim count;
- distinct supporting `work_id` count;
- retrieval/evidence-depth counts;
- support-check truncation count (`SUPPORT_CHECK_BUDGET_TRUNCATED` / diagnostic truncated count), reported separately so generator length beyond the 4-check cap is not interpreted as checker rejection;
- `verification_reused`;
- discover/model/grounding/total latency;
- #579 support-check call and queue diagnostics;
- candidate/run fingerprint.

No held-out question or claim text is written into content-free operational telemetry. Sealed evaluation artifacts may contain the question text under the evaluation access boundary.

The final report must also show truncation counts/rates per domain and language stratum. If claims beyond the frozen four-check cap are generated, those rows remain fail-closed under the existing contract; do not relabel truncation as semantic checker rejection or silently raise the cap inside v1.

## Freeze condition

Before measured execution this specification, the benchmark implementation/schema, exact candidate fingerprint, provenance plan, held-out manifest/hash, rater/seed plan, budget/shard plan, and 2-instance staging lifecycle must be independently reviewed. No post-result rule changes are permitted; material changes require a successor preregistration.