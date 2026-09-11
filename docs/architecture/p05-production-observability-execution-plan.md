# P0.5 Production Retrieval — Production Observability Execution Plan

Status: `ACCEPTED WITH MODIFICATION / PROBE SPEC REVIEW REQUIRED / NOT EXECUTED`

Date: 2026-09-12

## Purpose

Define the exact, bounded production configuration procedure needed to create a privacy-safe Workers Logs observation window for Track A capacity evidence.

This plan does **not** authorize execution by itself.

It does **not** authorize:

- production semantic-primary;
- production D1 migrations;
- D-016 Track B;
- H/RRF or Vectorize;
- any retrieval behavior change;
- any production data mutation beyond the unavoidable log records created by the separately reviewed observability configuration and the explicitly authorized privacy probe.

## Upstream accepted proposal

The accepted proposal is:

`docs/architecture/p05-production-observability-proposal.md`

Reviewer-required modifications have been incorporated:

1. production observability uses the flat Wrangler structure:

```toml
[env.production.observability]
enabled = true
head_sampling_rate = 1.0
redact_query_string = true
```

2. post-deployment privacy verification must explicitly confirm that invocation logs do not expose clear-text `Authorization` or `Cookie` header values.

## Repository / tooling facts

Current repository package metadata declares:

`wrangler = ^4.83.0`

The execution must use the repository-installed Wrangler resolved by `npm ci`; no globally installed Wrangler binary may be substituted silently.

Production target remains:

- Worker: `libedge-api-prod`
- Wrangler environment: `production`
- semantic-primary: `false`

## Exact intended code/configuration change

Only the following production observability block may be added to `wrangler.toml`:

```toml
[env.production.observability]
enabled = true
head_sampling_rate = 1.0
redact_query_string = true
```

No staging/default observability block is added.

No `.logs` subtable is added.

No `invocation_logs` key is added.

No semantic flag, D1 binding, R2 binding, KV binding, Durable Object binding, cron, secret declaration, route, compatibility setting, or application code may change in the same execution unit.

## Required pre-deployment review evidence

Before any production deploy command is run, record and independently review all of the following.

### A. Fresh repository state

1. exact base commit;
2. exact proposed head commit;
3. fresh base→head diff;
4. diff proves only the intended `wrangler.toml` observability block changed;
5. production semantic-primary remains `false` in the proposed head;
6. production target remains `libedge-api-prod`;
7. production D1/R2/KV/DO bindings are byte-for-byte unchanged.

Any unrelated diff is a hard STOP.

### B. Current production account state

Before deployment, the human gatekeeper records the effective production Cloudflare state:

- Workers Observability currently enabled/disabled;
- current effective sampling state if shown;
- current query-string-redaction state if shown;
- target Worker identity = `libedge-api-prod`.

The previously observed state was `Workers Observability is Disabled`, but execution must not rely on that stale observation; a fresh observation is required.

### C. Wrangler syntax validation using repository version

Run dependency installation from the reviewed commit:

```bash
npm ci
```

Record:

```bash
npx wrangler --version
```

Then validate the exact production configuration without deploying it:

```bash
npx wrangler deploy --env production --dry-run
```

The dry run must complete without configuration-schema errors and must identify the production Worker/environment expected by the reviewed configuration.

A dry-run warning/error indicating unsupported `observability`, `head_sampling_rate`, or `redact_query_string` syntax is a hard STOP.

No attempt may be made to reinterpret or silently rewrite the approved observability semantics during execution.

### D. Privacy-probe specification approval — separate mandatory gate

The privacy probe is a separate review artifact and must be independently accepted **before any production execution authorization is requested**.

The execution-plan review and the privacy-probe review are distinct approval points. Acceptance of this execution plan must not be interpreted as approval of an unspecified probe.

Before an execution-authorization request can be submitted, the reviewer must have accepted a probe specification that locks:

- exact HTTP method;
- exact production target/path;
- exact query-string sentinel;
- exact non-secret `Authorization` sentinel, if included;
- exact non-secret `Cookie` sentinel, if included;
- request-body behavior;
- expected application response class;
- proof that the probe does not use real credentials, real research topics, personal data, or customer-visible state;
- the exact log-record checks to be performed afterward.

