# P0.5 Production Observability — Metadata Minimization Design

Status: `PASS WITH RESIDUAL PLATFORM METADATA — ACCEPTED / OBSERVATION WINDOW AUTHORIZATION PENDING REVIEW`

Date: 2026-09-14

## Purpose

Reduce production Workers Logs collection for Track A from Cloudflare's enriched automatic invocation record to a single LibEdge-defined structured research-request log containing only the fields needed for timing/rate/capacity analysis.

This document began as design + staging-code evidence. It now also records the production persisted-schema verification performed on 2026-09-14. It does not itself start the 168-hour observation window.

## Cloudflare behavior used by this design

Cloudflare Workers Logs documentation distinguishes two log types relevant here:

- **Invocation logs**: one automatic record per Worker invocation containing request, response, and related metadata. Cloudflare states that invocation logs are enriched with information available in the invocation context.
- **Custom logs**: application-emitted `console.log()` records. Structured JSON objects are indexed as structured fields.

Cloudflare documents the Wrangler control:

```toml
[observability.logs]
invocation_logs = false
```

as the way to disable automatic invocation logs while Workers Logs remains enabled.

Primary reference:

- https://developers.cloudflare.com/workers/observability/logs/workers-logs/

## Production configuration

The reviewed production configuration keeps observability enabled and query-string redaction enabled, but disables automatic invocation logs:

```toml
[env.production.observability]
enabled = true
head_sampling_rate = 1.0
redact_query_string = true

[env.production.observability.logs]
invocation_logs = false
```

## Minimal custom research log contract

For `/api/research/search`, production code emits exactly one structured object after request handling completes:

```js
{
  event: 'research_request_observed',
  timestamp_bucket: <minute bucket>,
  path_class: 'research_search',
  status_class: '2xx' | '3xx' | '4xx' | '5xx' | 'other',
  duration_ms: <non-negative integer-like duration>
}
```

The implementation uses a route-scoped Hono middleware so early responses such as `401`, `400`, and `429` are also observed. The middleware emits only when `ENVIRONMENT === 'production'`.

### Explicit exclusions

The custom payload must never include or derive fields from:

- user ID, email, session or quota identity;
- IP address;
- `request.cf` geolocation, ASN, organization, TLS, network, bot, or transport fields;
- request headers;
- Authorization or Cookie values;
- URL, raw path, query string, query parameters, or research query text;
- request or response bodies;
- provider/model data;
- evidence content or source text.

`path_class` is a fixed classification string, not the request path. `status_class` is only the hundred-class, not the exact response status. `timestamp_bucket` is minute-resolution (`Math.floor(ms / 60000)`), not an exact event timestamp.

## Static verification

`test/backend/research-observability.test.js` locks the LibEdge-produced object shape and checks:

1. the object has exactly five reviewed keys;
2. no forbidden request/user/provider field names appear in the serialized payload;
3. status is coarsened to the hundred-class;
4. time is bucketed to minute resolution;
5. duration is clamped non-negative.

This proves the **application payload** is minimal. It does not by itself prove the final persisted Cloudflare record contains no platform-added envelope.

## Production persisted-schema verification — 2026-09-14

A separately authorized production deployment and single synthetic 401 probe verified the minimized logging configuration. A subsequent read-only inspection workflow re-queried the already-persisted custom-log event without generating any new Worker request or probe.

### Version attribution

The persisted custom-log record reported:

- `$workers.scriptVersion.id = 01747aaa-b957-44bc-95a5-7176031debfc`

This exactly matches the version ID produced by the minimized-logging production deployment that preceded the probe.

**Conclusion:** the inspected persisted record is attributable to the new minimized-logging deployment. The prior version-attribution uncertainty is closed for this verification event.

### Application payload result

The persisted LibEdge-defined `source` payload contained exactly the reviewed five fields:

- `event`
- `path_class`
- `status_class`
- `timestamp_bucket`
- `duration_ms`

