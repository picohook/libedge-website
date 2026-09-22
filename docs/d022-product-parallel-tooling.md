# D-022 product-parallel tooling

This branch prepares product-side plumbing without creating or modifying the frozen D-022 H2 holdout.

## Boundary

- No H2 scenarios, evidence packs, claims, author intent, blind IDs, labels, or checker thresholds are created here.
- No production feature flag is enabled.
- No support judgment is implemented.
- Retrieval remains semantic-primary with the existing lexical/Crossref fallbacks.

## Added seam

`backend/src/research/support-check-input.js` creates a small retrieval-independent envelope from a validated `ResearchWork`.

The envelope preserves:

- work identity and title;
- abstract text when available;
- `evidence.level`;
- all `evidence.sources`;
- all `provenance`.

It intentionally excludes retrieval source, rank, cache status, and provider fallback state. This keeps a future support checker downstream of retrieval and prevents retrieval mode from becoming evidence for a claim.

## Next integration gate

Do not wire a model/provider or enable production behavior until the checker contract and privacy/provider gate are frozen. When that gate is available, the adapter can be called after retrieval/deduplication and before answer synthesis.
