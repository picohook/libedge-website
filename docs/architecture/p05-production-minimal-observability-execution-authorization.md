# P0.5 Production Minimal Observability — Execution Authorization Candidate

Status: `REVIEW REQUIRED / DO NOT EXECUTE`

Date: 2026-09-14

## Purpose

Authorize, only after independent reviewer acceptance, one production execution that deploys the already-reviewed metadata-minimization change from PR #77 and verifies the persisted schema of exactly one custom research observability log.

This document does not authorize execution by itself.

## Reviewed baseline

The reviewed application/configuration baseline is the PR #77 merge commit:

`412e94a2591148ec32be9aeb81fc27008c30c6f9`

That baseline already contains:

- `[env.production.observability.logs] invocation_logs = false`;
- the production-only `research_request_observed` custom log;
- the exact five-field application payload contract;
- unit tests for exact payload shape and forbidden-content absence;
- the explicit requirement that Cloudflare's persisted custom-log envelope be independently inspected before the 168-hour observation window begins.

## Exact workflow

Execution candidate:

`.github/workflows/production-minimal-observability-verify.yml`

The workflow performs only:

1. reviewed execution-unit guard;
2. targeted unit test for the minimized payload;
3. production Worker deploy from guarded `staging`;
4. a 10-second propagation wait before the one-shot probe;
5. effective settings read-back, including `invocation_logs=false`;
6. exactly one unauthenticated 401 probe to `/api/research/search`;
7. persisted `research_request_observed` custom-log query and schema/envelope inspection.

The 10-second wait is included because the prior execution demonstrated that a probe issued immediately after deploy could still execute against the preceding Worker version. It does not repeat or multiply the probe.

## Human confirmation gate

Manual dispatch requires the exact string:

`PRODUCTION-MINIMAL-LOG-VERIFY-ONE-SHOT`

The job targets the protected GitHub Environment:

`production`

No run is authorized until the complete YAML has been independently reviewed.

## Repository-state guard

`EXPECTED_BASE_SHA` is fixed to the accepted PR #77 merge commit:

`412e94a2591148ec32be9aeb81fc27008c30c6f9`

After that baseline, the execution workflow allows only:

- `.github/workflows/production-minimal-observability-verify.yml`
- `docs/architecture/p05-production-minimal-observability-execution-authorization.md`

Any other staging change is a hard STOP requiring fresh review.

The guard also directly verifies that staging still contains:

- the production observability logs block;
- `invocation_logs = false`;
- `redact_query_string = true`;
- `RESEARCH_SEMANTIC_PRIMARY_ENABLED = "false"`;
- the `research_request_observed` application event.

## Credential split

The workflow retains the already-reviewed minimum-privilege separation:

- `CLOUDFLARE_API_TOKEN`: deploy + Worker settings read;
- `CLOUDFLARE_OBSERVABILITY_TOKEN`: Workers Observability telemetry query only;
- `CLOUDFLARE_ACCOUNT_ID`: account targeting.

No JWT secret is used.

## One-shot probe

The single request is intentionally unauthenticated and expected to return HTTP 401. It contains synthetic query, Authorization, and Cookie sentinels solely to verify that those values do not appear in the persisted custom-log record.

The request count must remain exactly one. Telemetry polling does not repeat the request.

## Persisted custom-log verification

The workflow searches for `research_request_observed`, then requires exactly one matching custom-log payload in the probe window with:

- `event = research_request_observed`;
- `path_class = research_search`;
- `status_class = 4xx`;
- integer `timestamp_bucket`;
- non-negative integer `duration_ms`.

The application payload must contain exactly five keys:

- `event`
- `timestamp_bucket`
- `path_class`
- `status_class`
- `duration_ms`

The workflow then verifies the complete persisted event rather than assuming the application object is the whole record.

It hard-stops if:

- any query/Auth/Cookie sentinel or `invalid-probe-token` is present anywhere in the persisted event;
- the exact five-field application payload is not found exactly once;
- the persisted platform envelope exposes request/response/header/cookie/auth/query/body/cf/geo/latitude/longitude/postal/ASN/TLS/client-IP/User-Agent style fields.

It emits:

- `CUSTOM_LOG_FULL_FIELD_INVENTORY_BEGIN/END`;
- `REDACTED_CUSTOM_LOG_SAMPLE_BEGIN/END`;
- `MINIMAL_LOG_SCHEMA_RESULT=PASS_PENDING_INDEPENDENT_REVIEW`.

The marker is not self-approval. Independent review of the complete inventory and redacted sample remains mandatory.

## Observation window

The 168-hour observation window remains **NOT STARTED** by this execution.

It may begin only after the persisted custom-log schema receives independent privacy acceptance. The prior seven-day/168-valid-hour decision remains otherwise unchanged.

## Decision boundary

This candidate does not authorize:

- semantic-primary enablement;
- D-016 activation;
- provider/model usage;
- migrations or data-store mutations;
- more than one production probe;
- automatic observation-window start;
- final capacity/adoption conclusions.

## Reviewer questions

1. Is the PR #77 merge commit an appropriate fixed execution baseline?
2. Is the 10-second post-deploy propagation wait appropriate to avoid the prior version-attribution ambiguity without creating a retry?
3. Does the workflow verify effective `invocation_logs=false` before sending the one-shot probe?
4. Is the custom-log candidate selection sufficiently narrow and fail-closed?
5. Is exact five-field payload verification sufficient at the application layer?
6. Is the platform-envelope privacy-sensitive path scan appropriately strict?
7. Are the full field inventory and redacted sample sufficient for independent persisted-schema review?
8. Is it correct to keep the 168-hour window stopped until that review is completed?
9. Is this workflow safe to expose on `main` only after this staging PR is accepted?