No user ID, IP, `cf.*` enrichment, headers, Cookie/Authorization values, query string, research query text, request/response body, provider/model content, evidence content, or source text appeared in the application payload.

### Residual Cloudflare platform envelope

The full persisted record also contained Cloudflare platform metadata. The only paths identified by the privacy-sensitive path scan were:

- `$workers.event.request`
- `$workers.event.request.method`
- `$workers.event.request.url`
- `$workers.event.request.path`

The full inspection inventory did **not** show IP address, geolocation, latitude/longitude, postal code, ASN/organization, TLS fingerprint/handshake data, User-Agent, request headers, Cookie/Authorization values, request body, response body, or research query text.

The platform envelope also contains operational correlation identifiers and service metadata, including `requestId`, `rayId`, `traceId`, `spanId`, script/service identifiers, account identifier, event type, execution model, dataset, origin, and timestamp.

## Residual-risk disposition

Classification:

`PASS WITH RESIDUAL PLATFORM METADATA — ACCEPTED`

This is a deliberate residual-risk acceptance, not a claim of zero metadata persistence.

### Endpoint-specific scope of the acceptance

The acceptance of `method` / `path` / redacted `url` is **specific to `/api/research/search`**.

For this endpoint:

- the method is not user-controlled content;
- the path is a fixed backend route and contains no user-supplied path segment;
- `redact_query_string = true` removes the variable query-string component from the persisted URL;
- therefore these residual request-context fields do not carry the user's research query or other request content in the reviewed route.

This conclusion must **not** be generalized to every LibEdge endpoint. A future endpoint whose path itself contains user-controlled or sensitive identifiers (for example, a parameterized resource path) requires its own metadata review before the same acceptance can be inherited.

### Operational-ID correlation risk

`requestId`, `rayId`, `traceId`, and `spanId` do not themselves contain research content in the inspected record. They can, however, act as correlation keys if the same identifiers are retained in another data source that contains richer contextual information.

That creates a **low, non-zero correlation risk**. The risk is accepted for the present Track A observability purpose because:

- the inspected Workers Logs record itself contains no user research content or rich client/network metadata;
- the identifiers are operational telemetry identifiers rather than application identity fields;
- no evidence in this review shows a retained LibEdge-side record that maps these identifiers to research-query content.

This acceptance should be reconsidered if another logging/analytics system begins retaining the same correlation identifiers alongside user, query, request-body, or other sensitive context.

## `persist:false` / OTEL disposition

Cloudflare documents an OpenTelemetry-export path that can be configured with `persist: false` to avoid storing logs/traces in Cloudflare. That remains a technically valid stronger-minimization option.

It is **not adopted for the current Track A design** because the verified residual Cloudflare metadata is limited and does not contain research content, client geo/network enrichment, headers, cookies/auth values, or bodies, while an OTEL export would introduce additional infrastructure and potentially another data processor/destination that would itself require review.

This is a **reversible decision**, not a permanent prohibition. Re-open the `persist:false` / OTEL option if any of the following occurs:

- a future B2C deployment or privacy policy imposes a stricter metadata-minimization standard;
- Cloudflare expands the persisted custom-log envelope to include richer client/request metadata;
- a future endpoint has user-controlled path content;
- operational correlation IDs become linkable to richer retained LibEdge logs;
- legal/security review requires Cloudflare-side log persistence to be eliminated.

## Observation-window gate

The metadata-minimization design and persisted-schema verification are now classified as:

`PASS WITH RESIDUAL PLATFORM METADATA — ACCEPTED`

The **168-hour observation window has not started by this documentation change alone**.

Starting the observation window requires explicit reviewer approval after reviewing this residual-risk disposition and confirming that the production logging state remains the reviewed minimized configuration.

## Decision boundary

This documentation update does **not**:

- deploy or mutate production;
- send a new Worker request or privacy probe;
- start the 168-hour observation window;
- enable semantic-primary;
- activate D-016;
- select or activate a provider/model;
- authorize migrations or data mutations;
- adopt an OTEL destination or new subprocessor.
