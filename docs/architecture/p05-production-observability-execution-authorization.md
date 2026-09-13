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
