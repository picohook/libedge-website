# Fresh-Checker autoscaling decision record

Status: proposal for #504. This record authorizes no infrastructure change.

## Decision to evaluate

Evaluate target-tracking autoscaling for the staging Fresh-Checker SageMaker endpoint before any production consideration. The first candidate signal is **SageMaker InvocationsPerInstance**, because it scales with admitted checker work and does not redefine the application trust boundary. CPU/GPU utilization may be observed as secondary evidence but MUST NOT be the sole scaling contract.

Initial staging envelope:

- minimum capacity: 1 instance while the bounded experiment is running;
- maximum capacity: 2 instances;
- scale-out cooldown: 60 seconds;
- scale-in cooldown: 300 seconds;
- no autoscaling change may increase the per-request support-check cap or the daily invocation budget.

These are experiment parameters, not production defaults.

## Saturation and fail-closed behavior

Autoscaling is capacity management, not an authorization or verification fallback. While capacity is saturated or a new instance is starting, requests retain the existing bounded timeout, checker budget and fail-closed behavior. The application MUST NOT convert checker timeout/unavailability into a verified result.

Measure separately:

- application-observed support-check wall-clock time;
- SageMaker invocation/model latency when available;
- invocation count per instance;
- endpoint instance count;
- 4xx/5xx/throttle/error signals.

A rise in application support-check time without a comparable rise in model latency is treated as queueing/scale-up evidence, not as proof that the model itself became slower.

## Cost guardrail

Before any staging experiment, record the current hourly price assumption for the selected instance type and calculate the maximum incremental hourly and monthly exposure at the proposed max capacity. The experiment MUST fit inside the existing staging budget/alarm envelope. If the envelope cannot be demonstrated from current billing configuration, do not enable autoscaling.

Autoscaling MUST NOT modify budgets or alarms.

## Staging experiment

Use a bounded, synthetic, content-free load against staging only. Compare fixed capacity 1 versus autoscaling 1–2 using the same admitted workload and checker contract.

Collect p50/p95 support-check wall-clock latency, model/invocation latency, error/throttle rate, scale-out time, time spent at two instances, and estimated incremental cost.

Stop immediately if:

- any verified result appears after checker timeout/unavailability;
- daily invocation budget or per-request checker cap is bypassed;
- endpoint errors materially increase;
- scaling does not return to minimum capacity after the cooldown/window;
- expected cost exceeds the pre-recorded staging envelope.

Do not use production traffic or production endpoint configuration for this evaluation.

## Promotion criterion

Autoscaling is worth a later implementation issue only if the staging experiment shows a repeatable reduction in queueing-driven p95 support-check latency without weakening fail-closed behavior and with acceptable bounded cost. If latency is primarily model/runtime time rather than queueing, defer autoscaling and optimize the checker/model path instead.

## Rollback

The staging experiment must have a documented one-step rollback to fixed capacity 1 and verification that the scalable target/policy is removed. Rollback evidence belongs in the experiment issue before closure.

## Production boundary

This record does not authorize registering a production scalable target, creating a production scaling policy, changing production endpoint capacity, IAM, budgets or alarms. Production remains gated by #399 and explicit maintainer authorization.
