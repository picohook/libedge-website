# R2 controlled-pilot capacity closure packet

Status: **PROPOSED / EVIDENCE INCOMPLETE / NO PRODUCTION AUTHORIZATION**

Issue: #263

This record freezes the bounded capacity question for the first R2 controlled production pilot. It does not enable production supportCheck, deploy SageMaker capacity, change production configuration, or authorize R3.

## Pilot boundary

- Rollout population: **2 institutions / approximately 100 users**.
- Accepted technical target to prove: **C2**, meaning two simultaneous outer Assistant requests.
- **C4 is not supported by current evidence** and is outside this closure scope.
- Wider rollout requires a new capacity review and separate R3 human authorization.

## Proposed exact-RC checker hosting shape

For the R2 evidence candidate:

- AWS SageMaker real-time endpoint.
- Region: `us-east-1`.
- Instance type: `ml.m5.large`.
- Proposed fixed count for the bounded R2 candidate: **2 instances**.
- Autoscaling: **none for this bounded candidate**.
- Frozen checker model/revision/manifest, thresholds, gunicorn workers, Assistant timeout, fail-closed behavior, and grounding contract must remain unchanged during the repeat evidence.

The prior controlled staging experiment changed only instance count from 1 to 2 and observed C1 1/1 OK and C2 2/2 OK. C4 was not reliable. That experiment is causal evidence for choosing the 2-instance candidate, but it is not by itself the required exact-RC repeat evidence.

## Hosting cost evidence

Repository price evidence records SageMaker real-time Hosting `ml.m5.large` in `us-east-1` at **$0.115 per instance-hour**.

For the proposed fixed 2-instance candidate:

- hosting floor: **$0.230/hour**;
- 24-hour floor: **$5.52/day**;
- 730-hour planning-month floor: **$167.90/month**.

These are fixed instance-hour hosting-floor estimates only, not a total AWS bill and not a production spend authorization.

## Daily invocation guardrail

The staging environment fallback is currently **100 supportCheck invocations/day**. This remains a conservative measurement guardrail, not a production sizing conclusion.

The runtime-editable daily limit added under #370 Slice 1 allows the effective limit to be changed without a deployment, with env fallback, readback verification, audit logging, and fail-closed handling for invalid runtime data.

For R2, **no production daily invocation limit is accepted by this document**. The final proposed value and rationale must be recorded after the exact-RC C1/C2 repeat evidence, using observed checker invocations per outer Assistant request and the limited 2-institution/~100-user rollout scope. This prevents turning the staging value of 100 into an unsupported production assumption.

## Exact-RC repeat evidence still required

Before #263 can close for R2:

1. configure the staging evidence endpoint to the proposed exact-RC hosting shape above;
2. run **Assistant Bounded Load Evidence** with `levels=1,2`;
3. repeat the exact same C1/C2 run **at least twice**;
4. require C1 and C2 to complete without supportCheck timeout/error;
5. retain content-free E2E/stage latency, grounded-success and coarse fail-closed/rejection evidence;
6. restore the staging endpoint to its normal resting capacity after evidence collection unless a separately reviewed staging decision says otherwise;
7. record the final proposed production daily invocation limit and rationale;
8. obtain explicit human acceptance of observed latency/reliability plus hosting and invocation-budget cost.

Do not run C4 for this closure. Do not weaken checker thresholds, timeout, fail-closed behavior, model/revision/manifest, or grounding rules to make the evidence pass.

## Known risk retained

Prior successful requests have taken tens of seconds, and education usage can arrive in correlated bursts. C2 is therefore a bounded pilot capacity target, not an SLA and not a global concurrency ceiling. During R2, timeout/grounding-rejection telemetry must be watched for burst-related saturation.

## Stop condition

Stop #263 capacity work once both exact-RC C1/C2 repeats pass, the final daily invocation limit/rationale is recorded, and the human gatekeeper explicitly accepts the observed latency/reliability and hosting/invocation-budget cost for the defined R2 pilot.

Production remains OFF until a separate explicit production authorization tied to an exact commit/config/runtime route.
