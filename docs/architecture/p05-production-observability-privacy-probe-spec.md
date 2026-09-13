# P0.5 Production Retrieval — Production Observability Privacy Probe Specification

Status: `ACCEPTED WITH MODIFICATION / EXECUTION-AUTHORIZATION DETAIL REQUIRED / NOT EXECUTED`

Date: 2026-09-13

## Purpose

Lock the exact authenticated synthetic privacy-probe shape that must be independently accepted **before** any production observability execution authorization.

This probe exists only to verify the effective Cloudflare Workers Logs privacy surface after the separately reviewed observability configuration is deployed.

This document does **not** authorize deployment or probe execution.

## Exact production target

Worker identity:

`libedge-api-prod`

Direct production Worker URL, confirmed from the repository's production Pages proxy mapping:

`https://libedge-api-prod.agursel.workers.dev`

Exact path:

`/api/research/search`

Exact method:

`GET`

The Worker is called directly, rather than through Pages, so the inspected invocation record corresponds to the production Worker whose observability is being enabled.

## Exact query-string sentinel

The query is deliberately invalid by length so authentication succeeds but request handling stops at the existing 2–300 character query-validation boundary before rate limiting, research telemetry, provider retrieval, or research-cache writes.

Exact `q` value: 301 characters.

```text
LIBEDGE_OBS_QS_20260913_A7F3_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Exact request URL:

```text
https://libedge-api-prod.agursel.workers.dev/api/research/search?q=LIBEDGE_OBS_QS_20260913_A7F3_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Synthetic authentication

The probe must be authenticated, but must not use a real user account or a persistent real-user session.

Immediately before the single request, generate a short-lived HS256 JWT using the existing production `JWT_SECRET` with this synthetic payload shape:

```json
{
  "sub": "libedge-observability-probe",
  "role": "probe",
  "exp": "NOW_PLUS_120_SECONDS"
}
```

Requirements:

- `exp` is exactly 120 seconds after issuance;
- payload contains no email, real user ID, institution ID, name, research topic, DOI/title, or other customer/personal data;
- token is used once for this probe only;
- token is never committed or included in reviewer-visible evidence;
- evidence inspection/reporting occurs only after the token has expired.

The token is sent as the `authToken` cookie. Current `requireAuth()` uses a Bearer token only when the `Authorization` header begins with `Bearer `; otherwise it falls back to the `authToken` cookie.

### Execution-authorization requirement: JWT secret handling

The production `JWT_SECRET` must never be printed, copied into reviewer-visible evidence, pasted into a shell transcript, or exposed to the probe operator as plain text merely to construct the token.

The later execution-authorization artifact must lock the exact secure token-generation mechanism. The preferred mechanism is a production-scoped GitHub Actions job (or equivalently controlled production execution surface) in which:

- `JWT_SECRET` is injected from the existing protected production secret store;
- token generation occurs in-process inside the protected runner/job;
- the secret itself is never echoed or persisted;
- the generated JWT is masked from workflow logs and is used only for the single authorized request;
- the JWT is not uploaded as an artifact and is not copied into the reviewer packet;
- evidence collection begins only after the 120-second token has expired.

If the chosen execution mechanism would require a human to retrieve or handle the raw production `JWT_SECRET`, execution authorization must STOP and return to review. This probe specification does not authorize direct human secret extraction.

## Exact request headers

The single request must contain exactly these privacy-relevant headers in addition to ordinary transport headers added by the client/platform:

```text
Authorization: LibEdgeProbe LIBEDGE_OBS_AUTHZ_20260913_A7F3
Cookie: authToken=<EPHEMERAL_120_SECOND_SYNTHETIC_JWT>; libedge_probe=LIBEDGE_OBS_COOKIE_20260913_A7F3
User-Agent: LibEdge-Observability-Probe/2026-09-13
Accept: application/json
```

