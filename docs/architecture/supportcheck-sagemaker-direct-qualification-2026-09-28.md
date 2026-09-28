# supportCheck SageMaker Direct Route — Qualification Specification

Status: `PROPOSED / ACCOUNT-SPECIFIC EVIDENCE REQUIRED / NO PRIVACY PASS`

Date: 2026-09-28

## Candidate route

`Cloudflare Worker -> HTTPS AWS SageMaker Runtime InvokeEndpoint (SigV4) -> LibEdge-owned SageMaker real-time endpoint -> frozen Fresh-Checker container`

This is the preferred minimal route to qualify before introducing an additional proxy/API-Gateway/Lambda layer.

## Why direct invocation is technically viable

AWS documents that SageMaker `InvokeEndpoint`:

- is authenticated with AWS Signature Version 4;
- addresses endpoints scoped to an individual AWS account;
- supports resource-level IAM restriction to an exact endpoint ARN.

AWS CloudTrail documentation further states that `InvokeEndpoint` data events do not log request parameters.

These properties reduce moving parts but do **not** by themselves establish LibEdge privacy PASS.

## Exact application authentication boundary

Reuse the existing environment-only AWS credential pattern already used by the Assistant Bedrock adapter.

The checker caller must receive credentials only from runtime secrets/environment and must not expose them to frontend code, source control, logs, or API responses.

The invoking principal is restricted to:

- action: `sagemaker:InvokeEndpoint`;
- resource: one exact LibEdge checker endpoint ARN;
- no SageMaker create/update/delete/list permission is required by the Worker invocation identity.

## Content-handling requirements

### SageMaker data capture

The qualified endpoint configuration must have inference Data Capture disabled. Qualification evidence must come from the exact account/endpoint configuration (for example, the endpoint configuration returned by AWS), not from an assumption about defaults.

Do not set `InferenceId`, `CustomAttributes`, session identifiers, or other optional routing/tracking metadata from user/query identity.

### Container logging

AWS sends model-container `stdout` and `stderr` to CloudWatch Logs. Therefore the checker container must not write any of the following to stdout/stderr:

- evidence text;
- claim text;
- raw request or response body;
- query/topic/research-interest content;
- authorization material;
- user ID or user-derived stable identifier.

Operational logs are limited to content-free machine state such as startup/version status and coarse error class.

### CloudTrail

CloudTrail audit evidence may record invocation metadata, but the AWS-documented `InvokeEndpoint` data event does not log request parameters. Qualification must verify that no separately configured application/audit integration copies payloads elsewhere.

## Frozen artifact requirements

Before privacy PASS or staging activation, the deployed endpoint evidence must identify:

- exact AWS account (internally; do not commit secrets);
- exact region;
- endpoint name and ARN;
- endpoint configuration;
- container image digest, not mutable tag alone;
- exact frozen checker model/revision;
- checker manifest SHA-256 `96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918`;
- data capture disabled;
- container logging contract verified;
- IAM invocation policy restricted to the exact endpoint.

The endpoint response must continue to echo/attest the frozen model/revision/manifest values already required by the Worker-side supportCheck client. Any mismatch fails closed.

## Network statement

This direct route uses the public SageMaker Runtime service endpoint over TLS with SigV4 authentication. It must **not** be described as PrivateLink or private-VPC transport.

If policy later requires private network transport rather than authenticated TLS to an account-scoped AWS service endpoint, the architecture must change to an AWS-side ingress path that can reach SageMaker through the VPC/PrivateLink boundary; that would require separate review.

## Account-specific privacy PASS evidence

The checker-specific privacy gate may become `PASS` only after the exact deployed candidate supplies evidence that:

1. the endpoint belongs to the intended LibEdge AWS account and region;
2. Data Capture is disabled;
3. no endpoint/container/proxy/application log records request/response content;
4. the container image digest and frozen checker identity are verified;
5. the Worker IAM principal can invoke only the exact endpoint;
6. credentials are environment-only and revocable/rotatable;
7. no unsupported optional SageMaker feature introduces content persistence;
8. a content-free test invocation verifies expected identity attestation and failure behavior.

Until then:

`RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS=UNVERIFIED`

and supportCheck remains disabled.

## Staging sequence after PASS

Only after account-specific PASS:

1. configure staging endpoint name/region and secret credentials;
2. keep the checker feature flag OFF;
3. perform a content-free health/identity probe;
4. enable only for the authorized English staging path;
5. exercise the D-023 operational-pause/kill-switch drill;
6. run authenticated staging E2E with approved non-user-derived test inputs;
7. turn the feature flag back OFF unless a separate staging continuation decision says otherwise;
8. record latency/reliability/cost evidence for Product Readiness.

## Non-goals

This record does not:

- deploy a SageMaker endpoint;
- grant privacy PASS;
- enable supportCheck;
- send real-user content;
- authorize production;
- claim PrivateLink for the direct Cloudflare route;
- change the frozen checker or D-023 language/drift decisions.
