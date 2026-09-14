# P0.5 Production Observability — Independent Privacy Review

Status: `REVIEW REQUIRED / OBSERVATION WINDOW NOT YET AUTHORIZED`

Date: 2026-09-14

Related records:

- `docs/architecture/p05-production-observability-proposal.md`
- `docs/architecture/p05-production-observability-execution-plan.md`
- `docs/architecture/p05-production-observability-privacy-probe-spec.md`
- `docs/architecture/p05-production-observability-execution-authorization.md`

## Scope

This record independently reviews the successful production observability execution completed on 2026-09-14 after the telemetry-query credential was separated from the deploy credential.

It records what the run actually established, what unexpected persisted metadata was discovered, and the follow-up research on Cloudflare invocation-log minimization and Worker version attribution.

It does **not** change production configuration, Worker code, semantic-primary behavior, provider selection, or the previously approved 7-day observation-window duration.

## 1. Successful execution evidence

GitHub Actions run `34838286816` (`Production Observability Deploy + Privacy Probe`, run number 5) completed successfully.

The run established all of the following:

- human confirmation gate: `PASS`;
- reviewed staging execution-unit guard: `PASS`;
- production deploy: `PASS`;
- effective observability settings read-back: `enabled=true`, `head_sampling_rate=1.0`, `redact_query_string=true`;
- `RESEARCH_SEMANTIC_PRIMARY_ENABLED` remained `false`;
- exactly one synthetic probe request was issued;
- the probe returned the expected HTTP `401`;
- persisted Workers Observability telemetry was successfully queried with the separate minimum-privilege observability credential;
- the workflow reached `PRIVACY_PROBE_RESULT=PASS_PENDING_INDEPENDENT_REVIEW`.

## 2. Four requested privacy checks — PASS

The persisted invocation record passed the four originally requested privacy checks:

1. **Query-string sentinel absent:** the 301-character query sentinel and its prefix were absent from the persisted event; the persisted request URL contained no query string.
2. **Authorization/Cookie cleartext absent:** the synthetic Authorization sentinel, Cookie sentinel, and invalid auth-token marker were absent from the persisted event.
3. **Request body not persisted:** no non-empty request-body field was present.
4. **Complete field inventory emitted:** the workflow emitted the full nested field inventory and found no undocumented top-level root outside the reviewed root set.

These four checks are accepted as `PASS` for this execution.

This does **not** by itself constitute a complete Track A privacy clearance because the independent review of the full nested inventory exposed additional metadata that was outside the original four leak checks.

## 3. Unexpectedly broad nested invocation metadata

The invocation log contains substantially more client/network context than the minimum timing/path/status data needed for Track A capacity observation.

Observed nested fields include, among others:

- request geolocation and network context under `$workers.event.request.cf`, including country, city, region, latitude/longitude, postal code, ASN, organization and colo;
- TLS/client-fingerprint-adjacent fields, including TLS version/cipher, client random, cipher/extension hashes, handshake/finished values and related connection metadata;
- request headers, including header names for Authorization, Cookie, connecting IP, Ray ID, User-Agent and related transport headers;
- Worker request/trace identifiers and account/service metadata.

The probe confirmed that the reviewed sensitive sentinel values were not present in cleartext. The concern here is therefore **metadata minimization**, not failure of query/header/body redaction.

### Cloudflare documentation finding

Cloudflare documents that each Worker invocation log contains Request, Response and related metadata and is enriched with information available to Cloudflare in the context of the invocation.

Cloudflare also documents a coarse control to disable invocation logs entirely:

`invocation_logs = false`

No documented field-level control was found that selectively removes only `request.cf` geo/network/TLS enrichment while retaining the remainder of the automatic invocation log.

Official references:

- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/api/resources/workers/

## 4. Minimal custom-log alternative — viable design candidate, not yet authorized

Cloudflare separately supports custom logs emitted by Worker code through `console.log()` / structured logging.

This creates a viable minimization design candidate:

1. disable automatic invocation logs with `invocation_logs = false`;
2. keep Workers Logs enabled;
3. emit only an explicitly minimized structured custom event containing the fields Track A actually requires, for example:
   - coarse timestamp/bucket;
   - route/path class, not raw query;
   - response status class;
   - execution duration / latency measurement needed for capacity analysis;
   - no user identifier, IP, geolocation, headers, query string, request body, cookie, authorization value, research query text, or model/provider content.

