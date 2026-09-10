# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The pre-implementation plan received `ACCEPTED WITH MODIFICATION`, the required cache/failure-provenance corrections were incorporated, and the focused follow-up review returned `ACCEPTED — unconditional`.

D-016 staging implementation code is now written behind `RESEARCH_SEMANTIC_PRIMARY_ENABLED=false` and is **PENDING INDEPENDENT CODE/DIFF REVIEW**. Semantic-primary is not enabled in staging or production. Broad production enablement remains unauthorized.

## Implementation head

Canonical implementation record: `docs/architecture/p05-production-retrieval-implementation.md`.

Code-review range:

`d3acdb67a1b9677cf16508af804950fbbc1312f0 -> aeeafd735b9d977c67f4cdc4b95c307fc69c92d9`

Runtime implementation includes:

- shared OpenAlex provider with explicit `lexical` / `semantic` mode;
- `search.semantic` only when the semantic-primary flag is on;
- valid-empty/valid-short S success with no L/Crossref supplementation;
- objective-only S->L fallback;
- sequential S/L with no merge;
- Crossref search only as final provider contingency; DOI enrichment remains separate;
- actual-result-source cache partitions (`semantic`, `lexical`, `crossref`);
- semantic-primary direct cache reads only from semantic partition;
- lexical cache usable only after the current S attempt objectively fails;
- structured dual S/L failure provenance;
- single named Durable Object semantic pacing gate with >=1000 ms request-start grants;
- aggregate-only telemetry with no query/user/topic/result persistence;
- feature flag explicitly `false` in local, staging and production config.

## Mechanical verification completed

CI run `34532191233` at `9f3fe18aa11ba8489c8c116ea5673dfa4ff3d21d`:

- lint: PASS;
- unit tests: PASS;
- `22` test files / `90` tests PASS;
- CSS build: PASS.

CI run `34532297687` at `aeeafd735b9d977c67f4cdc4b95c307fc69c92d9` additionally validates staging Wrangler configuration using a dry-run deploy: PASS.

No semantic-primary provider traffic was enabled by these commits.

## Locked rollout constraints still active

1. Feature flag remains OFF until independent implementation code/diff review is accepted.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain constrained to <=1 request/second through the shared pacing gate.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented <=0.5 requests/second.
6. D-013 checkpoint remains first 1,000 charged semantic responses or 7 days, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## NEXT

1. Independent reviewer inspects full code diff and implementation record.
2. Reviewer classifies implementation `ACCEPTED`, `ACCEPTED WITH MODIFICATION`, or `REJECTED` plus OOS findings.
3. Only after accepted code review may the implementation be deployed/verified in staging with the semantic flag still OFF.
4. Controlled semantic-primary staging enablement is a subsequent step; mechanical operational verification follows.
5. Broad production enablement remains a separate later decision after the locked capacity/rollout controls are satisfied.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Pre-implementation review: `docs/reviews/2026-09-11-d016-preimplementation-review.md`
- Pre-implementation follow-up acceptance: `docs/reviews/2026-09-11-d016-preimplementation-followup-review.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
