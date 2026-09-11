# D-016 — Controlled Staging Semantic Smoke Incident

Status: `OPEN — ROLLED BACK / REVIEW REQUIRED BEFORE RETRY`
Date: 2026-09-11
Environment: `staging`
Enablement commit: `acb418c47ae190cf6cb587c3d4903a92c92a4a0b`
Enablement deploy run: `34563626451`
Rollback commit: `b99843654614c326e390a3f42e5108210e66d7c2`
Rollback deploy run: `34564642518`

## Scope

This record captures the first independently authorized live semantic-primary staging smoke. It is an operational/mechanical incident record only. It is not a relevance evaluation and does not reopen P0.5.

The human gatekeeper explicitly confirmed immediately before enablement that the staging window was restricted to controlled test traffic and ordinary real end-user research traffic was not expected.

## Enablement deployment

The staging-only feature flag was changed to:

`RESEARCH_SEMANTIC_PRIMARY_ENABLED="true"`

Production remained:

`RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`

GitHub Actions run `34563626451` completed:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

Same-commit CI run `34563626337` also completed successfully.

## Live smoke observation

A real authenticated staging browser session issued two distinct ordinary test research requests programmatically near-concurrently via one `Promise.all` call. Query text is intentionally not stored in this canonical operational record.

Observed summaries:

### Request A

- HTTP status: `200`;
- `retrievalSource`: `lexical`;
- `cached`: `false`;
- result count: `10`;
- elapsed time observed in browser: approximately `4967 ms`;
- provider metadata showed `openalex.fallback = true`;
- semantic stage status: `rate_limited`;
- lexical stage status: `ok`;
- lexical provider telemetry showed remaining daily credits well above exhaustion and a charged lexical request (`requestCredits=10`, `requestCostUsd=0.001`).

### Request B

- HTTP status: `200`;
- `retrievalSource`: `semantic`;
- `cached`: `false`;
- result count: `10`;
- elapsed time observed in browser: approximately `4240 ms`.

No relevance judgment or S-vs-L quality comparison was performed.

## What this proves

The smoke proves all of the following live staging behaviors:

1. semantic-primary was actually active for at least one authenticated request;
2. the deployed Worker reached the semantic provider successfully for at least one request;
3. an objective semantic `429` was represented as semantic-stage `rate_limited` and correctly triggered lexical fallback for the other request;
4. semantic and lexical stages remained separated in response metadata;
5. the browser received successful responses rather than a user-visible hard failure.

## What this does NOT prove

The smoke does **not** satisfy the accepted live pacing criterion.

The accepted criterion requires evidence that `semantic_pacing_wait_ms_total` increased by `>0` across the near-concurrent pair (or an equivalent privacy-safe direct observation of per-request wait >0). That aggregate metric is written internally but is not currently exposed through an authenticated read-only observability path available to the reviewer/main engineering thread.

Moreover, one semantic attempt received HTTP 429 despite the intended pacing gate. Therefore live pacing enforcement cannot be declared successful merely because the other semantic request succeeded.

## Root-cause assessment

OpenAlex's current semantic-search documentation states a hard semantic-search rate limit of `1 request per second`.

The current Durable Object gate spaces **grant timestamps** by exactly `1000 ms`. The actual OpenAlex fetch begins only after the Worker receives the grant response. Small grant-to-fetch scheduling/network differences can therefore make actual provider request starts occur slightly less than 1000 ms apart even when grants are exactly 1000 ms apart.

This is a plausible explanation for the observed 429 and directly activates the previously deferred finding `OOS-D016-CODE-01` (grant-time vs actual provider-fetch start-time gap). The incident does not yet prove that this is the only possible cause; the retry must not proceed until the pacing/observability correction is independently reviewed.

The observed semantic 429 did not carry usable daily-budget headers, while the immediately successful lexical fallback showed substantial remaining daily credits. That evidence is consistent with a request-rate failure rather than daily-budget exhaustion, but the canonical record does not overstate this as mathematically conclusive.

## Immediate rollback

Per the accepted staging-enable procedure, the semantic-primary staging flag was immediately reverted to:

`RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`

Rollback commit:

`b99843654614c326e390a3f42e5108210e66d7c2`

Rollback deploy run `34564642518` completed:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

Production remained untouched throughout the smoke and rollback.

## Proposed correction for independent review — NOT IMPLEMENTED

No runtime correction is implemented by this record.

The main engineering thread proposes two narrow changes before any retry:

1. **Pacing safety margin:** increase the Durable Object minimum grant spacing from exactly `1000 ms` to `1500 ms`. This remains stricter than the locked `<=1 request/second` provider constraint while adding 500 ms of safety margin for grant-to-fetch jitter. It does not alter relevance, fallback eligibility, cache behavior, privacy, or D-016's semantic-primary decision.

2. **Read-only aggregate observability:** expose a super-admin-only read path for the already persisted privacy-safe research telemetry counters needed for rollout verification, including at minimum today's `semantic_attempts`, `semantic_successes`, `semantic_429`, `semantic_pacing_wait_ms_total`, `semantic_charged_responses`, aggregate semantic cost/credits, and lexical fallback counters. The endpoint must read only allowlisted aggregate numeric counters; it must not expose or store query text, user identity, topic, DOI/title, result bodies, or research-interest content.

The intended implementation location for observability is the existing super-admin `/api/admin/system-health` surface, reusing the existing aggregate telemetry keys rather than creating a new data model.

## Retry boundary

Do not re-enable semantic-primary and do not issue another semantic smoke pair until:

1. an independent reviewer accepts/modifies/rejects the proposed pacing and observability corrections;
2. any accepted code change is implemented and independently code/diff reviewed;
3. staging is redeployed with semantic-primary OFF and baseline remains healthy;
4. a separately authorized controlled retry is performed.

A future retry must again use two distinct near-concurrent non-sensitive requests and must show a privacy-safe pacing wait delta `>0`. A new natural 429 remains a stop/investigate condition.

## Triage update

`OOS-D016-CODE-01` — grant-time vs provider-fetch start-time gap: transition from `ACKNOWLEDGED / DEFERRED` to `OPEN`, because a live staging observation now provides evidence consistent with insufficient pacing margin.

`OOS-D016-CODE-02` — cache stampede risk remains `ACKNOWLEDGED / DEFERRED`; this smoke does not provide evidence that it caused the incident.
