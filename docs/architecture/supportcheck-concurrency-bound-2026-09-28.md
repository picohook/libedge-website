# supportCheck claim-execution concurrency boundary

Status: **PROPOSED / INDEPENDENT REVIEW REQUIRED**

Issue #218 identified that grounding validation currently awaits supportCheck serially for each claim. With the existing maximum of eight generated claims, checker latency can multiply across an answer.

## Proposed boundary

Do not introduce unbounded `Promise.all`. Use a small fixed worker pool with **maximum concurrency 2** for semantic support checks.

The proposal preserves these invariants:

- structural validation occurs before a claim is eligible for supportCheck;
- every eligible factual claim still receives exactly one supportCheck verdict;
- any checker error/timeout/invalid result rejects that claim;
- the response remains all-or-nothing at the response boundary;
- output claim ordering remains input ordering;
- no retries are added implicitly;
- the per-call timeout remains the existing bounded supportCheck timeout;
- concurrency is fixed before staging performance evidence and must not be tuned from real-user query content.

## Why 2 rather than 8

The purpose is to remove the worst serial latency multiplication without creating an eight-request burst against a single SageMaker endpoint. A concurrency of two is a conservative initial engineering bound, not a performance claim. It must be evaluated with non-user-derived staging fixtures after checker privacy qualification.

## Evidence required before changing the bound

Record, using non-user-derived test inputs:

- checker contribution p50/p95 latency;
- end-to-end p50/p95 latency;
- timeout/error rate;
- claims per answer;
- checker invocations per answer;
- observed endpoint saturation/throttling.

A later change from 2 requires a reviewed change with the measurement evidence. Production authorization is separate.

## Implementation shape

A follow-up implementation should separate structural eligibility from semantic execution, run only eligible checks through a two-worker queue, store verdicts by original claim index, then assemble accepted/rejected claims deterministically in original order. This avoids changing response semantics while bounding concurrency.
