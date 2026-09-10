# D-016 — Semantic-Primary Retrieval Staging Implementation Plan

Status: `ACTIVE — PRE-IMPLEMENTATION / PENDING INDEPENDENT REVIEW`
Governing decision: `docs/decisions.md` D-016 (`LOCKED`)
Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
Scope: staging/feature-flag implementation only; broad production enablement is not authorized by this plan.

## Purpose

Map every locked D-016 invariant to the narrowest concrete code path, tests, telemetry, and rollout control before changing retrieval behavior.

The current external endpoint remains:

`GET /api/research/search?q=...&per_page=...`

The user-facing response contract remains unchanged.

## Current implementation baseline

### Request routing

`backend/src/worker.js`

Routes authenticated research requests to `handleResearchRequest()` and wraps the response with `Cache-Control: private, no-store`.

### Research orchestration

`backend/src/research/router.js`

Currently performs:

1. auth;
2. protected user rate limit;
3. normalized query validation;
4. hashed KV cache lookup;
5. OpenAlex soft-budget check;
6. one OpenAlex lexical search;
7. Crossref search fallback if OpenAlex is unavailable/budget-blocked;
8. optional Crossref DOI enrichment of OpenAlex results;
9. hashed cache write.

### OpenAlex provider

`backend/src/research/providers/openalex.js`

`searchOpenAlex()` currently uses:

`/works?search=<query>`

and already centralizes OpenAlex normalization, timeout handling, 429/unavailable classification, and authenticated cost/credit telemetry extraction.

### Existing fallback distinction

The current OpenAlex -> Crossref search fallback is not the D-016 L fallback.

D-016 introduces an internal OpenAlex retrieval sequence:

`S semantic primary -> L lexical objective fallback`

Crossref retains its existing provider-contingency/search-fallback role only if no valid OpenAlex result path is available after that sequence. Crossref DOI enrichment remains separate from retrieval-arm selection.

## Proposed implementation shape

### 1. Feature flag / rollout boundary

Add environment-controlled mode:

`RESEARCH_SEMANTIC_PRIMARY_ENABLED`

Rules:

- absent / false: preserve current lexical-primary behavior byte-for-byte as far as externally observable retrieval orchestration allows;
- true: enable the locked S-primary path;
- initial repository/default behavior remains false until reviewed implementation is deployed to staging and explicitly enabled;
- no user/query/content-specific flagging is allowed;
- broad production enablement remains separately blocked by the D-016 capacity guardrail.

This flag is operational only; it must not inspect query text, topic, candidate content, result count, or apparent relevance.

### 2. One OpenAlex normalization/provider implementation

Refactor `searchOpenAlex(query, env, options)` to accept an explicit retrieval mode:

- `mode: 'lexical'` -> query parameter `search`
- `mode: 'semantic'` -> query parameter `search.semantic`

Everything else remains shared:

- same `/works` endpoint;
- same API key handling;
- same timeout/error parsing;
- same `normalizeOpenAlexWork()` projection;
- same evidence-level semantics;
- same cost/credit telemetry extraction.

Do not create a second semantic-specific normalization implementation.

Provider mode selection must be explicit and validated; unknown modes fail closed rather than silently becoming lexical.

### 3. Semantic candidate depth and top-10 scope

When semantic-primary is enabled:

- request semantic depth up to `min(50, configured internal candidate depth)`;
- preserve the existing external `per_page` contract, currently capped at 25 by the router;
- deduplicate the semantic candidate pool using the existing `deduplicateResearchWorks()` implementation;
- return only the requested external page size from the normalized/deduplicated semantic results;
- no deep-pagination/exhaustive-recall behavior is introduced.

No lexical result may supplement a valid semantic response merely to fill fewer-than-requested semantic results.

### 4. Valid-empty / valid-short semantics

A successful, syntactically valid OpenAlex semantic response whose `results` array is empty is a successful S response.

Consequences:

- return an empty result list under the normal contract;
- do not call lexical L;
- do not invoke Crossref search fallback solely because semantic returned zero candidates;
- record only the aggregate privacy-safe `semantic_valid_empty` counter.

The same rule applies to any valid semantic response with fewer than 10 or fewer than requested results: it is not supplemented by L or Crossref search.

Crossref DOI enrichment may operate only on returned semantic works with enrichment candidates; an empty semantic set naturally skips enrichment.

### 5. Objective-only S -> L fallback

Create one narrow classifier, e.g. `isSemanticAvailabilityFailure(error)`, used by the router.

Allowed S -> L fallback conditions:

- fetch timeout / AbortError;
- network/fetch failure;
- HTTP 429 after the permitted semantic operational handling;
- provider 5xx;
- explicitly disabled/unavailable semantic endpoint;
- HTTP-success payload that is malformed/unprocessable under the expected provider response schema.

Not allowed:

