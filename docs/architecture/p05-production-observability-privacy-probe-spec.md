# P0.5 Production Retrieval — Production Observability Privacy Probe Specification

Status: `PROPOSED / SEPARATE REVIEW REQUIRED / NOT EXECUTED`

Date: 2026-09-12

## Purpose

Lock the exact synthetic privacy-probe shape that must be independently accepted **before** any production observability execution authorization is requested.

This probe exists only to verify the effective Cloudflare Workers Logs privacy surface after the separately reviewed observability configuration is deployed.

This document does **not** authorize deployment or probe execution.

## Why this probe shape is intentionally non-authenticating

The privacy check must test whether Cloudflare invocation logs expose:

- URL query-string content;
- `Authorization` header content;
- `Cookie` header content;
- unexpected request metadata fields.

Using a real authenticated research request would unnecessarily expose a real credential/session to the probe itself and could execute application research behavior or telemetry writes.

The preferred probe therefore uses a synthetic **CORS preflight `OPTIONS` request** to the real research endpoint path. The repository's top-level CORS middleware handles `OPTIONS` and permits `OPTIONS` in its configured method list, so this shape is intended to exercise the same production Worker/request-log surface without invoking the research handler's normal GET behavior.

## Exact production endpoint

Proposed exact URL:

`https://www.libedge.com/api/research/search?q=LIBEDGE_OBS_Q_20260912_A1`

Before execution authorization, the reviewer/human gatekeeper must confirm that this exact public production route currently reaches the intended production Worker:

`libedge-api-prod`

If that mapping cannot be independently confirmed, this probe specification is **not executable**. Do not silently substitute another hostname; return to review with the effective production URL/route.

## Exact HTTP request shape

Method:

`OPTIONS`

Path:

`/api/research/search`

Exact query string:

`q=LIBEDGE_OBS_Q_20260912_A1`

Exact request headers:

```text
Origin: https://www.libedge.com
Access-Control-Request-Method: GET
Access-Control-Request-Headers: authorization
Authorization: Bearer LIBEDGE_OBS_AUTH_20260912_A1
Cookie: obs_probe=LIBEDGE_OBS_COOKIE_20260912_A1
```

Request body:

`NONE`

No real access token, JWT, refresh token, session cookie, user ID, email, research topic, DOI/title, or customer data may be used.

The three sentinel values are deliberately non-secret and unique:

- query sentinel: `LIBEDGE_OBS_Q_20260912_A1`
- authorization sentinel: `LIBEDGE_OBS_AUTH_20260912_A1`
- cookie sentinel: `LIBEDGE_OBS_COOKIE_20260912_A1`

Any change to these values or the request shape requires fresh probe-spec review.

## Expected application response

Expected response status:

`204 No Content`

The response body should be empty because the request is a CORS preflight rather than a research execution.

A materially different response means the probe did not exercise the reviewed path as expected. Treat that as:

`STOP — PROBE SHAPE/ROUTING NOT CONFIRMED`

Do not automatically retry with a modified request.

## Expected application-side effects

The probe must not:

- authenticate a real user;
- execute a real research search;
- create a research result;
- mutate customer-visible application state;
- invoke semantic-primary;
- change D1 schema or application records;
- write R2/KV/DO state intentionally;
- carry a real secret or credential.

The unavoidable side effect is the invocation/observability record created by the separately reviewed Workers Logs configuration.

If execution evidence suggests that the research GET handler or another mutating application path ran, STOP and return to review.

## Exact invocation-log verification

After the single probe invocation, inspect the matching invocation record before any capacity observation window begins.

### A. Required visible classification data

The log must preserve enough non-sensitive information to establish that the path was:

`/api/research/search`

The query value is not needed for classification and must not be visible.

### B. Exact sentinel non-disclosure checks

Search the **entire invocation record**, not only the obvious URL/header fields, for each exact sentinel.

The following strings must have zero occurrences:

```text
LIBEDGE_OBS_Q_20260912_A1
LIBEDGE_OBS_AUTH_20260912_A1
LIBEDGE_OBS_COOKIE_20260912_A1
```

