# P0.5 Production Observability — Metadata Minimization Design

Status: `REVIEW REQUIRED / DO NOT DEPLOY`

Date: 2026-09-14

## Purpose

Reduce production Workers Logs collection for Track A from Cloudflare's enriched automatic invocation record to a single LibEdge-defined structured research-request log containing only the fields needed for timing/rate/capacity analysis.

This document is design + staging-code evidence only. It does not authorize production deployment, a new privacy probe, or the 168-hour observation window.

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

## Production configuration candidate

The production candidate keeps observability enabled and query-string redaction enabled, but disables automatic invocation logs:

```toml
[env.production.observability]
enabled = true
head_sampling_rate = 1.0
redact_query_string = true

[env.production.observability.logs]
invocation_logs = false
```

No staging/local observability behavior is changed by this PR.

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

## Static verification in this PR

`test/backend/research-observability.test.js` locks the LibEdge-produced object shape and checks:

1. the object has exactly five reviewed keys;
2. no forbidden request/user/provider field names appear in the serialized payload;
3. status is coarsened to the hundred-class;
4. time is bucketed to minute resolution;
5. duration is clamped non-negative.

This proves the **application payload** is minimal. It does not prove the final persisted Cloudflare record contains no platform-added envelope.

## Persisted-schema verification still required

Cloudflare documentation establishes that invocation logs can be disabled and that custom logs remain supported. The reviewed public documentation does not provide a sufficiently strong guarantee that a persisted custom log record will contain *only* the five application fields with no Cloudflare-added `$metadata` or other envelope fields.

Therefore production privacy clearance remains fail-closed until a separately authorized deployment verifies the actual persisted custom-log record.

The post-deploy verification must establish all of the following before the 168-hour observation window can start:

1. no `cf-worker-event` invocation log is persisted for the probe request;
2. one `research_request_observed` custom record is persisted;
3. the application payload contains only the five reviewed fields;
4. any Cloudflare platform envelope around the custom record is inventoried field-by-field;
5. no IP, geo, ASN/organization, TLS, request header, cookie/auth, query, body, user, provider/model, or research-content field is persisted anywhere in that record;
6. if extra platform fields remain, they require independent reviewer disposition before observation begins.

## Decision boundary

This PR may change staging code/config after review, but does **not** authorize:

- production deployment;
- rerunning the prior privacy probe;
- starting the 168-hour observation window;
- semantic-primary enablement;
- D-016 activation;
- provider/model selection or use;
- migrations or data mutations.

A fresh execution-authorization review is required before production deployment of this metadata-minimization design.
