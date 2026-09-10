# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before project state changes.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. The tested hybrid retrieval architecture H is rejected.

D-016 is **LOCKED** after independent architecture review (`ACCEPTED WITH MODIFICATION`) and focused follow-up review (`ACCEPTED`). Governing architecture for the existing top-10 research-result contract is semantic-primary OpenAlex retrieval (`S`) with lexical OpenAlex retrieval (`L`) retained only as objective availability fallback/rollback.

Production implementation is authorized **in staging/feature-flag form only**. Broad production enablement remains NOT authorized.

The current implementation baseline has been freshly inspected. Canonical pre-implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md` at commit `068d42e783c7b29dd0c662a5ef6924987fe5c0c2`. No production retrieval code has yet been modified for D-016; the plan is pending independent pre-implementation review.

## CLOSED — P0.5 evidence chain

- P0.5 hybrid preregistration — FROZEN before fresh holdout construction.
- Fresh 40-query holdout — FROZEN before retrieval.
- Fresh retrieval — 40 L + 40 S provider calls, zero retries/failures, `$0.080`; H mechanically constructed for 40/40.
- Fresh retrieval mechanical review — `ACCEPTED`.
- Fresh blind bundle — FROZEN; two independent primary label sets FINAL / LOCKED.
- Pre-mapping agreement diagnostic — exact `747/1200 = 62.25%`, adjacent `446/1200 = 37.17%`, extreme R<->N `7/1200 = 0.58%`; diagnostic only.
- Fresh mapping/seed reveal — commitment verified.
- Fresh Gate A/B — independently `ACCEPTED`: Gate A H-v-L PASS / PASS; Gate B H-v-S FAIL / FAIL; third rater NOT TRIGGERED; `H REJECTED`.
- Fresh S-v-L diagnostic — Rater 1 `+26.75pp`, non-worse `39/40`; Rater 2 `+25.25pp`, non-worse `37/40`; all domain and frozen key-slice means positive for both.
- Frozen S-v-L coverage regression remains `40/40` because L=100 and provider-constrained S<=50; caveat remains adjacent.
- Known fresh weak examples retained: Q08 `-10pp` for Rater 1 and Q27 `-40pp` for Rater 2.
- Seen harm diagnostic independently accepted: Rater 1 L/H/S `44/72/78%`; Rater 2 `46/72/82%`; diagnostic only.
- Automatic provider-call `push` triggers removed; retrieval workflows require explicit manual dispatch.

Canonical final experimental outcome: `docs/experiments/p05-final-outcome.md`.

## CLOSED — D-016 architecture decision

Canonical locked architecture: `docs/architecture/p05-production-retrieval-decision.md`.

Review chain:

- `docs/reviews/2026-09-10-d016-production-architecture-review.md` — `ACCEPTED WITH MODIFICATION`.
- `docs/reviews/2026-09-10-d016-production-architecture-followup-review.md` — `ACCEPTED`.

Locked architecture:

- Primary retrieval: OpenAlex corpus-level semantic retrieval S.
- Scope: existing top-10 research-result contract only.
- Query handling: existing user intent unchanged; no LLM rewrite, phrase injection, or result-dependent transformation.
- Candidate depth: provider-supported semantic depth `<=50`.
- Lexical L retained only for objective semantic-path availability/validity failures.
- Valid zero-candidate or valid short S responses do NOT trigger L fallback/supplementation.
- H is not used as primary, fallback, supplement, or reranking/fusion stage.
- Vectorize is not added without new evidence.

## CURRENT IMPLEMENTATION BASELINE — freshly inspected

### Request path

- `backend/src/worker.js` routes `GET /api/research/search` to `handleResearchRequest()` and enforces private/no-store response caching.
- `functions/api/[[path]].js` is a Pages proxy to the staging/production Workers and does not implement retrieval logic.

### Current retrieval orchestration

`backend/src/research/router.js` currently:

1. authenticates;
2. applies protected user rate limiting;
3. validates/normalizes query text;
4. uses a SHA-256 hashed KV cache;
5. checks OpenAlex soft budget;
6. performs one OpenAlex **lexical** retrieval;
7. falls back to Crossref search if OpenAlex is unavailable/budget-blocked;
8. optionally enriches DOI-bearing OpenAlex results via Crossref;
9. caches the payload.

### Current OpenAlex provider

`backend/src/research/providers/openalex.js` currently hardcodes `/works?search=<query>`; production semantic-primary is therefore not implemented yet. The provider already centralizes normalization, timeout/error classification, evidence-level construction, and cost/credit telemetry extraction.

### Important fallback distinction

The current OpenAlex -> Crossref fallback is not D-016's L fallback. The locked architecture requires the new internal sequence:

`OpenAlex S semantic primary -> OpenAlex L lexical objective fallback -> existing Crossref contingency only if no valid OpenAlex path`

Crossref DOI enrichment remains a separate enrichment stage, not a retrieval-arm selection mechanism.

## ACTIVE — pre-implementation plan review

Canonical plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`.