Any change to the accepted probe shape requires a fresh probe-spec review before execution authorization.

### E. Exact deployment command

The only authorized production deployment command, if this plan later receives explicit execution authorization, is:

```bash
npx wrangler deploy --env production
```

The complete command and output must be retained in the evidence record.

No migration command may be executed.

No semantic flag may be changed before, during, or after the deployment.

## Immediate post-deployment STOP gate

After deployment, do **not** begin a capacity observation window yet.

First verify the effective production observability/privacy state.

The deployment is considered structurally valid only if all of the following are true:

1. target Worker is exactly `libedge-api-prod`;
2. Workers Observability is enabled;
3. effective `head_sampling_rate = 1.0`;
4. effective query-string redaction is enabled;
5. production semantic-primary remains `false`;
6. no unexpected production configuration changed.

Any mismatch is a hard STOP. Collected data must not be used as Track A evidence.

## Privacy probe

A separately reviewed and accepted, single synthetic invocation is used only to verify the effective log surface before starting the observation window.

The probe must be designed so that:

- it is read-only at the application level;
- it uses only non-sensitive synthetic sentinels;
- it is authenticated only if the separately accepted probe specification explicitly requires real authentication (the preferred design is to avoid real credentials entirely);
- it contains no real research topic, personal data, user interest, DOI/title, or production-sensitive content;
- it creates no customer-visible state;
- it is executed exactly once unless a fresh reviewer explicitly authorizes another probe.

The exact endpoint and exact probe shape must already be locked in the separately accepted probe specification before execution authorization is requested.

## Post-deployment privacy verification

Inspect the invocation log generated by the authorized synthetic probe and record the relevant log fields or screenshots/redacted export sufficient for independent review.

### Known-risk assertions

All of the following must pass:

1. the request path needed for endpoint classification remains visible;
2. the sentinel query-string value is **not** present anywhere in the invocation log record;
3. the original `q=` value, if the research endpoint is used, is not present anywhere in the record;
4. no clear-text `Authorization` sentinel/value is present;
5. no clear-text `Cookie` sentinel/value is present;
6. no request body is persisted;
7. no user ID/email, research topic, result content, DOI/title, or normalized query is persisted by any newly enabled/custom logging surface;
8. per-invocation timestamp data are present with sufficient precision for per-request or <=2-second counting.

### Open-ended full-field inventory — mandatory

Do not limit the privacy review to the known-risk checklist above.

For at least one complete probe invocation record, enumerate and inspect the **full set of fields/keys actually present**, including nested request/response metadata where exposed.

The evidence record must:

- list every observed top-level and nested field/key available in the inspected record;
- classify each field as expected/needed, operational-but-nonessential, or unexpected/sensitive;
- explicitly inspect unexpected metadata such as `Referer`, `User-Agent`, client/network/IP-related fields, headers, cookies, request URL variants, tracing identifiers, and any platform-added metadata if present;
- confirm that no unexpected field exposes query text, credentials, personal identifiers, research interests, raw request bodies, or equivalent sensitive material;
- STOP if a sensitive or insufficiently understood field is present until it is independently reviewed.

An allowlist may be proposed later only after this first open-ended inventory establishes the effective Cloudflare log shape. The first verification must not assume a closed field list in advance.

A single failure is a hard STOP:

`PRIVACY OR COMPLETENESS VERIFICATION FAILED — TRACK A REMAINS BLOCKED`.

No capacity-rate conclusion may be drawn from logs until both the known-risk assertions and the open-ended full-field inventory pass independent review.

## Capacity observation window

The observation-window duration is deliberately **not** authorized by this execution plan.

After the structural/privacy verification passes, a separate reviewer decision must specify or accept:

- UTC start/end;
- minimum duration or representativeness rationale;
- whether the window spans expected normal production demand;
- any maintenance/outage periods to exclude;
- retention/export method, if any.

Until that decision exists, observability may be verified but no final `<=0.5 req/s` capacity conclusion may be claimed.

## Capacity evidence calculation once separately authorized

For the later approved observation window:

- isolate only the eligible research endpoint by redacted path;
- use complete/unsampled invocation capture;
- use per-request timestamps if available;
- otherwise use buckets no coarser than 2 seconds;
- do not use query-string values for classification;
- do not extrapolate from sampled data;
- record total eligible requests;
- record the maximum observed eligible-request rate and exact calculation method.

For a 2-second bucket, the locked guardrail requires at most one eligible request in any bucket.

## Rollback / recovery

The pre-deployment production observability state must be recorded before change.

If the observability deployment itself causes an operational, privacy, cost, or logging-surface problem:

1. STOP evidence collection;
2. do not change semantic-primary;
3. restore the previously recorded observability configuration only;
4. deploy that narrow restoration using the same reviewed production target;
5. verify restoration in effective Cloudflare account state;
6. return to independent review before any new observability attempt.

Rollback must not bundle application code, D1 migration, retrieval, semantic, R2, KV, DO, or unrelated configuration changes.

If the issue is merely that Track A evidence is insufficient, destructive rollback is not automatically required; leaving observability enabled or disabling it requires the separately reviewed operational/retention decision appropriate to the account state.

## Evidence record required after any authorized execution

The execution evidence must include:

- reviewer authorization reference;
- accepted privacy-probe specification reference;
- base/head commit SHAs;
- full reviewed diff;
- `npm ci` result;
- exact `npx wrangler --version` output;
- exact dry-run command/output;
- fresh pre-deploy production observability state;
- exact deployment command/output;
- post-deploy effective observability state;
- effective `head_sampling_rate`;
- effective query-string-redaction state;
- production semantic-primary state after deployment;
- exact authorized privacy-probe shape and sentinel values;
- proof that query-string sentinel is absent from logs;
- proof that `Authorization`/`Cookie` sentinel values are not exposed in clear text;
- full observed invocation-log field/key inventory with field classifications;
- timestamp-resolution proof;
- any warnings/errors;
- whether rollback was required;
- explicit statement that no production D1 migration or semantic enablement occurred.

## Hard STOP conditions

Stop without improvisation if any of the following occurs:

- unrelated repository diff;
- wrong Worker/environment;
- semantic-primary is not `false`;
- privacy-probe specification has not been separately accepted before execution authorization;
- actual probe differs from the accepted probe specification;
- repository Wrangler cannot validate the approved syntax;
- dry run differs materially from the reviewed target/configuration;
- deployment attempts to change unexpected bindings/settings;
- effective sampling is not exactly `1.0`;
- query-string redaction is not effective;
- query sentinel appears in logs;
- clear-text `Authorization` or `Cookie` sentinel/value appears in logs;
- request body or prohibited identity/research content appears due to the observability change;
- full-field inventory reveals sensitive or insufficiently understood unexpected metadata;
- timestamps cannot support per-request or <=2-second analysis;
- an unreviewed trace/export/custom-log surface becomes active;
- any migration or semantic change is unexpectedly bundled.

A STOP never authorizes an automatic retry.

## Decision boundary

Acceptance of this execution plan would authorize **only** preparation for a later, explicitly approved production observability configuration execution under the exact constraints above.

It would not itself authorize deployment.

It would not authorize an unspecified privacy probe.

It would not authorize the capacity observation duration.

It would not authorize a final capacity conclusion.

It would not authorize semantic-primary or D-016 broad enablement.

## Reviewer questions

The independent reviewer should determine:

1. whether `npm ci` + repository `npx wrangler --version` + `wrangler deploy --env production --dry-run` is a sufficient deploy-before-syntax gate;
2. whether the exact deploy command is narrow enough;
3. whether the separate mandatory privacy-probe specification gate adequately prevents an unspecified probe from being folded into execution authorization;
4. whether the query-string and `Authorization`/`Cookie` verification is strong enough;
5. whether the open-ended full-field inventory is sufficient to detect unexpected Cloudflare metadata/privacy exposure;
6. whether rollback is narrow and safe;
7. whether observation-window duration is correctly left for a separate review;
8. whether this plan is ready, after separate probe-spec acceptance, to proceed to explicit production execution authorization.