- zero results in a valid payload;
- fewer than 10 results;
- candidate content;
- apparent relevance;
- query/topic/discipline;
- comparison with lexical output;
- cost preference after a valid S response;
- any P0.5 holdout-specific condition.

The router must never execute S and L in parallel or merge their result sets.

### 6. Fallback chain preserving existing Crossref behavior

With semantic-primary enabled:

1. Attempt S.
2. If S succeeds validly, use S even if empty/short. Do not call L search.
3. If S has an allowed objective availability/validity failure, attempt L once through the same OpenAlex provider implementation.
4. If L succeeds validly, use L. Do not merge with S.
5. Only if no valid OpenAlex path is available does the existing Crossref search fallback remain eligible.
6. Crossref DOI enrichment after a valid OpenAlex path remains unchanged and is not considered retrieval fallback.

OpenAlex soft-budget behavior must be defined explicitly during implementation: budget exhaustion prevents a charged OpenAlex attempt and therefore follows the existing provider-contingency path to Crossref; it must not be represented as evidence that semantic relevance failed.

### 7. Semantic <=1 request/second pacing

A process-local timer is not sufficient because Cloudflare Worker isolates/PoPs can execute concurrently while the OpenAlex semantic limit is provider/account-wide.

Implementation therefore must use a single global serialization primitive for semantic request starts in staging rather than relying on per-isolate memory.

Preferred implementation for review:

- add a single named Durable Object binding dedicated to OpenAlex semantic pacing;
- all semantic requests acquire the same named object/gate before the provider request starts;
- the gate serializes semantic request-start permission with at least 1000 ms between starts;
- lexical fallback and Crossref enrichment/search do not consume this semantic gate;
- queue wait time and provider-call time are measured separately using aggregate telemetry;
- no query text, result content, user ID, topic, or research-interest data are written to the pacing state.

Fail-closed rule: if the semantic pacing gate itself is unavailable while semantic-primary is enabled, classify that as an objective semantic-path operational failure and permit L fallback; do not bypass the gate and call semantic directly.

The exact Durable Object implementation/binding diff must be reviewed before staging semantic-primary is enabled.

### 8. Cache identity

Current cache keys hash `{v:1, query, perPage}`. That key would allow a lexical-primary cached response to be served after semantic-primary is enabled.

Therefore bump/partition the cache key by retrieval architecture mode, for example:

`{ v:2, retrievalMode:'lexical'|'semantic-primary', query:lowercaseQuery, perPage }`

The key remains SHA-256 hashed before KV storage. Raw query text must never appear in the KV key.

No cached lexical result may masquerade as a semantic-primary result after the feature flag changes.

### 9. Privacy-safe operational telemetry

Add aggregate counters only. Suggested KV key family contains date/window plus metric name, never query/user/topic:

- semantic attempts;
- semantic successes;
- semantic valid-empty responses;
- semantic malformed responses;
- semantic timeout/network failures;
- semantic 429;
- semantic 5xx;
- L fallback attempts;
- L fallback successes;
- Crossref search fallback count;
- semantic pacing queue-wait buckets/counters;
- semantic provider-latency buckets/counters;
- charged semantic response count;
- aggregate observed semantic cost USD / credits.

No query text, normalized query, DOI/title, topic, research-interest content, user ID, email, token, or result payload is stored in these telemetry records.

Existing response-level provider telemetry may remain in the authenticated private/no-store response only if it preserves the current contract/security posture; production monitoring persistence must be aggregate-only.

### 10. D-013 checkpoint support

Telemetry must make it mechanically possible to identify the earlier of:

- 1,000 charged semantic responses; or
- 7 calendar days of enabled real semantic-primary traffic.

The implementation may record a single environment-level semantic-primary enablement timestamp and aggregate charged-response counters. It must not record which users/queries generated them.

A materially different authenticated charged cost or conflicting body/header cost observation raises the existing D-013 review signal; it must not silently rewrite pricing assumptions.

### 11. Capacity guardrail support

Broad enablement is not part of this implementation stage.

Before broad enablement, a separate operational review must document peak eligible research-query arrival rate <=0.5 requests/second using aggregate/no-query-text evidence or a conservative forecast.

Implementation telemetry should provide aggregate request counts and time-window counts needed for this calculation, without storing query text or user identity.

If the threshold is exceeded or cannot be estimated, broad enablement remains blocked even if staging implementation is technically healthy.

## Concrete code map

### Modify

`backend/src/research/providers/openalex.js`

- explicit lexical/semantic mode;
- `search` vs `search.semantic` parameter selection;
- strict payload validity check sufficient to distinguish valid empty from malformed response;
- shared normalization/telemetry/error implementation.

`backend/src/research/router.js`

- feature flag;
- S-primary orchestration;
- objective S->L fallback classifier/use;
- preserve Crossref fallback only after no valid OpenAlex path;
- mode-partitioned hashed cache key;
- valid-empty no-fallback behavior;
- aggregate operational telemetry hooks.

