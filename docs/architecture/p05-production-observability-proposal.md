# P0.5 Production Retrieval — Privacy-Safe Capacity Observability Proposal

Status: `ACCEPTED WITH MODIFICATION / EXECUTION PLAN REQUIRED / NOT DEPLOYED`

Date: 2026-09-12

## Purpose

Prepare the minimum production observability change needed to collect valid evidence for the locked D-016 broad-enablement guardrail:

`peak eligible research-query rate <= 0.5 requests/second`

This document is a proposal only. It changes no production configuration, does not enable production semantic-primary, and does not authorize deployment.

## Why a new source is required

The accepted Track A discovery established that:

- existing D1 research telemetry is daily aggregate data and cannot establish <=2-second peak rate;
- no repository-proven Analytics Engine source exists;
- production Workers Observability is currently disabled by direct human dashboard observation.

Therefore Track A remains:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

A new observation window must be created before the locked capacity guardrail can be evaluated.

## Important privacy finding

The eligible research endpoint receives the research query in the URL query string (for example, `/api/research/search?q=...`). Cloudflare invocation logs contain request URL metadata.

Therefore enabling Workers Logs without query-string redaction would risk persisting research query text and would violate the already-locked Track A privacy boundary.

Any approved Workers Logs configuration for this purpose MUST explicitly enable query-string redaction. It is not sufficient to rely on an assumed/default dashboard state.

The independent review also identified a second mandatory privacy verification: effective invocation logs must be checked to confirm that `Authorization` and `Cookie` header values are not exposed in clear text. A promise not to add custom application logging is not sufficient to establish this platform-level property.

## Proposed evidence source

Use Cloudflare Workers Logs for the production Worker `libedge-api-prod`, limited to a separately approved observation window, with all of the following properties independently verified after deployment:

1. observability/logging enabled for production;
2. invocation logs available through the enabled Workers observability surface;
3. effective log `head_sampling_rate = 1.0`;
4. query strings redacted from request URLs/logs (`redact_query_string = true` or the effective Cloudflare equivalent);
5. no new custom logging of query text, normalized query, user identity, research interests, result content, DOI/title, request bodies, or authorization/cookie material;
6. effective invocation logs do not expose `Authorization` or `Cookie` header values in clear text;
7. timestamps precise enough to support per-request or <=2-second counting;
8. the eligible endpoint can be isolated using the redacted path, without needing the query-string value.

The production semantic-primary flag must remain `false` before, during, and after this observation change.

## Reviewed repository configuration shape

The independent review corrected the proposed Wrangler shape. The production-only configuration to be used as the basis of the separate execution plan is:

```toml
[env.production.observability]
enabled = true
head_sampling_rate = 1.0
redact_query_string = true
```

The prior nested `[env.production.observability.logs]` proposal and separate `invocation_logs` key are not part of the approved shape. The execution plan must still verify this syntax against the repository's active Wrangler version immediately before any production deployment.

No staging/default observability change is required by this proposal.

No configuration change should be committed or deployed merely because this document exists.

## Pre-deployment gates

Before any production configuration change, a fresh reviewer must verify:

1. production semantic-primary is still `false`;
2. the target Worker is exactly `libedge-api-prod` / production environment;
3. current production observability state is recorded before change;
4. the flat `[env.production.observability]` syntax and all three intended keys are supported by the repository's installed Wrangler version;
5. configuration is scoped only to `env.production`;
6. `head_sampling_rate` is explicitly `1.0`, not inferred from a default;
7. query-string redaction is explicitly enabled;
8. no traces, Logpush destination, third-party export, or custom request logging is bundled unless separately reviewed;
9. no D1 migration, semantic enablement, retrieval change, or unrelated production change is bundled;
10. the post-deployment privacy probe is prepared to check both query-string redaction and absence of clear-text `Authorization`/`Cookie` header values;
11. rollback is simply restoration of the previously recorded observability configuration if the deployment itself causes an operational problem.

Any mismatch is a hard STOP.

## Post-deployment verification gates

After a separately authorized deployment, verify before using any collected data:

1. production Worker identity/environment is correct;
2. observability/logging is actually enabled in effective Cloudflare account state;
3. effective `head_sampling_rate = 1.0`;
4. effective query-string redaction is enabled;
5. a research invocation log exposes only the endpoint/path needed for classification and does not expose the `q` value;
6. the inspected invocation-log representation does not expose `Authorization` or `Cookie` header values in clear text;
7. timestamps are available at per-request resolution;
8. production semantic-primary remains `false`;
9. no evidence of unintended request-body, query, identity, credential, or other sensitive request-material logging appears.

If completeness or privacy cannot be proven, classify:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

## Observation-window evidence method

After post-deployment verification passes, collect a defined production observation window. The final evidence record must state:

- exact UTC start/end;
- effective production Worker/environment;
- effective sampling state (`1.0`);
- query-string redaction state;
- authorization/cookie exposure check result;
- eligible endpoint definition;
- total eligible requests;
- per-request timestamps or <=2-second bucket counts;
- maximum observed eligible-request rate and calculation;
- any gaps or ingestion failures;
- privacy confirmation;
- conclusion against `<=0.5 requests/second`.

For a 2-second bucket, the locked guardrail implies no more than one eligible request in any such bucket. Per-request timestamps are preferred because they preserve exact burst timing.

The observation window duration itself must be proposed/reviewed separately or explicitly accepted by the reviewer; this document does not invent a duration and does not claim that a short quiet window represents normal production demand.

## No silent extrapolation

The following are not sufficient:

- staging traffic;
- synthetic test traffic;
- daily/minute averages;
- sampled logs;
- a short quiet production period treated as proof of long-term traffic behavior without review;
- estimating omitted requests from a sampling percentage;
- using query-string values to identify eligible requests.

## Cost / retention note

100% invocation logging may have usage/retention implications. The deployment review must confirm that the proposed observation window and expected production volume are acceptable for the account plan. Cost concerns must not be solved by lowering sampling below `1.0` while still claiming the locked peak-rate guardrail is proven.

## Decision boundary

The independent proposal review classified this design `ACCEPTED WITH MODIFICATION`. The two required modifications — flat production observability syntax and explicit Authorization/Cookie exposure verification — are incorporated in this document.

This acceptance authorizes only preparation of a separate production observability execution plan and its own review.

It does NOT authorize:

- deploying the configuration without a fresh execution review;
- production semantic-primary;
- broad semantic rollout;
- production D1 migrations;
- D-016 Track B;
- H/RRF or Vectorize changes;
- weakening privacy, pacing, fallback, or capacity gates.

## Next review

The next artifact must be a separate production observability execution plan. It must lock the exact proposed configuration change, pre/post verification commands or observations, privacy probes, rollback, evidence capture, STOP conditions, and the observation-window handling without silently authorizing semantic rollout.