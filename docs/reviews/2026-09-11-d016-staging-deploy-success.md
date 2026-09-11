# D-016 — Staging Deploy Success

Status: `ACTIVE — STAGING BASELINE DEPLOYED / SEMANTIC OFF`
Date: 2026-09-11

## Deployment

GitHub Actions run: `34536345675`
Commit deployed: `90ef63239343188f57937fbc444b0b0b978d9bde`
Worker: `libedge-api-staging`
Workers.dev URL: `https://libedge-api-staging.agursel.workers.dev`
Cloudflare Worker version ID: `7940f171-aad9-4ab9-aea8-55aac5ecb80f`

## Independently re-read GitHub Actions evidence

- Quality gate: `success`.
- Deploy backend to staging: `success`.
- Deploy backend to production: `skipped`.
- Deploy log shows `OPENALEX_SEMANTIC_PACER (OpenAlexSemanticPacer)` binding present.
- Deploy log shows `RESEARCH_SEMANTIC_PRIMARY_ENABLED ("false")`.
- Deploy log shows `RESEARCH_SEMANTIC_CANDIDATE_DEPTH ("50")`.
- Wrangler reported `Uploaded libedge-api-staging`, `Deployed libedge-api-staging triggers`, and the Worker version ID above.

The previously missing Durable Object lifecycle provisioning was therefore resolved by the reviewed migration correction.

## CI evidence on the same commit

GitHub Actions CI run: `34536345702` — `success`.

The actual CI log lists all relevant research files as executed, including:

- `test/backend/research-router.test.js` — 9 tests PASS;
- `test/backend/research-fallback.test.js` — 4 tests PASS;
- `test/backend/research-semantic-pacing.test.js` — 3 tests PASS;
- `test/backend/research-telemetry.test.js` — 3 tests PASS;
- `test/backend/research-core.test.js` — 9 tests PASS.

Overall: `22` test files PASS, `90` tests PASS. Staging Wrangler dry-run also PASS on this commit.

## Cache-version expectation

The D-016 implementation moved research cache identity from v1 to v2 actual-source partitions (`semantic`, `lexical`, `crossref`). Existing v1 cache entries are intentionally not read by the new code and are expected to expire naturally under their existing TTL. No destructive cache migration/cleanup is required.

## Remaining smoke boundary

A true baseline research smoke requires an authenticated staging request to `/api/research/search`. The main engineering session does not possess or retrieve the user's browser auth cookie/JWT, so it cannot truthfully claim a live authenticated 200 response without one browser-context request.

Until that authenticated smoke is observed, the following remain unauthorized:

- staging semantic-primary enablement;
- broad production enablement.

The required baseline smoke must confirm at minimum:

- HTTP 200;
- `meta.retrievalSource === "lexical"` while the flag remains OFF;
- non-error result rendering / plausible result count;
- no semantic path claim.

## Reviewer note

This record distinguishes deploy success from application-level authenticated smoke success. The former is established; the latter remains pending.