Planned controls include:

1. feature flag `RESEARCH_SEMANTIC_PRIMARY_ENABLED`, default/off until reviewed staging enablement;
2. one shared OpenAlex provider/normalization path with explicit `lexical` vs `semantic` mode (`search` vs `search.semantic`);
3. valid-empty/valid-short S treated as successful S with no L/Crossref search supplementation;
4. one narrow objective semantic-availability failure classifier;
5. S -> L -> Crossref contingency chain with no fusion/parallel retrieval;
6. mode-partitioned hashed cache so lexical cached responses cannot masquerade as semantic-primary responses after flag changes;
7. provider-wide semantic pacing via a single global serialization primitive, proposed as one named Durable Object rather than unsafe per-isolate timing;
8. aggregate-only telemetry for semantic success/failure, valid-empty, objective fallback, latency/queueing, capacity and D-013 cost/credit checkpoints;
9. tests for unchanged query text, `search.semantic` construction, no result-dependent fallback, no S/L merge, valid-empty behavior, pacing, cache separation, privacy-safe telemetry and rollback;
10. staging deployment with flag off first, then controlled enablement only after independent code/diff review.

## Mandatory locked rollout constraints

1. **Objective-only L fallback.** Allowed for timeout/network failure, 429 after permitted handling, provider 5xx, semantic endpoint unavailable/disabled, malformed/unprocessable provider response, or failure of the mandatory semantic pacing gate. Never content/result-dependent.
2. **Valid-empty semantics.** HTTP-success + syntactically valid zero-candidate S response is returned as valid empty semantic result and does not trigger L/Crossref search fallback.
3. **Provider pacing.** Treat semantic search as `<=1 request/second` until new provider evidence changes the constraint.
4. **Pre-broad-enable capacity guardrail.** Aggregate/no-query-text evidence or conservative forecast must show peak eligible research-query arrival rate `<=0.5 requests/second`; otherwise broad enablement remains blocked.
5. **D-013 checkpoint.** Review aggregate authenticated cost/credit telemetry after the first `1,000` charged semantic responses or `7 calendar days` of enabled real traffic, whichever occurs first.
6. **Privacy.** Capacity/cost/availability telemetry must not store query text, topics, research interests, result content, or user IDs.
7. **No relevance retuning.** P0.5 holdouts/labels may not be used to retune rollout relevance behavior.
8. **Top-10 scope only.** No deep-pagination/exhaustive-recall superiority claim is authorized.

## NEXT

1. Independent reviewer inspects the complete pre-implementation plan against the locked D-016 architecture and current source files.
2. If accepted, implement the reviewed plan in staging with feature flag default/off.
3. Run unit/integration tests before semantic-primary enablement.
4. Obtain independent code/diff review.
5. Deploy staging with flag off, verify baseline, then controlled feature-flag enablement.
6. Verify mechanical operational invariants; do not reuse P0.5 holdouts as rollout relevance tests.
7. Obtain independent staging review.
8. Separately satisfy the `<=0.5 requests/second` capacity guardrail before any broad production enablement decision.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Conditional/global lexical phrase heuristics rejected in P0.5-A.
- Reranking restricted to lexical candidates.
- Frozen H RRF architecture as a production candidate.
- Frozen P0.5 labels, mappings, gate calculations or harm diagnostic.
- Result-dependent L/S switching.
- Vectorize before evidence shows provider semantic retrieval is insufficient for product requirements, including capacity/availability requirements.

## Evaluation / governance invariants

- Reviewer packets include raw materials and permit proposal-external findings.
- Blind evaluator outputs remain immutable once FINAL / LOCKED.
- Seen diagnostic data are not reused as a fresh gate set.
- H experimental disposition and S production adoption remain separate decisions.
- D-017 sequencing remains active for future irreversible derived artifacts.

## Privacy invariants

1. Never claim more evidence than actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Institutional analytics, if implemented, use aggregate counters only; no stored queries, topics, or user IDs.
4. Cost/rate/capacity telemetry must not add stored query text or research-interest content.

## Canonical records

- Decisions: `docs/decisions.md`
- Current state: `docs/current-state.md`
- Retrieval architecture overview: `docs/architecture/research-retrieval.md`
- Locked production architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Staging implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
- D-016 architecture review: `docs/reviews/2026-09-10-d016-production-architecture-review.md`
- D-016 follow-up acceptance: `docs/reviews/2026-09-10-d016-production-architecture-followup-review.md`
- Final P0.5 outcome: `docs/experiments/p05-final-outcome.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
