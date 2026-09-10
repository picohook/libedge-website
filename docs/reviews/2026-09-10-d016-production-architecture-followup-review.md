# D-016 — Production Retrieval Architecture Follow-up Review

Status: `HISTORICAL — ACCEPTED`
Date: 2026-09-10
Parent review: `docs/reviews/2026-09-10-d016-production-architecture-review.md`
Modified proposal: `docs/architecture/p05-production-retrieval-decision.md`

## Classification

`ACCEPTED`

The independent reviewer freshly inspected the base-to-head diff for the modified D-016 proposal and accepted all requested modifications without further conditions.

Verified points:

- valid zero-candidate semantic responses are unambiguously non-fallback outcomes;
- malformed/unprocessable provider responses remain objective availability/validity failures eligible for lexical fallback;
- the `<=0.5 requests/second` pre-broad-enable threshold is concrete, conservative, and separate from relevance judgment;
- broad enablement is blocked when the capacity estimate exceeds the threshold or cannot be responsibly produced;
- the first production-scale D-013 checkpoint is concrete at the first `1,000` charged semantic responses or `7 calendar days`, whichever occurs first, using aggregate privacy-preserving telemetry only;
- Q08 (`-10pp`, Rater 1) and Q27 (`-40pp`, Rater 2) are retained as historical weak examples without creating query-specific routing or a new relevance gate;
- the Vectorize capacity/availability finding is correctly triaged as `ACKNOWLEDGED / DEFERRED`;
- the core architecture remains S primary for the existing top-10 research-result contract, L only as objective availability fallback/rollback, H not adopted, Vectorize not added now.

## Authorization boundary

This review authorizes the main engineering thread to transition D-016 from `PROPOSED` to `LOCKED`.

It does **not** authorize broad production enablement. Implementation must remain staging/feature-flag first, and broad enablement remains subject to the locked operational capacity guardrail and rollout checks in the canonical architecture record.

No P0.5 relevance result may be retuned or reinterpreted as part of rollout.

## OUT-OF-SCOPE FINDINGS

No new material out-of-scope finding was raised in this follow-up review.