`Authorization: LibEdgeProbe ...` is intentionally non-Bearer. Under the current middleware it is ignored for authentication and the valid short-lived cookie JWT is used instead. This lets the same authenticated invocation carry a non-secret Authorization sentinel.

`libedge_probe` is a non-secret synthetic cookie sentinel used only for the log privacy check.

## Request body

No request body is sent.

The method is `GET`; do not attach a body or `Content-Type` header.

## Expected application response

Expected status:

`400 Bad Request`

Expected JSON code:

`RESEARCH_QUERY_INVALID`

A `401` means synthetic authentication failed and is a hard STOP. Do not silently retry with a different token/request shape.

A response that reaches provider/retrieval behavior instead of the query-validation error is also a hard STOP.

## Why the 301-character invalid query is intentional

The current research route performs:

1. `requireAuth()`;
2. query normalization/validation;
3. only after valid query: protected rate-limit, telemetry, and discovery/provider logic.

Therefore a 301-character synthetic query:

- proves the request is authenticated;
- exercises the exact `/api/research/search?q=...` query-string privacy risk;
- stops before OpenAlex/Crossref;
- stops before research cache writes;
- stops before research request telemetry;
- creates no customer-visible application state;
- contains no real research interest or user data.

## Exact execution count

Execute this exact request once.

No automatic retry is authorized. Any failed setup/authentication/routing attempt requires return to review before another production probe.

## Mandatory post-probe log verification

Locate the single invocation record by UTC timestamp, Worker identity, method, path, and expected 400 response. Inspect the **complete available invocation record**, not only the obvious request URL field.

### A. Path/classification check

The path needed for later Track A classification must remain visible:

`/api/research/search`

The query value is not needed and must not be visible.

### B. Exact sentinel non-disclosure checks

The following strings must have zero occurrences anywhere in the complete invocation record:

```text
LIBEDGE_OBS_QS_20260913_A7F3_
LIBEDGE_OBS_AUTHZ_20260913_A7F3
LIBEDGE_OBS_COOKIE_20260913_A7F3
```

Also verify that no raw `q=` representation or URL variant contains the 301-character query.

### C. Credential/header checks

All must pass:

1. no clear-text Authorization sentinel/value appears;
2. no clear-text cookie sentinel/value appears;
3. the ephemeral `authToken` JWT is not exposed in clear text;
4. no decoded JWT payload value (`libedge-observability-probe` or role `probe`) is surfaced due to header/cookie decoding or platform enrichment.

Reviewer-visible evidence must state only PASS/FAIL for the ephemeral JWT exposure check; it must never reproduce the JWT.

### D. Request-body check

The probe sends no body. Verify that no request body/content field is persisted.

A size/absence indicator is acceptable; stored raw request content is not.

### E. Open-ended full-field inventory — mandatory

Enumerate every top-level and nested key/field available in at least one complete matching invocation record.

For each field record:

- field/key name;
- redacted example value shape where useful;
- classification: `EXPECTED / NEEDED`, `OPERATIONAL / NONESSENTIAL`, or `UNEXPECTED / REQUIRES REVIEW`;
- privacy note.

Explicitly inspect, where present:

- full/raw URL variants;
- query/query-string fields;
- method/path/host;
- request and response headers or header-derived fields;
- cookies/cookie-derived fields;
- `Referer`;
- `User-Agent`;
- client IP/network/geolocation metadata;
- status code;
- request/response sizes;
- timestamps/durations;
- trace/request/ray identifiers;
- Worker/script/environment/account/zone/route metadata;
- exception/log-message fields;
- body/body-size/body-derived fields;
- any platform-added metadata not anticipated above.

A sensitive or insufficiently understood unexpected field is a hard STOP pending independent review.

### F. Timestamp/completeness check

The matching invocation record must expose timestamp precision sufficient for per-request or <=2-second counting.

Effective production state must independently confirm:

- observability enabled;
- `head_sampling_rate = 1.0`;
- query-string redaction enabled;
- semantic-primary remains `false`.

