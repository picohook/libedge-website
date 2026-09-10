# D-016 — Semantic-Primary Retrieval Staging Implementation

Status: `ACTIVE — IMPLEMENTED / FLAG OFF / PENDING INDEPENDENT CODE REVIEW`
Governing decision: `docs/decisions.md` D-016 (`LOCKED`)
Implementation plan: `docs/architecture/p05-production-retrieval-implementation-plan.md`
Follow-up plan review: `docs/reviews/2026-09-11-d016-preimplementation-followup-review.md` (`ACCEPTED`)
Implementation head: `aeeafd735b9d977c67f4cdc4b95c307fc69c92d9`
Code-review base: `d3acdb67a1b9677cf16508af804950fbbc1312f0`

## Implemented scope

The staging code now contains the D-016 semantic-primary path behind `RESEARCH_SEMANTIC_PRIMARY_ENABLED`, which is explicitly `false` in local, staging, and production Wrangler vars.

Implemented code path:

- flag OFF: existing OpenAlex lexical-primary behavior remains the active path;
- flag ON: OpenAlex semantic S is attempted first through `search.semantic`;
- valid S success, including empty/short results, is returned without L supplementation;
- only objective semantic availability/validity failures permit lexical L fallback;
- S and L are sequential and never merged;
- Crossref search remains final contingency after no valid OpenAlex path; DOI enrichment remains separate.

## Changed runtime files

- `backend/src/research/providers/openalex.js`
  - explicit `lexical` / `semantic` mode;
  - shared normalization/error/telemetry path;
  - strict malformed-payload distinction from valid empty results.
- `backend/src/research/router.js`
  - flag-controlled S-primary orchestration;
  - narrow semantic availability-failure classifier;
  - actual-result-source cache partitions (`semantic`, `lexical`, `crossref`);
  - semantic-primary cache read rules preventing stale lexical fallback from suppressing a later S attempt;
  - dual S/L failure provenance;
  - aggregate-only telemetry hooks.
- `backend/src/research/semantic-pacer.js`
  - one named Durable Object request-start gate;
  - at least 1000 ms between semantic grants;
  - no query/user/result data sent to or stored by the gate;
  - pacing failure fails closed to the router's objective L fallback path.
- `backend/src/research/telemetry.js`
  - allowlisted date-scoped aggregate counters only;
  - cost/credit aggregation for D-013 support.
- `backend/src/worker.js`
  - exports `OpenAlexSemanticPacer` Durable Object class.
- `wrangler.toml`
  - semantic-primary flag remains `false` in all environments;
  - semantic candidate depth `50`;
  - `OPENALEX_SEMANTIC_PACER` binding;
  - SQLite-backed Durable Object export.

## Cache semantics

Cache identity is SHA-256 over a v2 object including actual `retrievalSource`, lowercased normalized query, and page size. Raw query text is not present in the KV key.

Direct reads:

- flag OFF -> lexical partition only;
- semantic-primary -> semantic partition only.

After a current semantic objective failure, the lexical partition may be consulted as the L fallback stage. A prior lexical-fallback cache entry cannot suppress a new semantic attempt. Crossref cache is considered only after no valid OpenAlex path remains.

## Failure provenance

When semantic and lexical OpenAlex attempts both fail before Crossref contingency, response metadata preserves separate privacy-safe semantic and lexical stage statuses. Raw error bodies, query text, user identity, topic and result content are not persisted for this purpose.

## Tests / CI

Added or expanded tests cover:

- lexical flag-off baseline;
- semantic request construction and unchanged normalized query;
- valid-empty no-fallback;
- malformed/objective failure to L;
- no S/L merge;
- actual-source cache partitioning;
- stale lexical fallback cannot suppress later S;
- lexical cache allowed only after current S failure;
- dual S/L failure provenance before Crossref;
- Crossref cannot short-circuit valid S;
- pacing serialization and fail-closed behavior;
- aggregate-only telemetry privacy.

CI run `34532191233` at implementation head `9f3fe18aa11ba8489c8c116ea5673dfa4ff3d21d` completed successfully with `22` test files / `90` tests passing, plus lint, syntax and CSS build.

A subsequent CI hardening commit adds `npx wrangler deploy --dry-run --env staging`; run `34532297687` at final review head `aeeafd735b9d977c67f4cdc4b95c307fc69c92d9` completed successfully, including the Wrangler staging configuration dry-run.

## Review boundary

Semantic-primary remains disabled. No staging semantic-primary enablement is authorized until an independent reviewer inspects the complete code diff `d3acdb67... -> aeeafd735...` and accepts it. Broad production enablement remains separately unauthorized.