Cloudflare documentation confirms both pieces independently: invocation logs can be disabled, and custom application logs can still be emitted and indexed.

This record does **not** claim that the production Worker already implements such a minimized event. Implementing it would be a production-code/configuration change and therefore requires a separate design + review PR before any deployment.

The custom-log design should also be reviewed for accidental enrichment semantics before adoption; this record establishes that it is a documented mechanism worth prototyping, not that its final persisted shape has already been privacy-validated.

## 5. Worker version-ID mismatch — explained as propagation-consistent, not event-selection failure

The successful run deployed a new Worker version and Wrangler reported:

`0fcb70e8-c626-44fb-82ed-d67fe9aa719d`

The persisted probe invocation record instead reported:

`$workers.scriptVersion.id = 2f98cef2-390b-4c22-98fe-0b70d60a05a4`

Independent comparison against the immediately preceding production execution resolves an important part of the ambiguity: `2f98cef2-390b-4c22-98fe-0b70d60a05a4` is the **exact Current Version ID reported by the previous successful production deploy**.

The successful run sent the probe roughly half a second after Wrangler reported the new deployment complete. Cloudflare documents that, following a recent deployment change, a Worker version can take up to a couple of seconds to become available globally. Cloudflare also documents that Observability can identify the Worker version that actually handled a request.

Official references:

- https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/
- https://developers.cloudflare.com/workers/versions-and-deployments/

### Why the selected event is still attributable to the probe

The persisted event contains the exact synthetic probe User-Agent:

`LibEdge-Observability-Probe/2026-09-13`

It also has the expected research path and HTTP `401` response within the probe time window.

Therefore the evidence does **not** support the hypothesis that the workflow simply selected an unrelated 401 request. The event is attributable to the synthetic probe.

### Version-attribution conclusion

The mismatch is **consistent with immediate post-deploy global propagation/version availability**, and the observed old ID is exactly the prior deployed version ID.

However, this run does not prove that the new `0fcb70e8...` version handled the probe. The correct record is therefore:

- probe identity: `CONFIRMED`;
- four privacy checks: `PASS`;
- exact new-version attribution: `NOT ESTABLISHED FOR THIS RUN`;
- version mismatch: `PROPAGATION-CONSISTENT / NOT A PRIVACY LEAK FINDING`.

If a future version-specific execution is required for another reason, the workflow should verify active version availability before sending the one-shot probe rather than relying on an immediate post-deploy request. No rerun is authorized merely to clean up this historical attribution detail.

## 6. Independent review decision

### Accepted

- production observability deploy succeeded;
- semantic-primary stayed disabled;
- one-shot 401 probe behavior was correct;
- query-string sentinel absence: `PASS`;
- Authorization/Cookie cleartext absence: `PASS`;
- request-body persistence check: `PASS`;
- field inventory collection: `PASS`;
- selected persisted event is attributable to the synthetic probe.

### Still open

- whether the broad automatic invocation metadata is acceptable for the full 168-hour production observation window;
- or, preferably, whether Track A should move to an invocation-logs-off + explicitly minimized custom-log design before beginning that window.

## 7. Observation-window status

The previously approved duration decision remains `7 days / 168 valid hours`, but the observation window is **not started by this record**.

Start remains blocked pending reviewer disposition of the metadata-minimization question.

No further privacy probe rerun is authorized by this document.

## Decision boundary

This record does **not**:

- alter production observability settings;
- set `invocation_logs = false`;
- add custom logging to Worker production code;
- authorize a new deploy or probe;
- start the 168-hour observation window;
- enable semantic-primary or D-016;
- change provider/model privacy-gate status;
- authorize migrations or other production behavior changes.

## Reviewer questions

1. Do the persisted-run facts support accepting the four original privacy checks as `PASS` while withholding full Track A privacy clearance because of metadata minimization?
2. Is the version mismatch sufficiently reconciled by the prior-version-ID match, exact probe User-Agent, sub-second post-deploy timing, and Cloudflare's documented short global-availability interval?
3. Should Track A accept Cloudflare's enriched automatic invocation metadata for the 168-hour window, or require a separate minimized custom-log design first?
4. If minimization is required, should the next PR be limited to a design/implementation for `invocation_logs = false` plus a strict structured custom event, with its persisted schema reviewed before observation begins?