## Evidence handling

The post-probe evidence packet may include a redacted raw invocation-log example, but must remove or replace:

- the ephemeral JWT;
- any real client IP or user-linked identifier if present;
- unnecessary account/platform identifiers;
- any unrelated production-request value.

The packet must still preserve the complete field/key structure needed for independent review.

## PASS criterion

PASS requires all of the following:

1. exact reviewed request shape used once;
2. target is `libedge-api-prod` direct Worker URL;
3. synthetic auth succeeds and application returns `400 / RESEARCH_QUERY_INVALID`;
4. `/api/research/search` remains visible/classifiable;
5. query sentinel is absent everywhere;
6. Authorization sentinel is absent everywhere;
7. cookie sentinel and ephemeral JWT are absent everywhere;
8. no request body is persisted;
9. no decoded synthetic JWT identity fields are exposed;
10. full-field inventory contains no unresolved sensitive/unexpected field;
11. timestamp precision is sufficient;
12. effective sampling remains exactly `1.0`;
13. query-string redaction remains enabled;
14. production semantic-primary remains `false`.

Otherwise classify:

`PRIVACY OR COMPLETENESS VERIFICATION FAILED — TRACK A REMAINS BLOCKED`.

## Decision boundary

Acceptance of this probe specification only locks the exact probe shape for the later production observability execution-authorization review.

It does **not** authorize:

- production observability deployment;
- probe execution by itself;
- a changed endpoint/method/sentinel/header/body shape;
- use of a real user credential;
- direct human extraction/handling of the production `JWT_SECRET`;
- repeated probing;
- a capacity observation window;
- production D1 migration;
- semantic-primary;
- D-016 broad enablement;
- H/RRF or Vectorize;
- a final capacity conclusion.

Any material change requires fresh probe-spec review.

## Reviewer questions

1. Is the exact direct production Worker target correct?
2. Does authenticated `GET /api/research/search` with a 301-character query stop before rate-limit/telemetry/provider/cache side effects under the current router order?
3. Is the 120-second synthetic JWT sufficiently isolated from real customer identity and safe for this one-time privacy probe?
4. Does the non-Bearer Authorization sentinel correctly preserve cookie-based authentication under current `requireAuth()` behavior?
5. Are query, Authorization, Cookie, JWT, body, and decoded-payload checks explicit enough?
6. Is the open-ended complete field inventory broad enough to detect unexpected privacy exposure?
7. Is the single-execution/no-silent-retry rule appropriate?
8. Is the secure secret-injection/token-generation constraint sufficient for the later execution-authorization artifact?
9. Is this probe ready to be the mandatory accepted probe reference for production observability execution authorization?

---

## Revision v0.2 — 401-based probe without `JWT_SECRET`

Status: `PROPOSED REVISION / REQUIRES INDEPENDENT REVIEW / NOT EXECUTED`

Reason for revision: the first execution attempt successfully deployed production observability but stopped before issuing the probe because production `JWT_SECRET` is available only as a Cloudflare Worker secret. That secret is write-only from the deployment surface and is not present in the GitHub production environment. The v0.2 probe therefore removes JWT generation entirely instead of copying, recovering, rotating, or duplicating the production signing secret.

This revision supersedes the **execution shape** above for the next privacy-probe attempt. The original v0.1 text is retained as historical review context and must not be interpreted as the active execution shape once v0.2 is accepted.

### v0.2 authentication shape

No JWT is generated. `JWT_SECRET` is not required by the workflow and must not be copied into GitHub for this probe.

The request remains intentionally unauthenticated and uses the existing middleware's 401 path:

```text
Authorization: LibEdgeProbe LIBEDGE_OBS_AUTHZ_20260913_A7F3
Cookie: authToken=invalid-probe-token; libedge_probe=LIBEDGE_OBS_COOKIE_20260913_A7F3
User-Agent: LibEdge-Observability-Probe/2026-09-13
Accept: application/json
```

