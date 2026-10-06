# Research Golden Set v1 — Frozen harness specification

**Status:** PROPOSED / must be independently reviewed and frozen before measured execution  
**Protocol:** `docs/experiments/research-golden-set-v1-preregistration.md`

## Purpose

Define deterministic execution and scoring rules that cannot be reinterpreted after results. This artifact does not contain held-out questions and does not authorize production.

## Primary row outcome

A first attempt is executed against the exact frozen candidate. Application `ok:true, code:OK` is a candidate success only if the benchmark usefulness floor also passes:
- at least 2 returned verified/accepted claims; and
- those claims collectively map to at least 2 **distinct scholarly works**.

The distinct-work identity is `work_id` from the authorized EvidencePack/returned evidence mapping. If a stable DOI is available it may be reported as an audit aid, but DOI absence does not merge distinct `work_id`s. Multiple evidence items referring to the same `work_id` count as one source. Distinct `evidence_id` alone is not sufficient for this floor.

An application-level OK below the floor is benchmark-classified `OK_THIN`; it remains API `OK` but contributes zero to acceptance numerators.

## Retry eligibility

A row gets at most one retry, and only when the first attempt has **no semantic checker decision and no semantic/policy/evidence rejection**.

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
- `verification_reused`;
- discover/model/grounding/total latency;
- #579 support-check call and queue diagnostics;
- candidate/run fingerprint.

No held-out question or claim text is written into content-free operational telemetry. Sealed evaluation artifacts may contain the question text under the evaluation access boundary.

## Freeze condition

Before measured execution this specification, the benchmark implementation/schema, exact candidate fingerprint, provenance plan, held-out manifest/hash, rater/seed plan, budget/shard plan, and 2-instance staging lifecycle must be independently reviewed. No post-result rule changes are permitted; material changes require a successor preregistration.