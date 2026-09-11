# D-016 — Staging Baseline Smoke Verification

Status: `COMPLETE — FLAG OFF BASELINE OBSERVED`
Date: 2026-09-11
Environment: `staging`
Related deploy run: `34536345675`
Deployed commit: `90ef63239343188f57937fbc444b0b0b978d9bde`
Worker version: `7940f171-aad9-4ab9-aea8-55aac5ecb80f`

## Purpose

Verify the deployed staging research endpoint behaves as the pre-D-016 lexical baseline while `RESEARCH_SEMANTIC_PRIMARY_ENABLED=false`, before any controlled semantic-primary staging enablement is requested.

This is an operational/mechanical smoke check only. It is not a relevance evaluation and does not reopen P0.5.

## Authenticated browser-context observation

A real authenticated staging browser session issued one request to `/api/research/search` with `per_page=10` while the semantic-primary flag remained OFF.

Observed response summary:

- HTTP status: `200`;
- `meta.retrievalSource`: `lexical`;
- `meta.cached`: `false`;
- result count: `10`;
- provider metadata object present;
- no semantic-primary claim/path observed in the returned summary.

The actual query text is intentionally not recorded in this canonical operational record, consistent with the research-privacy invariant against storing research-interest content in operational telemetry/governance artifacts.

## Deployment/CI evidence adjacent to this smoke

GitHub Actions deploy run `34536345675`:

- `Quality gate`: PASS;
- `Deploy backend to staging`: PASS;
- `Deploy backend to production`: SKIPPED.

The deploy log shows:

- `env.OPENALEX_SEMANTIC_PACER (OpenAlexSemanticPacer)` bound as a Durable Object;
- `RESEARCH_SEMANTIC_PRIMARY_ENABLED ("false")`;
- `RESEARCH_SEMANTIC_CANDIDATE_DEPTH ("50")`;
- deployed Worker URL `https://libedge-api-staging.agursel.workers.dev`;
- Worker version ID `7940f171-aad9-4ab9-aea8-55aac5ecb80f`.

Same-commit CI run `34536345702` passed and its log explicitly lists `22` test files / `90` tests PASS, including:

- `test/backend/research-router.test.js`;
- `test/backend/research-fallback.test.js`;
- `test/backend/research-semantic-pacing.test.js`;
- `test/backend/research-telemetry.test.js`;

and staging Wrangler dry-run PASS.

## Cache-version note

The first authenticated baseline smoke returned `cached:false`, which is expected immediately after the v2 actual-source cache-key rollout. Old v1 entries are intentionally not read and expire naturally under their existing TTL. No destructive cache migration is required.

## Durable Object verification boundary

The successful staging deploy proves the Durable Object class migration and binding were accepted by Cloudflare and the binding is present in the deployed Worker configuration. Because semantic-primary remains OFF, the normal research path intentionally does not invoke the pacing Durable Object during this baseline smoke.

Therefore this baseline does **not** claim a live `/gate` invocation has yet occurred. The first authorized controlled semantic-primary staging call will be the live end-to-end proof that the deployed Worker can invoke the pacing Durable Object and then reach the semantic provider under the locked pacing path.

## Runtime-error boundary

No browser-visible runtime exception or API error was observed during the authenticated baseline request. This record does not claim independent access to Cloudflare tail logs beyond the deploy/CI evidence already captured.

## Decision boundary

This baseline smoke closes only the flag-OFF deployment verification step.

It does NOT authorize:

- changing `RESEARCH_SEMANTIC_PRIMARY_ENABLED` to true;
- broad production enablement;
- relevance retuning;
- H/RRF;
- Vectorize;
- weakening pacing, fallback, cache, cost or privacy invariants.

The next step is independent review of the deploy + CI + authenticated baseline smoke evidence before any controlled semantic-primary staging enablement.
