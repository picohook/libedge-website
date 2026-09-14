# P0.5 Production Observability — Execution Authorization Candidate

Status: `REVIEW REQUIRED / DO NOT EXECUTE`

Date: 2026-09-13

## Purpose

Lock the exact execution unit for the first real production observability deployment and the immediately-following single authenticated privacy probe.

This document does **not** authorize execution by itself. The workflow must receive independent reviewer acceptance before `Run workflow` is used.

## Upstream accepted evidence

The following are already accepted prerequisites:

- `docs/architecture/p05-production-observability-proposal.md`
- `docs/architecture/p05-production-observability-execution-plan.md`
- `docs/architecture/p05-production-observability-privacy-probe-spec.md` (PR #49)
- production observability configuration restored in PR #63
- production dry-run workflow exposed on `main` in PR #64
- production dry run completed successfully with Wrangler `4.131.1`
- the dry run checked out `staging` at `663b05280aa4cd89d05a2f725be5afea19a064d2`
- the dry run completed with `--dry-run: exiting now.` and no `redact_query_string` schema warning

## Exact workflow

Execution candidate:

`.github/workflows/production-observability-deploy.yml`

The workflow is intentionally one production job with two operational actions:

1. real production deploy:
   `npx wrangler deploy --env production`
2. immediately-following single authenticated privacy probe and persisted Workers Observability log inspection.

Setup/guard steps exist only to enforce the reviewed execution boundary.

## Human confirmation gate

Manual dispatch requires the exact string:

`PRODUCTION-OBSERVABILITY-DEPLOY-PROBE-ONE-SHOT`

The job also targets the protected GitHub Environment:

`production`

The workflow must not be run before independent review of the complete YAML.

## Repository-state guard

The reviewed dry-run base is fixed at:

`663b05280aa4cd89d05a2f725be5afea19a064d2`

The workflow checks out `ref: staging` with full history and fails closed unless every file changed after that reviewed base belongs to this execution-authorization unit:

- `.github/workflows/production-observability-deploy.yml`
- `docs/architecture/p05-production-observability-execution-authorization.md`

Any later application/config/tooling change on `staging` therefore blocks execution until fresh review.

This guard is important because `wrangler deploy` publishes the complete Worker version, not merely one observability field.

## Secret handling

The workflow consumes protected production GitHub Environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `JWT_SECRET`

`JWT_SECRET` is used only inside the protected runner to create the one-time 120-second synthetic HS256 token required by the accepted probe specification.

The raw production JWT secret is never printed or copied into evidence. The generated JWT is immediately masked, is not uploaded as an artifact, and evidence inspection begins only after its 120-second lifetime has expired.

If the protected production environment does not contain `JWT_SECRET`, execution fails closed; no human extraction of the Cloudflare Worker secret is authorized.

The Cloudflare API token must also permit the read/query operations required for effective Worker settings and Workers Observability telemetry. Missing permission is a STOP, not permission to substitute a broader credential ad hoc.

## Exact privacy probe

The workflow implements the already-accepted PR #49 shape without modification:

- direct Worker target: `https://libedge-api-prod.agursel.workers.dev/api/research/search`
- method: `GET`
- exact 301-character `q` sentinel from PR #49
- short-lived synthetic JWT (`sub=libedge-observability-probe`, `role=probe`, `exp=now+120s`)
- non-Bearer Authorization sentinel
- synthetic cookie sentinel
- exact User-Agent from PR #49
- no request body
- expected result: `400 / RESEARCH_QUERY_INVALID`
- exactly one probe request; no automatic retry

Polling the persisted observability API for ingestion does not repeat the production probe request.

## Privacy verification

After JWT expiry, the workflow queries the persisted Workers Observability dataset for the matching production invocation and checks:

1. query sentinel absent everywhere;
2. clear-text Authorization sentinel absent;
3. clear-text Cookie sentinel absent;
4. ephemeral JWT and decoded synthetic identity absent;
5. persisted URL contains no query string;
6. no non-empty request-body field is present;
7. complete top-level/nested field inventory is emitted;
8. any undocumented top-level field is a hard STOP;
9. a redacted invocation sample is emitted only after the automated privacy checks pass.

The final workflow marker is deliberately:

`PRIVACY_PROBE_RESULT=PASS_PENDING_INDEPENDENT_REVIEW`

It is not a self-approving PASS. The reviewer must inspect the field inventory and redacted sample before Track A evidence collection is considered privacy-cleared.

## Observation-window decision

**Decision: 7 days / 168 valid hours.**

If and only if the immediate privacy probe receives independent PASS after execution, the Track A production observation window is authorized for seven consecutive days so that the evidence spans both weekday and weekend traffic.

Window rules:

- duration target: `168 valid hours`;
- should cover five normal weekdays plus a weekend;
- start: first full UTC hour after the privacy probe is independently accepted;
- end: exactly 168 valid hours later;
- a material maintenance window, Cloudflare outage, known application outage, or logging interruption is excluded from representativeness and extends the end time by the excluded duration;
- `head_sampling_rate` must remain exactly `1.0` throughout;
- query-string redaction must remain enabled throughout;
- production semantic-primary must remain `false` throughout;
- no final capacity conclusion is authorized until the full 168 valid hours are complete and independently reviewed.

Rationale: seven days is the shortest simple window that naturally includes the weekly weekday/weekend demand cycle without requiring extrapolation from a single workday or weekend-only sample.

## Decision boundary

This candidate authorizes, only after reviewer acceptance and manual confirmation:

- deployment of the already-reviewed production observability configuration from the guarded staging execution unit;
- one authenticated synthetic privacy probe;
- privacy inspection of that probe's persisted invocation record;
- after independent privacy PASS, a 7-day / 168-valid-hour observation window.

It does **not** authorize:

- semantic-primary enablement;
- D-016 broad production activation;
- D1/R2/KV/DO migrations or mutations;
- provider/model selection or deployment;
- repeated probe requests;
- changing the accepted probe sentinels/request shape;
- changing sampling/redaction semantics;
- final capacity/adoption conclusions before the full window is complete.

## Reviewer questions

1. Does the staging-diff guard adequately prevent unrelated staging changes from being bundled into the real production deploy?
2. Is the confirmation string + protected `production` environment sufficient against accidental execution?
3. Is protected secret injection compliant with the accepted PR #49 requirement?
4. Does the workflow issue exactly one probe request and avoid silent retries?
5. Does the persisted Workers Observability query inspect the correct production log surface?
6. Are the sentinel/JWT/body checks fail-closed?
7. Is the emitted full-field inventory plus redacted sample sufficient for manual independent review?
8. Is the 7-day / 168-valid-hour weekday+weekend observation decision acceptable?
9. Is the workflow safe to expose on `main` only after this staging PR is independently accepted?

---

## 2026-09-14 execution addendum — 401 probe and telemetry credential split

This addendum preserves the original execution-authorization record above as historical context and records the reviewed evolution of the probe design and the latest execution result. Where this addendum conflicts with the original JWT/authenticated-probe text above, this addendum is the current execution candidate.

### Current probe shape

Following the accepted JWT-less revision, the current probe is intentionally unauthenticated:

- no `JWT_SECRET` is read or copied into GitHub;
- Cookie contains `authToken=invalid-probe-token` plus the synthetic cookie sentinel;
- the non-Bearer Authorization sentinel remains present only as a log-leak canary;
- the expected application result is HTTP `401` from `requireAuth()`;
- the exact 301-character query-string sentinel, no-body requirement, one-shot/no-retry rule, full-field inventory, redacted sample, and privacy checks remain unchanged.

### 2026-09-14 production execution result

The reviewed production workflow was executed after the execution-unit baseline was synchronized. The following portions completed successfully:

1. human confirmation gate: `PASS`;
2. reviewed staging execution-unit guard: `PASS`;
3. production observability deployment: `PASS`;
4. effective production settings read-back: `enabled=true`, `head_sampling_rate=1.0`, `redact_query_string=true`;
5. production semantic-primary guard remained `false`;
6. exactly one synthetic privacy probe was issued;
7. that probe returned the expected HTTP `401`.

The run then stopped **before persisted-log inspection**. The Workers Observability telemetry query returned HTTP `403` because the existing production/deploy API token did not carry the permission required by that Cloudflare telemetry-query endpoint.

No automatic or silent probe retry was performed. Because the persisted invocation record was not retrieved, this run establishes **no privacy PASS or privacy FAIL** for the log contents. In particular, the query-string, Authorization/Cookie, request-body, and complete-field-inventory checks remain unexecuted for this run.

### Minimum-privilege credential correction

The current execution candidate separates credentials by purpose:

- `CLOUDFLARE_API_TOKEN`: existing protected production credential used for `wrangler deploy` and the effective Worker-settings read;
- `CLOUDFLARE_OBSERVABILITY_TOKEN`: new protected production Environment secret used **only** for `/workers/observability/telemetry/query`.

The observability token must be separately created with the minimum Cloudflare permission required for the telemetry query (`Workers Observability Write`) and must not be granted Worker deploy/edit permissions merely for convenience.

The workflow fails closed if `CLOUDFLARE_OBSERVABILITY_TOKEN` is absent. Adding the secret does not itself authorize a new probe run; the revised workflow must first receive independent review, and any new probe execution must be separately manually authorized through the existing confirmation gate.

### Updated decision boundary

This addendum does not authorize semantic-primary, D-016 activation, provider/model usage, migrations, or a privacy verdict. It only:

- records the successful deploy + one-shot 401 probe evidence already obtained;
- records that persisted-log inspection was blocked by credential scope rather than application/probe failure;
- adopts a separate minimum-privilege telemetry-query token for the next independently authorized execution.
