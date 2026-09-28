# supportCheck SageMaker deployment and privacy-evidence runbook

Status: PREPARATION ONLY / ACCOUNT-SPECIFIC EVIDENCE REQUIRED. Following this runbook does not itself establish Privacy Gate PASS.

Do not deploy until the Fresh-Checker container source is independently accepted and an immutable ECR image digest is available. Do not send protected research-interest content until checker-specific privacy evidence is independently reviewed and accepted.

## Immutable artifact
Record:
- AWS account ID and region.
- ECR repository.
- immutable image URI using @sha256 digest (never tag-only evidence).
- frozen checker model, revision, engine manifest SHA256, entailment/contradiction thresholds and aggregate rule.
- source commit used to build the image.

## SageMaker resources
Record the exact model, endpoint configuration, and endpoint names/ARNs plus creation timestamps. Verify the endpoint configuration references the immutable image digest. Record instance type, initial/min/max capacity and any autoscaling configuration.

## Privacy evidence
Verify and preserve account-specific evidence that:
- Data Capture is OFF.
- the Worker IAM principal can InvokeEndpoint only on the exact intended endpoint.
- no request/response bodies, claim/evidence text, query/topic, user identifiers, or user-derived session/tracking metadata are copied to logs or another integration.
- container stdout/stderr is content-free; only bounded startup/version or coarse error-class telemetry is permitted.
- InferenceId is not populated with user-derived data.
- CustomAttributes is not populated with user-derived data.
- no side integration copies inference payloads elsewhere.

## Cost and operational controls
Record the current AWS price source and timestamp for the selected region/instance and calculate the hourly and 30-day minimum fixed hosting cost. Configure an AWS Budget/Billing alarm separately from the application invocation circuit-breaker. Set the daily invocation limit only after staging measurements support a value.

## Staging activation sequence
1. Build and push the accepted container.
2. Record immutable digest and create model/endpoint configuration with Data Capture OFF.
3. Create endpoint and wait for InService.
4. Collect IAM/config/logging/privacy evidence without sending protected content.
5. Obtain independent checker-specific privacy review.
6. Only after PASS, configure staging endpoint/region, enable checker in staging, and run the synthetic E2E matrix.
7. Exercise operational pause and restore/resume.
8. Collect aggregate latency/reliability/cost evidence.
9. Keep production disabled until separate human production authorization.

## Stop conditions
Stop and leave checker disabled if image identity cannot be pinned, Data Capture is on/uncertain, IAM is broader than intended without accepted justification, content appears in logs/telemetry, endpoint contract fails, or any privacy evidence is incomplete.
