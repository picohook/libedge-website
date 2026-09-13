# Reviewer Packet — DISCOVER service extraction

Status: `READY FOR REVIEW`

## Scope

Pure extraction only. Move existing research retrieval/orchestration behavior out of `backend/src/research/router.js` into `backend/src/research/discover.js` without changing retrieval policy, fallback behavior, provider calls, cache behavior, telemetry semantics, HTTP status codes, or response payloads.

## Intended boundary

- `router.js` remains responsible for HTTP concerns: auth, query validation, per-user rate limit, request metric, request parsing, and HTTP response serialization.
- `discover.js` owns the previously in-router retrieval behavior: cache selection, OpenAlex budget, lexical/semantic policy, semantic pacing, fallback, Crossref enrichment, provider metadata, and retrieval telemetry.
- `Discover(query, { env, perPage }) -> ResearchWork[]` is exported as the retrieval-independent AI-facing interface.
- `discoverResearch(...)` is the compatibility envelope used by the HTTP router so the existing response/meta contract remains unchanged.

## Behavior-change prohibition

This PR must introduce **zero retrieval behavior change**. In particular it must not:

- change lexical vs semantic selection;
- change D-016 defaults or rollout behavior;
- change semantic fallback eligibility;
- change cache keys/TTL/source selection;
- change OpenAlex/Crossref ordering or enrichment;
- change telemetry counters;
- change auth/rate-limit/query-validation behavior;
- change existing HTTP response bodies/statuses;
- add EvidencePack, LLM, grounding, or provider code.

## Test expectation

No existing research test is intentionally modified. CI must pass the existing suite unchanged, including the research router/fallback/semantic pacing/telemetry coverage already in the repository.

## Changed files

- `backend/src/research/router.js`
- `backend/src/research/discover.js` (new)
- this reviewer packet

## Decision Boundary — not authorized

This PR does **not** authorize EvidencePack implementation, grounding validator implementation, LLM/provider selection or integration, Provider Privacy Gate relaxation, D-016 changes, production migration/deployment, or reopening 0047/0049.

## Reviewer task

Verify from the exact diff that:

1. the change is extraction/refactoring only;
2. router HTTP behavior is preserved;
3. retrieval/fallback/cache/telemetry logic is materially identical after the move;
4. `Discover()` exposes `ResearchWork[]` without leaking lexical/semantic/provider branches to the caller;
5. existing exports used by tests remain available;
6. CI passes without changing existing tests.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `P05-DISCOVER-EXTRACTION-01`
Branch/ref: `refactor/discover-service-extraction`
Base: `staging`
Head: current PR head at review time.

RAW MATERIALS
[x] PR diff — exact branch diff
[x] `backend/src/research/router.js` — changed
[x] `backend/src/research/discover.js` — new full implementation
[x] Parent architecture on staging
[x] Existing tests remain authoritative and unmodified

CONSISTENCY
[x] Raw material is authoritative over this summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.
[x] Decision Boundary is explicit.
[x] No provider/model selection or production work is included.

RESULT: COMPLETE
