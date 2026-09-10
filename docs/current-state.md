# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The D-016 staging implementation plan and follow-up were independently accepted. The implementation code range `d3acdb67a1b9677cf16508af804950fbbc1312f0 -> aeeafd735b9d977c67f4cdc4b95c307fc69c92d9` received independent code/diff review: `ACCEPTED`.

The reviewer authorized only staging deployment with `RESEARCH_SEMANTIC_PRIMARY_ENABLED=false` and baseline mechanical smoke verification. Semantic-primary staging enablement and broad production enablement remain unauthorized.

## Implementation / code-review status

Canonical implementation record: `docs/architecture/p05-production-retrieval-implementation.md`.
Canonical code review: `docs/reviews/2026-09-11-d016-code-review.md`.

Main-thread CI evidence:

- run `34532191233`: lint/build PASS; `22` test files / `90` tests PASS;
- run `34532297687`: PASS including `npx wrangler deploy --dry-run --env staging`.

Reviewer independently inspected the implementation and critical test logic but could not rerun the suite in the review sandbox because of an environment-specific npm/arborist failure. That verification-depth limitation is preserved in the canonical review record.

## Deployment state — FAILED BEFORE PUBLISH

The reviewed implementation has **not yet been successfully deployed to staging**.

Authorized staging deploy run `34534642824` at commit `4dc809efc9e8636d3af95e9e6a0e8c9422be257d` completed with overall `failure`:

- `Quality gate`: PASS;
- `Deploy backend to staging`: FAIL at `npx wrangler deploy --env staging`;
- `Deploy backend to production`: SKIPPED.

The Cloudflare API rejected creation of the `OPENALEX_SEMANTIC_PACER` Durable Object binding because class `OpenAlexSemanticPacer` was not provisioned through a recognized Durable Object lifecycle declaration. Wrangler `4.86.0` reported error code `10061`, requested a `new_sqlite_classes` migration, and also warned that the current top-level `[exports.OpenAlexSemanticPacer]` field is unexpected for that executable.

No new staging Worker version was published by this failed deployment. Semantic-primary remained OFF and production was untouched.

Canonical failure/correction record: `docs/reviews/2026-09-11-d016-staging-deploy-failure.md`.

## Proposed deployment-config correction — NOT YET COMMITTED TO `wrangler.toml`

The exact proposed correction is intentionally uncommitted because `wrangler.toml` is watched by the staging deployment workflow and committing it would itself start a deployment attempt.

Proposed correction:

- remove unsupported `[exports.OpenAlexSemanticPacer]` declarative lifecycle block;
- add one top-level legacy migration compatible with the repository's current Wrangler executable:
  - `tag = "v1-openalex-semantic-pacer"`;
  - `new_sqlite_classes = ["OpenAlexSemanticPacer"]`.

No runtime JavaScript, D-016 behavior, feature flag, fallback rule, pacing interval, privacy rule, cache policy or production rollout rule changes.

This correction requires independent review before commit/redeploy.

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

## Locked rollout constraints still active

1. Semantic-primary remains OFF during the authorized baseline deployment/smoke stage.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain constrained to <=1 request/second through the shared pacing gate.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented <=0.5 requests/second.
6. D-013 checkpoint remains first 1,000 charged semantic responses or 7 days, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## NEXT

1. Independent reviewer inspects `docs/reviews/2026-09-11-d016-staging-deploy-failure.md`, the actual failed run/log, and current `wrangler.toml`.
2. Reviewer accepts/modifies/rejects the exact proposed lifecycle correction.
3. Only after acceptance may the exact `wrangler.toml` correction be committed; that commit will trigger the next staging deploy attempt.
4. Verify quality/deploy jobs and actual deployed revision with semantic-primary still OFF.
5. Perform baseline mechanical smoke verification without enabling S.
6. Controlled semantic-primary staging enablement remains a later separately authorized step.
7. Broad production enablement remains a separate later decision after capacity/rollout controls.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Code review: `docs/reviews/2026-09-11-d016-code-review.md`
- Deploy failure / proposed correction: `docs/reviews/2026-09-11-d016-staging-deploy-failure.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