Also verify that the raw query representation is not present as:

```text
q=LIBEDGE_OBS_Q_20260912_A1
```

Any occurrence anywhere in the inspected record is a hard STOP.

### C. Request-body check

The record must contain no request body because the probe sends no body.

Any unexpected body/payload field containing request content is a hard STOP pending review.

### D. Open-ended full-field inventory

Enumerate the complete observed field/key tree for the matching invocation record, including nested request, response, network, trace, and metadata objects if present.

For every observed field/key, record:

- field/key name;
- example value shape with sensitive values redacted as necessary;
- classification: `EXPECTED/NEEDED`, `OPERATIONAL/NONESSENTIAL`, or `UNEXPECTED/REVIEW REQUIRED`;
- privacy note.

The inventory must explicitly consider, if present:

- full/raw URL variants;
- query/query-string fields;
- headers or header collections;
- `Referer`;
- `User-Agent`;
- client IP/network/geolocation metadata;
- cookies;
- authorization metadata;
- request/response body fields;
- tracing/span/request identifiers;
- account/zone/route metadata;
- platform-added custom fields.

A field that is sensitive or not sufficiently understood is not silently accepted. Classify:

`STOP — UNEXPECTED LOG FIELD REQUIRES REVIEW`

### E. Timestamp/completeness check

The matching invocation record must expose a timestamp precise enough for per-request or <=2-second counting.

The effective production observability state must independently show:

- `head_sampling_rate = 1.0`;
- query-string redaction enabled.

The probe itself does not establish observation-window representativeness; it only verifies the log surface.

## Single-execution rule

Exactly one probe invocation may be executed after separate production observability deployment authorization and successful structural post-deploy checks.

No automatic retry is authorized.

If the probe fails, differs from this specification, or cannot be matched to a single invocation log record, STOP and return to independent review.

## Evidence required

The probe evidence packet must include:

- execution authorization reference;
- confirmation that `https://www.libedge.com/api/research/search` routes to `libedge-api-prod` at execution time;
- exact request command or equivalent request representation;
- exact UTC execution timestamp;
- response status and headers sufficient to confirm CORS preflight behavior;
- matching invocation-record timestamp/identifier;
- proof of zero occurrences for all three exact sentinels;
- proof that `/api/research/search` remains classifiable;
- complete field/key inventory and classifications;
- timestamp-resolution result;
- effective `head_sampling_rate` and query-redaction state;
- explicit statement that no real credentials or user/customer data were used;
- PASS/STOP classification.

## PASS criterion

Classify the privacy probe as PASS only if all of the following are true:

1. exact reviewed request shape was used once;
2. production route maps to `libedge-api-prod`;
3. expected CORS preflight response is observed;
4. `/api/research/search` remains visible/classifiable;
5. all three sentinel values are absent everywhere in the invocation record;
6. no request body or prohibited application content is logged;
7. open-ended full-field inventory contains no unresolved sensitive/unexpected field;
8. timestamp precision is sufficient;
9. effective sampling remains exactly `1.0`;
10. production semantic-primary remains `false`.

Otherwise:

`PRIVACY PROBE STOP — TRACK A REMAINS BLOCKED`

## Decision boundary

Acceptance of this probe specification would only lock the probe shape for a later production observability execution-authorization review.

It would **not** authorize:

- the production observability deployment;
- the probe execution itself;
- a capacity observation window;
- production D1 migration;
- production semantic-primary;
- D-016 broad enablement;
- H/RRF or Vectorize.

## Reviewer questions

The independent reviewer should determine:

1. whether `OPTIONS /api/research/search` is sufficiently non-mutating while still exercising the relevant Worker log surface;
2. whether the exact production hostname/path must be changed before acceptance;
3. whether the three synthetic sentinels are appropriate and non-sensitive;
4. whether expected `204 No Content` is the correct response criterion for the repository's CORS middleware;
5. whether the full-record sentinel search is strong enough;
6. whether the open-ended full-field inventory is sufficient;
7. whether any additional field or response check is required;
8. whether this probe specification can be accepted as the mandatory prerequisite for the later production execution-authorization review.
