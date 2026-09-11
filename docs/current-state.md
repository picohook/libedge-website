# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The D-016 staging implementation plan, follow-up, code/diff review, Durable Object migration correction, successful staging deployment and authenticated flag-OFF baseline smoke are complete.

Semantic-primary staging enablement and broad production enablement remain unauthorized pending the next independent review.

## Successful staging baseline deployment

Canonical deployment record: `docs/reviews/2026-09-11-d016-staging-deploy-success.md`.
Canonical baseline smoke record: `docs/reviews/2026-09-11-d016-staging-baseline-smoke.md`.

Deployment run `34536345675` at commit `90ef63239343188f57937fbc444b0b0b978d9bde`:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

Cloudflare deployment evidence:

- Worker: `libedge-api-staging`;
- URL: `https://libedge-api-staging.agursel.workers.dev`;
- Worker version ID: `7940f171-aad9-4ab9-aea8-55aac5ecb80f`;
- Durable Object binding `OPENALEX_SEMANTIC_PACER (OpenAlexSemanticPacer)` present;
- `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`;
- `RESEARCH_SEMANTIC_CANDIDATE_DEPTH="50"`.

Same-commit CI run `34536345702` PASS. The actual CI log lists `22` test files / `90` tests PASS, including research router/fallback/semantic-pacing/telemetry suites, and staging Wrangler dry-run PASS.

## Authenticated baseline smoke — COMPLETE

A real authenticated staging browser session issued one `/api/research/search` request with `per_page=10` while semantic-primary remained OFF.

Observed summary:

- HTTP `200`;
- `meta.retrievalSource === "lexical"`;
- `meta.cached === false`;
- result count `10`;
- provider metadata present;
- no browser-visible API/runtime error.

The exact query text is intentionally omitted from canonical operational records under the research-privacy invariant.

This proves the deployed flag-OFF request path remains lexical in the live authenticated staging environment.

## Cache-version expectation

The implementation uses research cache v2 actual-source partitions. Existing v1 cache entries are intentionally orphaned from reads and may expire naturally under the prior TTL. The observed first smoke `cached:false` is expected after this version transition. No destructive cache migration is required.

## Durable Object verification boundary

The successful deploy log proves Cloudflare accepted the Durable Object migration/binding and deployed `OPENALEX_SEMANTIC_PACER` with the Worker. Because semantic-primary remains OFF, baseline traffic intentionally does not invoke the pacing object.

No claim is made that a live pacing-gate invocation has occurred yet. The first separately authorized controlled semantic-primary staging call must verify the live gate→semantic-provider path end to end.

## Accepted implementation properties

- shared OpenAlex provider with explicit lexical/semantic mode;
- valid-empty/short S is valid success and does not trigger L/Crossref search;
- objective-only sequential S->L fallback; no merge/H/RRF;
- Crossref search only as final provider contingency; DOI enrichment separate;
- actual-result-source cache partitions (`semantic`, `lexical`, `crossref`);
- semantic-primary cannot be directly satisfied by lexical fallback cache;
- dual S/L failure provenance preserved separately;
- one named Durable Object semantic pacing gate with >=1000 ms grant spacing;
- pacing-gate failure fails closed to L;
- aggregate-only privacy-safe telemetry;
- `RESEARCH_SEMANTIC_PRIMARY_ENABLED=false` in local/staging/production configuration.

## Open non-blocking implementation findings

1. `OOS-D016-CODE-01` — DO grant-time vs actual provider-fetch start-time gap: `ACKNOWLEDGED / DEFERRED`. Revisit if measured operation or higher-capacity needs show insufficient pacing margin.
2. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk: `ACKNOWLEDGED / DEFERRED`. Revisit if telemetry shows material cost/queue/capacity impact.
3. Wrangler declarative `exports` migration path may be revisited after a deliberate toolchain upgrade; current migration syntax is the accepted compatibility path for Wrangler 4.86.0. `ACKNOWLEDGED / DEFERRED`.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until the next independent authorization.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain constrained to <=1 request/second through the shared pacing gate.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented <=0.5 requests/second.
6. D-013 checkpoint remains first 1,000 charged semantic responses or 7 days, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## NEXT

1. Independent reviewer verifies deploy run `34536345675`, CI run `34536345702`, and `docs/reviews/2026-09-11-d016-staging-baseline-smoke.md`.
2. Reviewer accepts/modifies/rejects a narrowly scoped controlled semantic-primary staging enablement proposal.
3. Only after acceptance may the staging feature flag be changed to true for controlled operational verification.
4. The first authorized semantic call must verify the live pacing-gate path, semantic retrieval source, cost/credit telemetry and privacy-safe operational behavior.
5. Broad production enablement remains a separate later decision after capacity/rollout controls.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Code review: `docs/reviews/2026-09-11-d016-code-review.md`
- Deploy failure / correction: `docs/reviews/2026-09-11-d016-staging-deploy-failure.md`
- Successful staging deploy: `docs/reviews/2026-09-11-d016-staging-deploy-success.md`
- Authenticated baseline smoke: `docs/reviews/2026-09-11-d016-staging-baseline-smoke.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
