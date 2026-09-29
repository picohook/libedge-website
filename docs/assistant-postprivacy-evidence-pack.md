# supportCheck post-privacy-PASS evidence pack

Status: PREPARATION ONLY. Do not execute before checker-specific Privacy Gate PASS. Synthetic, non-user-derived content only.

This pack turns the remaining D-023 operational/readiness work into a single evidence sequence after the real SageMaker endpoint has passed independent privacy review.

## Execution record

Record once:
- exact staging git SHA and deployed Worker version;
- AWS account and region;
- immutable checker image URI (@sha256);
- exact SageMaker endpoint name/ARN;
- checker model/revision/engine-manifest pin;
- checker Privacy Gate review reference and PASS timestamp;
- staging supportCheck configuration state.

Never record raw research queries, claim text, evidence abstracts, user IDs, email addresses, or user-derived tracking/session identifiers in operational evidence.

## Synthetic E2E matrix

Execute every case in `docs/assistant-staging-e2e-verification-matrix.md`. For each case record only:
- timestamp;
- synthetic case ID;
- exact staging SHA;
- expected outcome class;
- observed outcome code;
- whether answer text leaked (yes/no);
- whether evidence leaked (yes/no);
- checker invocation count;
- checker timeout/error class if applicable.

A matrix PASS requires every fail-closed case to reject without draft/evidence leakage and the positive supported case to reach the allowed response path.

## D-023 operational-pause drill

Precondition: a positive synthetic request has demonstrated the checker path works.

1. Record the live pause key's pre-drill state.
2. Explicitly set the live pause mechanism to paused using the approved operator path; no redeploy.
3. Run the same bounded synthetic request.
4. Verify fail-closed outcome and zero draft/evidence leakage.
5. Restore the prior/resume state.
6. Re-run the same bounded synthetic request and verify checker reliance resumes.
7. Record timestamps and aggregate outcome codes only.

The drill is incomplete if pause requires a deployment, if a paused request reaches the checker transport, if draft/evidence leaks, or if the prior state cannot be restored.

## Performance/reliability sample

After the matrix and pause drill pass, collect a bounded synthetic staging sample. Record aggregate only:
- sample size;
- end-to-end p50/p95;
- checker incremental p50/p95;
- timeout count;
- transport/error count;
- grounded-response success count;
- claims per answer distribution;
- checker invocations per answer;
- saturation/throttling count.

Do not set or revise thresholds retrospectively from the same sample.

## Cost evidence

For the exact deployed endpoint record:
- region and instance type;
- initial/min/max instance capacity and autoscaling state;
- current AWS price source and retrieval timestamp;
- calculated hourly fixed hosting cost and 30-day fixed floor;
- application daily invocation limit;
- AWS Budget/Billing alarm identifier and threshold;
- measured checker invocations per answer from the synthetic sample.

The application invocation breaker controls usage pressure; it does not cap the real-time endpoint's fixed instance-hour cost. The AWS billing control is therefore separate and required.

## Completion boundary

Passing this evidence pack may close the remaining staging exercise portions of #218 and the evidence portions of #219, subject to independent review. It does not itself authorize production, mark the deferred 1,080-claim H2 holdout complete, or convert any proposal into human ADOPTION.
