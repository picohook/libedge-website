# P0.5 Harm Evaluator Bundle

Status: `ACTIVE — PROVISIONAL / PENDING INDEPENDENT STRUCTURAL REVIEW`

## Scope

This record covers the blind evaluator bundle derived from the independently accepted A1/A2/A5/A6/A7 harm-regression retrieval artifact.

This bundle is **PROVISIONAL**. It MUST NOT be delivered to any blind rater and MUST NOT be represented as FROZEN until the exact artifacts recorded below receive independent structural/leakage review acceptance. After acceptance, promotion to FROZEN must preserve the exact public bundle and private mapping bytes/hashes; no rebuild or rerandomization is permitted.

## Upstream acceptance

- Harm retrieval run: `34520257298`
- Harm retrieval artifact ID: `10169351909`
- Harm retrieval ZIP SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- Independent retrieval review: `docs/reviews/2026-09-10-p05-harm-retrieval-execution-review.md`
- Review classification: `ACCEPTED`

## Provisional construction provenance

- Builder: `scripts/p05-build-evaluator-bundle.mjs`
- Builder parameterization commit: `14f60e4cf8c26f460ab5437ede76ea8f8fd139fd`
- Workflow: `.github/workflows/p05-build-harm-evaluator-provisional.yml`
- Workflow commit/run head: `2886d279f9659f9adf72ad0d39d1c25950605356`
- GitHub Actions run: `34521366508`
- Run conclusion: `success`

## Exact provisional artifacts

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

## Manifest invariants

The provisional manifest records:

- version: `p05-harm-evaluator-v1`
- status: `PROVISIONAL`
- retrieval workflow run: `34520257298`
- retrieval artifact ID: `10169351909`
- retrieval artifact SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- query count: `5`
- anonymous result lists per query: `3`
- results per list: `10`
- field set: `title`, `authors`, `publicationYear`, `publicationDate`, `venue`, `doi`, `evidenceLevel`, `abstract`
- rater use: `PROHIBITED UNTIL PROMOTED TO FROZEN`

## Implementer structural audit

No relevance judgement was performed.

- Public bundle contains exactly 5 anonymous queries.
- Each query contains exactly anonymous A/B/C lists.
- Each A/B/C list contains exactly 10 results.
- Private mapping contains exactly 5 query mappings and, for every anonymous query, one permutation of L/S/H across A/B/C.
- Query mapping is bijective over exactly A1/A2/A5/A6/A7.
- Every public result was mechanically compared against the corresponding accepted raw retrieval top-10 selected by the private mapping and projected through the frozen evaluator field set: `0` mismatches across `5 × 3 × 10 = 150` result records.
- Anonymous query intent matched the corresponding accepted historical intent for all 5 queries.
- Public result IDs follow anonymous `Qxx-A/B/Cxx` form; no original A1/A2/A5/A6/A7 ID is emitted as a query identifier.
- Public bundle does not contain the obvious implementation metadata tokens/keys `OpenAlex`, `lexical`, `semantic`, `RRF`, `lRank`, `sRank`, `retrievalText`, `sourceKind`, `armMap`, or `queryMap`.
- Occurrences of ordinary English words `hybrid` and `provider` were inspected and occur only inside publication abstracts (for example, “hybrid learning model” and “provider of open distance learning”), not as retrieval-arm/provider metadata.
- Bundle-file hash, mapping-file hash, and seed commitment independently recomputed from downloaded artifacts exactly match the manifest.

## Freeze rule

Independent reviewer must inspect the exact provisional public bundle, private mapping, upstream retrieval artifact, builder parameterization and workflow provenance.

If classification is `ACCEPTED`, this exact artifact pair may be promoted to FROZEN by governance/state update only. Promotion MUST NOT rerun the builder, regenerate the seed, alter query ordering, alter A/B/C mappings, alter fields, or change any public/private artifact bytes.

If review requires any content change, the current provisional pair remains historical/non-rater-eligible and a new provisional artifact pair must be constructed and separately reviewed before freeze.

## Blind-rater boundary

Only after exact-artifact promotion to FROZEN:

1. two new physically separate blind-rater context lineages receive the same frozen public bundle plus its embedded rubric/instructions;
2. neither lineage receives the private mapping, seed, reviewer history, fresh-gate results, prior rater labels, or implementation discussion;
3. both complete label sets are FINAL/LOCKED before mapping opens;
4. this harm slice is diagnostic only and creates no automatic production-adoption gate.

Last updated: 2026-09-10
