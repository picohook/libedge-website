# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The D-016 staging implementation plan, follow-up, code/diff review, Durable Object migration correction, successful flag-OFF staging deployment and authenticated lexical baseline smoke are complete.

A separately authorized controlled semantic-primary staging smoke was executed after explicit human confirmation that the window contained controlled test traffic only. The smoke exposed a live semantic `429` on one of two near-concurrent requests. Per the accepted stop/rollback rule, semantic-primary was immediately rolled back to OFF and staging was successfully redeployed. No semantic retry is authorized until the pacing/observability correction is independently reviewed.

## Controlled semantic smoke incident

Canonical incident record:

`docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`

Enablement commit:

`acb418c47ae190cf6cb587c3d4903a92c92a4a0b`

Enablement deploy run `34563626451`:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

Same-commit CI run `34563626337`: PASS.

### Live authenticated near-concurrent pair

Two distinct ordinary test research requests were triggered programmatically near-concurrently in a real authenticated staging browser session. Query text is intentionally omitted from canonical operational records.

Observed:

- one request: HTTP `200`, `retrievalSource="semantic"`, `cached=false`, `10` results;
- one request: HTTP `200`, `retrievalSource="lexical"`, `cached=false`, `10` results;
- lexical result metadata preserved `openalex.fallback=true`;
- semantic stage status for the fallback request: `rate_limited`;
- lexical stage status: `ok`;
- no relevance comparison/judgment was performed.

This proves live semantic reachability and correct objective 429 -> L fallback behavior, but it does **not** prove successful live pacing enforcement.

The accepted pacing success criterion was `semantic_pacing_wait_ms_total > 0` across the near-concurrent pair (or equivalent privacy-safe direct wait observation). That metric is written internally but no currently exposed authenticated read-only path exists for the main engineering/reviewer thread. In addition, the live 429 itself requires investigation before retry.

## Immediate rollback — COMPLETE

Rollback commit:

`b99843654614c326e390a3f42e5108210e66d7c2`

Rollback deploy run `34564642518`:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

Current staging flag is again:

`RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`

Production remained false/untouched throughout.

## Pacing finding — OPEN

`OOS-D016-CODE-01` — DO grant-time vs actual provider-fetch start-time gap — is now `OPEN` rather than deferred.

OpenAlex semantic search has a hard `1 request/second` limit. The current Durable Object spaces grant timestamps by exactly `1000 ms`; the actual provider fetch starts only after the Worker receives the grant. Small grant-to-fetch timing differences can therefore make actual provider starts slightly less than 1000 ms apart. This is a plausible explanation for the observed 429 and must be resolved before retry; it is not yet claimed as the only possible cause.

## Proposed correction — REVIEW REQUIRED / NOT IMPLEMENTED

Two narrow changes are proposed:

1. increase the Durable Object minimum grant spacing from exactly `1000 ms` to `1500 ms`, preserving a stricter-than-provider-limit safety margin;
2. extend the existing super-admin read-only system-health surface to expose only allowlisted aggregate numeric research telemetry required for rollout verification, including today's semantic attempts/successes/429 count, pacing wait total, semantic charged responses, aggregate semantic cost/credits, and lexical fallback counters.

The observability path must not expose or store query text, user identity, topic, DOI/title, result bodies or research-interest content.

No code/config correction is authorized until independent review accepts/modifies/rejects this proposal.

## Previously completed baseline evidence

Canonical deployment record: `docs/reviews/2026-09-11-d016-staging-deploy-success.md`.
Canonical lexical baseline smoke: `docs/reviews/2026-09-11-d016-staging-baseline-smoke.md`.
Canonical enablement review: `docs/reviews/2026-09-11-d016-staging-enablement-review.md`.

Prior successful flag-OFF deploy run `34536345675` and same-commit CI run `34536345702` remain valid evidence for the reviewed implementation before the controlled semantic smoke.

## Accepted implementation properties still governing

- shared OpenAlex provider with explicit lexical/semantic mode;
- valid-empty/short S is valid success and does not trigger L/Crossref search;
- objective-only sequential S->L fallback; no merge/H/RRF;
- Crossref search only as final provider contingency; DOI enrichment separate;
- actual-result-source cache partitions (`semantic`, `lexical`, `crossref`);
- semantic-primary cannot be directly satisfied by lexical fallback cache;
- dual S/L failure provenance preserved separately;
- one named Durable Object semantic pacing gate;
- pacing-gate failure fails closed to L;
- aggregate-only privacy-safe telemetry;
- production semantic flag remains OFF.

## Open non-blocking / blocking findings

1. `OOS-D016-CODE-01` — grant-time vs actual provider-fetch start-time gap: `OPEN / BLOCKS SEMANTIC RETRY`.
2. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk: `ACKNOWLEDGED / DEFERRED`. Revisit if telemetry shows material cost/queue/capacity impact.
3. Wrangler declarative `exports` migration path may be revisited after a deliberate toolchain upgrade; current migration syntax remains the accepted compatibility path for Wrangler 4.86.0. `ACKNOWLEDGED / DEFERRED`.

## Locked rollout constraints still active

1. Semantic-primary is OFF until correction review/code review/redeploy/retry authorization.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts must remain constrained below the provider's `1 request/second` limit through the shared pacing gate.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second`.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.

## NEXT

1. Independent reviewer inspects the semantic smoke incident, rollback evidence, current pacer implementation and proposed two-part correction.
2. Reviewer accepts/modifies/rejects the `1500 ms` pacing margin and super-admin aggregate telemetry read path.
3. Only after acceptance may correction code be written.
4. Correction code requires independent code/diff review before deployment.
5. Deploy corrected code to staging with semantic-primary OFF and verify baseline.
6. Only after a new explicit authorization may another controlled semantic smoke occur.
7. Retry must again use two distinct near-concurrent requests and must demonstrate privacy-safe pacing wait `>0`; a new natural 429 is a stop/investigate condition.
8. Broad production enablement remains a separate later decision.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- Implementation record: `docs/architecture/p05-production-retrieval-implementation.md`
- Code review: `docs/reviews/2026-09-11-d016-code-review.md`
- Deploy failure / correction: `docs/reviews/2026-09-11-d016-staging-deploy-failure.md`
- Successful staging deploy: `docs/reviews/2026-09-11-d016-staging-deploy-success.md`
- Authenticated lexical baseline smoke: `docs/reviews/2026-09-11-d016-staging-baseline-smoke.md`
- Controlled staging enablement review: `docs/reviews/2026-09-11-d016-staging-enablement-review.md`
- Controlled semantic smoke incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
