# P0.5 Hybrid Semantic Retrieval — Frozen Blind Evaluator Bundle

Status: `ACTIVE`
Qualifier: `BUNDLE FROZEN — MAPPING SEALED — LABELS NOT YET COLLECTED`
Frozen: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Retrieval record: `docs/experiments/p05-hybrid-semantic-retrieval.md`

## Freeze provenance

- Bundle-build workflow run: `34499706628` (`P0.5 Build Frozen Evaluator Bundle`)
- Workflow head commit: `71b5841a84d3a232d9a133e6ff3424df826f9e17`
- Bundle-builder commit: `1712d86506b60f552de324b2b7e4f15d8d14703d`
- Frozen retrieval source workflow run: `34498804224`
- Frozen retrieval artifact ID: `10161068719`
- Frozen retrieval artifact SHA-256: `79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8`

## Public blind-evaluator artifact

- Artifact name: `p05-evaluator-bundle-public`
- Artifact ID: `10161315961`
- Artifact ZIP SHA-256: `8dc05dfb4db48fbd109b29b166e435367859fe979caf3874412aa18a94f4f566`
- Artifact expiry: `2026-10-10T16:04:14Z`
- Files: `p05-evaluator-bundle.json`, `manifest.json`
- Bundle file SHA-256: `a39f172b249dd8fd1b1b97598257fb936a81e3da40e77bc21af9609373330624`
- Bundle version: `p05-fresh-evaluator-v1`
- Shape: exactly `40` anonymous queries × `3` anonymous result lists × `10` results = `1,200` result items.

### Frozen evaluator-visible field set

Every result exposes only:

1. `title`
2. `authors`
3. `publicationYear`
4. `publicationDate`
5. `venue`
6. `doi`
7. `evidenceLevel`
8. `abstract`

Operational/provider fields, OpenAlex identifiers, RRF scores, original arm names, internal provenance, citation counts, open-access metadata, and source URLs are not part of the evaluator-visible field set.

Each query is assigned an anonymous `Q01`–`Q40` identifier. Original holdout IDs/domain prefixes are not exposed. The three retrieval arms are independently randomized per query behind anonymous `A/B/C` list aliases. Within each list, the frozen top-10 ranking order is preserved.

## Private mapping artifact — SEALED

- Artifact name: `p05-evaluator-mapping-private`
- Artifact ID: `10161316449`
- Artifact ZIP SHA-256: `7b5711d74705ed31ba6820e0c518818e53262f79505c9b35f4b45bf4101f6cde`
- Artifact expiry: `2026-10-10T16:04:15Z`
- Mapping file: `p05-evaluator-mapping.json`
- Mapping file SHA-256: `defd6b39361dff452a826966769b680254d2bc43924143a52cfe2af7ed0b6b0c`
- Randomization-seed commitment SHA-256: `388813fddbb0d2519baafa62cbc28af7e82f3a0cd665314c61ed4c1ddf801bd1`

The private mapping contains 40 anonymous-query mappings and 40 per-query anonymous-arm mappings. Its values are intentionally not reproduced in this canonical record. The mapping MUST remain undisclosed to both primary blind raters until both have independently locked all labels.

## Mechanical freeze audit

The generated public artifact was independently checked after workflow completion:

- exactly two public files are present;
- `p05-evaluator-bundle.json` hashes exactly to the manifest's frozen bundle SHA-256;
- all 40 queries contain exactly A/B/C lists with exactly 10 results each;
- every result contains the same frozen bibliographic/evidence field set plus anonymous result ID/rank;
- original `ME/BM/SS/HU` holdout IDs are absent;
- L/S/H arm labels, OpenAlex/provider metadata, RRF values and L/S source-rank fields are absent;
- occurrences of the ordinary word “provider” within article abstract text are source content, not retrieval-provider metadata;
- private mapping-file hash and seed commitment independently match the public manifest.

No relevance label had been collected when this bundle was frozen.

## Evaluator protocol boundary

Both primary blind raters must receive the exact same public bundle, in physically separate fresh context lineages, together with only the frozen R/M/N rubric and evaluator instructions embedded in the bundle. Neither rater may receive the private mapping, provider identity, prior gate results, prior P0.5-A history, expected winner, implementation discussion, or the other rater's output.

The mapping may be opened only after BOTH primary raters have locked all labels. A third blind rater is requested only if the resulting Gate A or Gate B binary disposition differs between the two primary raters, under the parent preregistration.

## Next permitted operation

Deliver the exact frozen public artifact to primary blind rater 1 and primary blind rater 2 in separate fresh lineages and collect/lock both complete label sets. Do not open the private mapping before both sets are locked.

Last updated: 2026-09-10
