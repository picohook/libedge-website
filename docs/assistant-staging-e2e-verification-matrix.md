# Assistant staging E2E verification matrix

Status: PREPARATION ONLY. This document does not enable supportCheck, declare a privacy gate PASS, or authorize production.

Use only synthetic, non-user-derived test content until the checker-specific Provider Privacy Gate is independently verified PASS.

## Preconditions
- Exact staging commit and deployed Worker version recorded.
- Answer-model provider gate state recorded separately from checker privacy gate.
- supportCheck remains disabled while checker privacy gate is not PASS.
- Frozen checker identity and thresholds match the canonical pin.
- No raw query/topic/claim/evidence/user identifiers are written to operational telemetry.

## Post-privacy-PASS execution matrix
| Case | Expected result |
| --- | --- |
| Supported claims | All claims pass structural + semantic checks; response may be shown with evidence. |
| Unsupported claim | Entire answer rejected; no draft claim/evidence leakage in failure UI. |
| Checker timeout | Fail closed; no answer shown. |
| Checker transport/error | Fail closed; no answer shown. |
| Malformed checker response | Fail closed. |
| Frozen pin mismatch | Fail closed. |
| Operational pause active | Checker reliance stops immediately and request fails closed. |
| Daily invocation budget exhausted | Transport is not invoked; request fails closed. |
| Missing checker configuration | Fail closed. |
| Checker privacy gate not PASS | Checker is not invoked; fail closed. |

## Evidence to record
For each executed case record timestamp, exact staging commit, synthetic case identifier, gate/config state, outcome code, and whether any answer/evidence leaked. Do not record the synthetic prompt text in operational telemetry.

After the matrix passes, separately measure aggregate p50/p95 end-to-end latency, checker latency, timeout/error count, grounded-response success count, claims per answer, checker invocations per answer, saturation/throttling, and incremental cost evidence.
