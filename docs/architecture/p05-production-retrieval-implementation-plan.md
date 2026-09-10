# D-016 — Semantic-Primary Retrieval Staging Implementation Plan

Status: `ACTIVE — MODIFIED AFTER INDEPENDENT PRE-IMPLEMENTATION REVIEW / PENDING FOLLOW-UP ACCEPTANCE`
Governing decision: `docs/decisions.md` D-016 (`LOCKED`)
Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
Review provenance: `docs/reviews/2026-09-11-d016-preimplementation-review.md`
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

#### Dual OpenAlex failure provenance

The current `crossrefFallback(query, env, perPage, openAlexError)` helper accepts one OpenAlex error. Under S -> L -> Crossref, two distinct OpenAlex failures may exist.

Implementation must not arbitrarily collapse them into one misleading provider status. When both S and L fail, the router must retain structured, privacy-safe failure provenance sufficient to distinguish at least:

- semantic failure status/reason category; and
- lexical fallback failure status/reason category.

No raw provider error body, query text, user identity, or result content may be exposed or persisted for this purpose.

The external response may represent these as separate nested statuses or as one explicit OpenAlex-path summary with separate semantic/lexical subfields, but code review must verify that the final representation cannot falsely imply that only one arm was attempted or that one failure represents the whole path.

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

### 8. Cache identity and actual-result provenance

Current cache keys hash `{v:1, query, perPage}`. That key would allow a lexical-primary cached response to be served after semantic-primary is enabled.

A feature-flag/request-mode partition alone is also insufficient. If semantic-primary is enabled but S fails objectively and L succeeds, caching that response under a generic `semantic-primary` key would allow a transient lexical fallback result to masquerade as semantic output for the cache TTL.

Therefore cache identity must reflect the **actual OpenAlex arm that produced the cached result**, not merely the feature-flag state.

Required cache provenance classes:

- `semantic` — only a valid S result, including valid-empty/valid-short S;
- `lexical` — only a valid L result, whether lexical-primary or objective semantic fallback;
- `crossref` — only a Crossref search-contingency result when no valid OpenAlex path exists, if such responses remain cacheable.

The key remains SHA-256 hashed before KV storage and must include the actual source class, e.g.:

`{ v:2, retrievalSource:'semantic'|'lexical'|'crossref', query:lowercaseQuery, perPage }`

#### Read policy under semantic-primary

A semantic-primary request may read only a `semantic` cache entry as a direct success.

It MUST NOT treat a cached `lexical` fallback entry as if S had succeeded. Therefore an L fallback result produced during a prior transient S failure cannot suppress a future semantic attempt merely because that lexical entry is still within TTL.

If the current request's S attempt fails objectively, the router may then use an eligible cached `lexical` entry for the L fallback stage instead of issuing a new lexical provider call, provided the response metadata still records that the current path was semantic failure -> lexical fallback and does not represent the cached lexical result as semantic.

Likewise, Crossref contingency cache may be consulted only after no valid OpenAlex path remains; it cannot short-circuit a fresh semantic-primary request.

#### Read policy with semantic-primary disabled

A lexical-primary request may read only the `lexical` cache partition as its primary retrieval cache. It must not serve a `semantic` entry as if lexical-primary had produced it.

Raw query text must never appear in the KV key; the complete cache-identity object remains hashed.

This policy prevents both stale lexical-primary contamination after flag enablement and transient lexical-fallback contamination during semantic-primary operation.

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

Implementation should reuse the existing `budget.js` pattern where practical: date/window-scoped KV keys, aggregate numeric values, and bounded TTLs rather than introducing a separate privacy model.

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
- cache read/write partitioned by actual retrieval source, not flag state;
- dual S/L OpenAlex failure provenance for the final Crossref contingency path;
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
15. semantic-primary cache read cannot be satisfied by a lexical fallback cache entry;
16. after a fresh objective S failure, an eligible lexical cache entry may satisfy only the L fallback stage and is still reported as lexical fallback;
17. flag-off lexical-primary reads lexical cache only;
18. semantic and lexical valid results write to their actual-source partitions;
19. Crossref contingency does not short-circuit semantic-primary;
20. cache keys contain no raw query text;
21. dual S/L failure metadata remains distinguishable when Crossref contingency is used.

`test/backend/research-fallback.test.js`

- update old OpenAlex->Crossref assumptions to cover S->L->Crossref explicitly under semantic-primary;
- retain legacy lexical-primary behavior when feature flag is off;
- budget-exhaustion semantics remain explicit and tested;
- when S and L both fail, final response/provider metadata does not collapse the two attempts into one misleading error.

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
- a prior lexical fallback cache entry never suppresses a later semantic-primary attempt;
- dual S/L failure provenance remains distinguishable if Crossref contingency is reached;
- provider cost/credit telemetry is observed and aggregate-only persistence contains no research-interest data;
- rollback by disabling the feature flag restores lexical-primary behavior without cache contamination.

Do not use P0.5 holdouts as rollout relevance tests.

## Implementation sequencing

1. Focused independent reviewer accepts/modifies/rejects these pre-code plan corrections.
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

## Focused pre-implementation follow-up questions

1. Does actual-result-source cache partitioning prevent a transient lexical fallback from masquerading as semantic output or suppressing future S attempts?
2. Is the staged cache read policy compatible with D-016 objective-only fallback semantics?
3. Does the dual-failure provenance requirement correctly address S+L failure before Crossref contingency without exposing raw errors/research-interest data?
4. With these corrections, may implementation begin?

Last updated: 2026-09-11
