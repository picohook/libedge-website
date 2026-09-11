# D-016 — Pacing / Observability Correction Implementation

Status: `ACTIVE — IMPLEMENTED / FLAG OFF / CODE REVIEW REQUIRED`
Date: 2026-09-11
Incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`
Review disposition: `docs/reviews/2026-09-11-d016-pacing-correction-review.md`

## Implemented correction

### Semantic pacing safety margin

`backend/src/research/semantic-pacer.js`

- `MIN_START_INTERVAL_MS` changed from `1000` to `1500`.
- The single named Durable Object and privacy model are unchanged.
- The gate still stores only `last_start_ms` and receives no query/user/topic/result content.
- This is an operational safety margin, not a relevance or routing change.

### Aggregate telemetry read path

`backend/src/research/telemetry.js`

- added `readResearchTelemetrySnapshot(env, now)`;
- metric names come directly from the existing `ALLOWED_METRICS` / exported `RESEARCH_TELEMETRY_METRICS` set;
- the snapshot reads only the current UTC-day numeric aggregate counters from `RATE_LIMIT_KV`;
- no second metric allowlist was introduced.

`backend/src/system-health.js`

- existing super-admin-only `/api/admin/system-health` response now includes `research_telemetry`;
- it uses `readResearchTelemetrySnapshot` rather than manually naming metrics;
- failure of the telemetry read is represented as an operational `status:error` check;
- the endpoint remains read-only and no new authentication model was introduced.

## Tests

`test/backend/research-semantic-pacing.test.js`

- deterministic boundary changed to `1499 ms` blocked / `1500 ms` released;
- grant spacing must be at least `1500 ms`.

`test/backend/system-health-research-telemetry.test.js`

- non-super-admin authenticated caller receives `403`;
- super-admin response metric keys exactly equal the shared `RESEARCH_TELEMETRY_METRICS` set;
- representative aggregate values are read correctly;
- serialized research telemetry contains no query/email/topic/DOI/title/result content.

## CI evidence

CI run `34565285661` at head `08edd0d85d1d041ab36065a4827ba2d247557509`:

- lint: PASS;
- syntax checks: PASS;
- unit tests: `23` test files / `93` tests PASS;
- new `system-health-research-telemetry.test.js`: `3` PASS;
- updated `research-semantic-pacing.test.js`: `3` PASS;
- staging Wrangler dry-run: PASS;
- dry-run confirms `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`.

## Shared-key check result

The staging repository has P0.5 retrieval workflows that use the staging `OPENALEX_API_KEY`, but those workflows are manual `workflow_dispatch` only. GitHub Actions history for the staging branch shows no workflow-dispatch run in the 2026-09-11 smoke window; the only accessible workflow-dispatch runs are dated 2026-09-06.

Therefore no concurrent repository Actions retrieval is evidenced during the incident window. External/shared-account use cannot be ruled out because secret values and non-GitHub consumers are intentionally not observable from this control plane.

## Deployment / retry boundary

Semantic-primary remains OFF. The correction commits may be deployed by the existing staging push pipeline while the flag is OFF, but no semantic smoke/retry is authorized until an independent code/diff review accepts this correction set and a separate retry authorization is issued.

No production flag or D-016 architecture rule changes are included.
