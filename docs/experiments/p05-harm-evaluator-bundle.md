# P0.5 Harm Evaluator Bundle

Status: `ACTIVE — FROZEN / READY FOR TWO PRIMARY BLIND RATERS`

## Scope

This record covers the blind evaluator bundle derived from the independently accepted A1/A2/A5/A6/A7 harm-regression retrieval artifact.

The exact public bundle and private mapping recorded below were first constructed as **PROVISIONAL**, then independently structurally/leakage reviewed and `ACCEPTED` before any blind-rater use. They are now promoted to **FROZEN** by governance/state update only. The builder was not rerun; seed, query order, A/B/C mapping, field set, artifact bytes, and hashes are unchanged from the reviewed provisional artifacts.

## Upstream acceptance

- Harm retrieval run: `34520257298`
- Harm retrieval artifact ID: `10169351909`
- Harm retrieval ZIP SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- Independent retrieval review: `docs/reviews/2026-09-10-p05-harm-retrieval-execution-review.md`
- Review classification: `ACCEPTED`

## Construction provenance

- Builder: `scripts/p05-build-evaluator-bundle.mjs`
- Builder parameterization commit: `14f60e4cf8c26f460ab5437ede76ea8f8fd139fd`
- Workflow: `.github/workflows/p05-build-harm-evaluator-provisional.yml`
- Workflow commit/run head: `2886d279f9659f9adf72ad0d39d1c25950605356`
- GitHub Actions run: `34521366508`
- Run conclusion: `success`

## Exact FROZEN artifacts

### Public bundle artifact

- Artifact ID: `10169773484`
- Artifact ZIP SHA-256: `63b0250c49fadb633d403cfb547f6ec2f0a92157265eebd34ca0f68dc9f706a4`
- Files: `manifest.json`, `p05-harm-evaluator-bundle.json`
- Bundle-file SHA-256: `8f4fc6b73ab10eadc9f8a2710dd4708af4b41f96ddda2eed22cd568e14aea038`

### Private mapping artifact

- Artifact ID: `10169774220`
- Artifact ZIP SHA-256: `26a76e571492326a893a9cf7606e596579e2b63c8fa8ff0c31ea872f4cd34e40`
- File: `p05-harm-evaluator-mapping.json`
- Mapping-file SHA-256: `b631edb52b79ba2f48a4a8199521a5db2f9f412be9f9a03b84264f00058f3a14`
- Seed commitment SHA-256: `3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`
- Seed itself remains private with the mapping and MUST NOT be disclosed to blind raters.

## Independent bundle review

Canonical review: `docs/reviews/2026-09-10-p05-harm-evaluator-bundle-review.md`.

Classification: `ACCEPTED` — unconditional.

Reviewer independently verified the exact public/private artifact hashes, retrieval provenance, 5×3×10 structure, mapping bijection/permutations, frozen field set, all 150 mapped projections against the accepted raw retrieval, historical intent mapping, and absence of structural retrieval-arm/provider/rank metadata leakage.

Promotion authorization explicitly required governance-only promotion of the exact reviewed bytes with no rebuild or rerandomization. No content change was requested.

## Frozen manifest facts

The artifact-internal manifest remains byte-identical to the reviewed provisional build and therefore retains its historical construction-time fields `status: PROVISIONAL` and `raterUse: PROHIBITED UNTIL PROMOTED TO FROZEN`.

Those fields are not modified because modifying the artifact would violate the exact-byte promotion authorization. The promotion condition has now been satisfied externally by this canonical governance record plus the independent ACCEPTED review. Therefore the exact public artifact is now the FROZEN evaluator bundle eligible for the two prescribed blind-rater lineages.

The reviewed manifest records:

- version: `p05-harm-evaluator-v1`
- retrieval workflow run: `34520257298`
- retrieval artifact ID: `10169351909`
- retrieval artifact SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- query count: `5`
- anonymous result lists per query: `3`
- results per list: `10`
- field set: `title`, `authors`, `publicationYear`, `publicationDate`, `venue`, `doi`, `evidenceLevel`, `abstract`

## Structural audit carried forward

No relevance judgement was performed during bundle construction or structural review.

- Public bundle contains exactly 5 anonymous queries.
- Each query contains exactly anonymous A/B/C lists.
- Each A/B/C list contains exactly 10 results.
- Private mapping contains exactly 5 query mappings and, for every anonymous query, one permutation of L/S/H across A/B/C.
- Query mapping is bijective over exactly A1/A2/A5/A6/A7.
- Every public result was mechanically compared against the corresponding accepted raw retrieval top-10 selected by the private mapping and projected through the frozen evaluator field set: `0` mismatches across `5 × 3 × 10 = 150` result records.
- Anonymous query intent matched the corresponding accepted historical intent for all 5 queries.
- Public result IDs follow anonymous `Qxx-A/B/Cxx` form; no original A1/A2/A5/A6/A7 ID is emitted as a query identifier.
- Public bundle does not contain structural implementation metadata keys/tokens exposing OpenAlex, lexical/semantic/H identity, RRF ranks, retrievalText, sourceKind, armMap, or queryMap.
- Ordinary English words such as `hybrid` and `provider` occur only inside publication abstracts and are not retrieval metadata.

## Blind-rater boundary

The exact public bundle may now be delivered to two new physically separate primary blind-rater context lineages.

Rules:

1. both raters receive the exact same FROZEN public bundle plus only its embedded rubric/instructions and minimal role instruction;
2. neither rater receives the private mapping, seed, reviewer history, fresh-gate results, prior rater labels, current-state/decisions files, or implementation discussion;
3. both complete label sets become FINAL/LOCKED before mapping opens;
4. the private mapping and seed remain sealed until both primary label sets are locked;
5. this harm slice is diagnostic only and creates no automatic production-adoption gate;
6. no disagreement in this harm diagnostic creates a third-rater trigger unless an already-frozen parent rule explicitly says otherwise; the parent protocol does not create an adoption gate here.

## Immutability

Do not rebuild, rerandomize, edit, or replace the public bundle or private mapping in response to any rater label or diagnostic result. The authoritative frozen identities are the artifact IDs and hashes recorded above.

Last updated: 2026-09-10