The `Authorization` value remains intentionally non-Bearer and continues to serve only as a log-leak sentinel. Because it does not begin with `Bearer `, current `requireAuth()` falls back to the `authToken` cookie. The deliberately invalid `authToken` fails verification and therefore produces HTTP `401` before query validation. The `libedge_probe` cookie remains a separate non-secret cookie sentinel for the persisted-log inspection.

The literal `invalid-probe-token` is also treated as forbidden persisted material: it must have zero occurrences in the matching invocation record.

### v0.2 expected response

Expected status:

`401 Unauthorized`

Only the HTTP status is a gate. The exact localized error body is not relied on by the workflow.

A non-401 response is a hard STOP. The probe must not silently retry with another auth shape.

### v0.2 query-string redaction assumption

This revision explicitly adopts the following execution assumption for review:

> A 401 request that fails authentication and a 400 request that passes authentication but fails query validation are treated as equivalent for the narrow `redact_query_string` test, because query-string redaction is expected to be applied by Cloudflare's observability/edge logging layer independently of the application's authentication outcome.

This is an explicit test-design assumption, not a claim that the 401 and 400 application paths are semantically equivalent. The probe is intended only to test the persisted observability surface for the same method, host, path, query-string sentinel, Authorization sentinel, Cookie sentinel, and no-body request shape.

### v0.2 unchanged privacy checks

The following requirements remain unchanged:

- exact direct production Worker target: `libedge-api-prod`;
- exact method and path: `GET /api/research/search`;
- exact 301-character query-string sentinel;
- Authorization sentinel remains present in the request and must be absent from persisted logs;
- Cookie sentinel remains present in the request and must be absent from persisted logs;
- no request body is sent and no non-empty request body may be persisted;
- full raw query/query-string variants must remain absent;
- complete top-level and nested field inventory remains mandatory;
- any sensitive or insufficiently understood unexpected field remains a hard STOP;
- effective observability must remain enabled;
- `head_sampling_rate` must remain exactly `1.0`;
- query-string redaction must remain enabled;
- production semantic-primary must remain `false`;
- exactly one probe request is authorized; telemetry-ingestion polling must not repeat the production request;
- reviewer-visible evidence may include only a redacted invocation sample preserving field structure;
- final marker remains `PASS_PENDING_INDEPENDENT_REVIEW` until the reviewer inspects the real output.

### v0.2 post-probe matching rule

The persisted invocation record must be located using the same UTC time window, Worker identity, method, and path, but the expected response status is now `401` instead of `400`.

### v0.2 PASS criterion

PASS requires all of the following:

1. the exact reviewed v0.2 request shape is used once;
2. the target is the direct `libedge-api-prod` Worker URL;
3. the application returns HTTP `401` as expected from `requireAuth()`;
4. `/api/research/search` remains visible/classifiable;
5. the query sentinel is absent everywhere;
6. the Authorization sentinel is absent everywhere;
7. the cookie sentinel and `invalid-probe-token` are absent everywhere;
8. no request body is persisted;
9. the full-field inventory contains no unresolved sensitive/unexpected field;
10. timestamp precision remains sufficient for per-request or <=2-second counting;
11. effective sampling remains exactly `1.0`;
12. query-string redaction remains enabled;
13. production semantic-primary remains `false`.

Otherwise classify:

`PRIVACY OR COMPLETENESS VERIFICATION FAILED — TRACK A REMAINS BLOCKED`.

### v0.2 decision boundary

This revision changes only the privacy probe's authentication mechanism and expected application status. It does not change:

- the already-deployed observability configuration;
- production application behavior;
- the seven-day / 168-valid-hour observation-window decision;
- semantic-primary;
- D-016;
- migrations;
- provider selection;
- any production user credential or session.

Acceptance of v0.2 still does **not** authorize execution by itself. The revised workflow must be independently reviewed before any rerun.
