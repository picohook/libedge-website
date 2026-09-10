# P0.5 Harm Evaluator Bundle Review

Status: `HISTORICAL — REVIEW COMPLETE / ACCEPTED`

## Scope

Independent structural/leakage review of the exact PROVISIONAL P0.5 harm evaluator public bundle and private mapping derived from the independently accepted A1/A2/A5/A6/A7 harm retrieval artifact.

This review authorizes governance-only promotion of the exact reviewed artifact pair to FROZEN. It does not authorize rebuild, rerandomization, seed regeneration, query reordering, mapping changes, field changes, or any byte-level modification of the reviewed artifacts.

## Reviewed provenance

- Upstream harm retrieval run: `34520257298`
- Upstream harm retrieval artifact ID: `10169351909`
- Upstream retrieval ZIP SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- Provisional bundle build run: `34521366508`
- Build head: `2886d279f9659f9adf72ad0d39d1c25950605356`
- Shared builder parameterization commit: `14f60e4cf8c26f460ab5437ede76ea8f8fd139fd`

## Reviewed exact artifacts

### Public artifact

- Artifact ID: `10169773484`
- ZIP SHA-256: `63b0250c49fadb633d403cfb547f6ec2f0a92157265eebd34ca0f68dc9f706a4`
- Bundle file SHA-256: `8f4fc6b73ab10eadc9f8a2710dd4708af4b41f96ddda2eed22cd568e14aea038`

### Private mapping artifact

- Artifact ID: `10169774220`
- ZIP SHA-256: `26a76e571492326a893a9cf7606e596579e2b63c8fa8ff0c31ea872f4cd34e40`
- Mapping file SHA-256: `b631edb52b79ba2f48a4a8199521a5db2f9f412be9f9a03b84264f00058f3a14`
- Seed commitment SHA-256: `3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`

## Independent verification

Reviewer reported fresh-content inspection and independently verified:

- public ZIP and bundle-file hashes;
- private mapping and manifest hash consistency;
- retrieval provenance against the already accepted harm retrieval artifact;
- exact structure `5 queries × 3 anonymous lists × 10 results = 150 records`;
- queryMap is a bijection over exactly `A1,A2,A5,A6,A7`;
- each A/B/C mapping is one permutation of L/S/H;
- the frozen 8-field evaluator-visible projection contains no extra/missing field;
- all 150 public records mechanically project from the mapped accepted raw L/S/H top-10 records with zero mismatches across title, authors, publicationYear, publicationDate, venue, doi, evidenceLevel, and abstract;
- all five public intents map correctly to their historical case intents;
- no structural OpenAlex/arm/rank/provider metadata leak is present; ordinary words such as “hybrid” and “provider” occur only inside publication abstract text and were not treated as retrieval metadata;
- both bundle and mapping were explicitly PROVISIONAL and not rater-eligible at review time.

## Classification

`ACCEPTED` — unconditional.

## Authorized promotion

The exact reviewed artifact pair may now be promoted to `FROZEN` by governance/state update only.

Promotion constraints:

1. builder MUST NOT rerun;
2. seed MUST NOT be regenerated;
3. anonymous query order MUST NOT change;
4. A/B/C arm mappings MUST NOT change;
5. evaluator-visible fields MUST NOT change;
6. public/private artifact bytes and all recorded hashes MUST remain exactly the reviewed values above;
7. private mapping and seed remain sealed until both new harm primary blind raters lock all labels.

No reviewer-requested content modification was required.

Last updated: 2026-09-10