`backend/src/worker.js`

- export/register pacing Durable Object class only if required by Cloudflare module wiring; research endpoint contract itself remains unchanged.

`wrangler.toml`

- staging Durable Object binding/migration required for the global semantic pacing gate;
- feature flag defaults must not silently enable broad production semantic-primary;
- production binding may be provisioned disabled for parity, but production feature flag remains off until separate rollout authorization.

### Add

`backend/src/research/semantic-pacer.js`

- global semantic request-start serialization only;
- no query/user/result data persistence.

`backend/src/research/telemetry.js`

- aggregate counters/time-window metrics only;
- D-013/capacity support with no research-interest storage.

### Tests to modify/add

`test/backend/research-router.test.js`

Required cases:

1. feature flag off -> lexical `search=` path remains current behavior;
2. feature flag on -> first OpenAlex retrieval uses `search.semantic=` with unchanged query text;
3. semantic valid non-empty -> no lexical search call;
4. semantic valid empty -> 200/empty, no L and no Crossref search fallback;
5. semantic valid short -> no L supplementation;
6. semantic timeout/network -> L attempted;
7. semantic 429 -> L attempted only after permitted handling path;
8. semantic 5xx -> L attempted;
9. semantic malformed payload -> L attempted;
10. content/result count never triggers L;
11. S and L results are never merged;
12. Crossref enrichment still enriches DOI candidates after either valid S or valid L;
13. Crossref search fallback occurs only after no valid OpenAlex path;
14. query string sent to S and L remains the same normalized user query; no rewrite/injection;
15. cache is partitioned by retrieval mode and keys contain no raw query text.

`test/backend/research-fallback.test.js`

- update old OpenAlex->Crossref assumptions to cover S->L->Crossref explicitly under semantic-primary;
- retain legacy lexical-primary behavior when feature flag is off;
- budget-exhaustion semantics remain explicit and tested.

Add pacing tests, likely `test/backend/research-semantic-pacing.test.js`:

- same global gate is used for all S starts;
- >=1000 ms request-start spacing in deterministic/fake-timer tests;
- gate failure causes L fallback, not ungated S;
- no query/user data are passed to or persisted by the pacing gate.

Add telemetry tests, likely `test/backend/research-telemetry.test.js`:

- aggregate counters only;
- valid-empty/fallback reason/cost counters increment correctly;
- keys/values contain no query text, topic, DOI/title, email/user ID;
- 1,000-response / 7-day D-013 checkpoint state is derivable.

## Smoke / staging verification

After code review and tests pass, deploy with semantic-primary disabled first.

Then enable only in controlled staging and verify mechanically:

- semantic request URL uses `search.semantic` and unchanged query text;
- provider request starts respect >=1000 ms global pacing;
- a known valid-empty mocked/integration path does not call L;
- forced timeout/429/5xx/malformed conditions use L and never merge outputs;
- normal S success makes exactly one retrieval call before optional Crossref DOI enrichment;
- provider cost/credit telemetry is observed and aggregate-only persistence contains no research-interest data;
- rollback by disabling the feature flag restores lexical-primary behavior without cache contamination.

Do not use P0.5 holdouts as rollout relevance tests.

## Implementation sequencing

1. Independent reviewer accepts/modifies/rejects this plan.
2. Implement code with feature flag default/off and no broad production enablement.
3. Run unit/integration tests.
4. Independent code/diff review before semantic-primary staging enablement.
5. Deploy staging with flag off, smoke-test baseline.
6. Controlled staging enablement; mechanical operational verification only.
7. Independent staging review.
8. Capacity evidence/forecast review against <=0.5 requests/second.
9. Only then may a separate broad-production enablement decision be considered.

## Non-goals

- no H/RRF implementation in production;
- no Vectorize;
- no P0.5 relevance retuning;
- no content-dependent L/S routing;
- no deep pagination/exhaustive-recall claim;
- no storage of user research interests for monitoring;
- no broad production enablement in this implementation stage.

## Pre-implementation reviewer questions

1. Does the proposed S->L->Crossref orchestration preserve D-016 without conflating OpenAlex lexical fallback and Crossref contingency?
2. Is valid-empty behavior mechanically unambiguous?
3. Does explicit provider mode reuse the existing normalization/telemetry code path rather than fork it?
4. Is mode-partitioning the hashed cache required/sufficient to prevent stale lexical results from masquerading as semantic results?
5. Is a single named Durable Object an appropriate global serialization primitive for the provider-wide <=1 request/second semantic constraint?
6. Is pacing-gate failure correctly treated as objective S-path unavailability rather than bypassed?
7. Are fallback categories narrow enough to prevent relevance/result-dependent routing?
8. Does the telemetry plan satisfy D-013/capacity needs without storing research-interest data?
9. Is the feature-flag sequencing safe against accidental broad enablement?
10. Is any additional implementation blocker present before code changes begin?

Last updated: 2026-09-11
