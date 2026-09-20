# D-022 supportCheck — Construction Diversity QA Addendum v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE POOL CONSTRUCTION`

Prepared: 2026-09-20

Upstream:
- `docs/experiments/d022-supportcheck-evaluation-preregistration-v0.1.md`
- `docs/experiments/d022-supportcheck-statistical-holdout-freeze-v0.1.md`
- `docs/experiments/d022-supportcheck-holdout-construction-spec-v0.1.md`

## Purpose

Freeze two objective construction-QA guardrails before any D022-H1 candidate-pool record is authored:

1. topic/domain diversity;
2. lexical near-clone detection.

These guardrails operationalize part of the already-frozen "no paraphrase clone" requirement. They are necessary but not sufficient evidence of semantic diversity. Low lexical similarity does not prove semantic independence, and domain labels do not prove proposition diversity. Independent semantic inspection remains required.

This addendum does not alter the canonical holdout-record schema frozen in the construction specification.

## Construction-only QA metadata

Maintain a separate QA metadata JSONL keyed by `scenario_id`. It is not part of the canonical 720-record pool and must not be included in blind-rater bundles.

Each of the 120 scenarios receives exactly one frozen `domain_id` from this closed vocabulary:

- `D01_MATERIALS_ENERGY`
- `D02_BIOMEDICAL_CLINICAL`
- `D03_EDUCATION_SURVEY`
- `D04_SOFTWARE_SYSTEMS`
- `D05_BUSINESS_OPERATIONS`
- `D06_ENVIRONMENT_AGRICULTURE`
- `D07_ENGINEERING_MANUFACTURING`
- `D08_PUBLIC_SERVICES_TRANSPORT`
- `D09_LIBRARY_RESEARCH_METADATA`
- `D10_CONSUMER_PRODUCT_TESTING`
- `D11_SOCIAL_BEHAVIORAL_STUDIES`
- `D12_HISTORICAL_ARCHIVAL_RECORDS`

Domain assignment describes the scenario's surface subject only. It is not semantic ground truth and must not affect rater labels or checker decisions.

## Domain-diversity gate

For the 80 negative-focused scenarios S001-S080:

- at least **10 of the 12** domain IDs must be represented;
- no domain may contain more than **10** negative-focused scenarios;
- at least **6 domains** must contain at least **6** negative-focused scenarios.

For all 120 scenarios:

- all **12 domains** must be represented;
- no domain may contain more than **15** scenarios.

These constraints prevent a nominally diverse pool from being dominated by one or two subject templates while still allowing natural variation in scenario availability.

### Rationale frozen before data

The negative pool is the safety-critical portion. Requiring >=10 domains means at least 83% of the closed vocabulary is represented. The cap of 10/80 limits any single negative domain to 12.5%. Requiring six domains with >=6 scenarios prevents compliance through token one-off domains.

Across the full pool, a 15/120 cap likewise limits any domain to 12.5%.

The thresholds are construction guardrails, not statistical claims about production-domain prevalence.

## Lexical near-clone detector

Run the detector separately within each frozen `stratum_id`.

For each claim record construct `comparison_text` as:

`question + " " + all evidence_pack.text values in evidence order + " " + claim_text`

Evidence IDs, scenario IDs, claim IDs, stratum labels, and author intent are excluded.

### Normalization

Apply exactly:

1. Unicode NFC normalization;
2. Unicode lowercase;
3. replace every maximal Unicode whitespace sequence with one ASCII space;
4. strip leading/trailing whitespace;
5. replace every Unicode decimal-digit sequence with token `<num>`;
6. tokenize using maximal Unicode letter sequences plus literal token `<num>`;
7. discard no stopwords;
8. preserve token order.

No stemming, lemmatization, synonym expansion, translation, or domain-specific normalization is allowed.

### Feature representation

Create the **set of contiguous token 3-grams** from the normalized token sequence.

If a record has fewer than three tokens, construction QA fails independently.

For two records A and B in the same stratum, compute Jaccard similarity:

`J(A,B) = |G_A ∩ G_B| / |G_A ∪ G_B|`

where `G_A` and `G_B` are the trigram sets.

### Frozen threshold

Construction QA **fails** if any same-stratum pair has:

`J(A,B) >= 0.70`

The equality case fails; there is no rounding-based pass.

Also report, for every stratum:
- number of pairwise comparisons;
- maximum observed Jaccard similarity;
- IDs of the maximum-similarity pair;
- count of pairs with `J >= 0.50`;
- count of pairs with `J >= 0.60`;
- count of pairs with `J >= 0.70`.

The 0.50 and 0.60 values are reporting diagnostics only and cannot fail the pool.

### Why token trigrams and 0.70

The purpose is deliberately narrow: catch obvious template reuse, including "same sentence with changed numbers." Replacing digit sequences with `<num>` prevents numeric substitutions from evading the detector. Token trigrams retain local phrase structure while being less brittle than exact-string equality.

A Jaccard value >=0.70 over combined question/evidence/claim text indicates very high shared local wording for records that are supposed to test distinct proposition/evidence relations. The threshold is intentionally high so the automatic gate targets clear near-clones rather than ordinary shared scientific or evaluative vocabulary.

This is not claimed to be an empirically optimized semantic-duplicate threshold. It is a preregistered conservative guardrail selected before the pool exists. It must not be tuned against D022-H1.

## Additional exact-duplicate gates

Independent of the 0.70 trigram threshold, QA fails if any two distinct records have identical normalized:
- `claim_text`;
- complete ordered evidence text concatenation; or
- `comparison_text`.

These duplicate checks run across the entire 720-record pool, not only within strata.

## Scenario-template concentration diagnostic

Because six negative claims share each negative-focused scenario, shared EvidencePack wording within a scenario is expected. Therefore the pairwise near-clone gate compares **claim records from different scenarios only**.

Within a scenario, the validator instead verifies:
- six distinct normalized claim texts;
- exactly one negative claim in each U1-U6 stratum for S001-S080;
- no duplicate evidence text within the scenario.

The manifest must explicitly report that same-scenario pairs were excluded from the lexical threshold and why.

## Mechanical implementation requirements

The future deterministic validator must implement these rules without third-party semantic models or embeddings.

It must emit a machine-readable QA summary containing:
- domain counts for S001-S080;
- domain counts for S001-S120;
- domain-gate pass/fail;
- per-stratum pair counts and similarity diagnostics;
- global exact-duplicate counts;
- lexical-gate pass/fail;
- scenario-level distinctness checks;
- overall diversity-QA pass/fail.

The validator must include unit tests with synthetic fixtures proving at minimum:
- changed numbers alone do not evade detection;
- J = 0.70 fails;
- J < 0.70 passes the lexical gate;
- exact duplicate claim/evidence/comparison text fails;
- same-scenario pairs are excluded from pairwise threshold;
- domain caps/minimums fail when violated.

## Freeze and change control

These thresholds and algorithms are frozen by the merge of this addendum after independent review.

After merge, D022-H1 construction may not change:
- domain vocabulary;
- domain thresholds;
- normalization;
- tokenization;
- n-gram size;
- similarity formula;
- 0.70 failure threshold;
- comparison fields;
- same-scenario exclusion;
- diagnostic thresholds,

based on the observed 720-record pool.

If the resulting pool cannot pass these rules without violating the already-frozen semantic construction requirements, D022-H1 construction fails. Do not weaken the guardrail post hoc; create a separately reviewed new holdout version/protocol if necessary.

## Known limitation

These checks detect concentration and high lexical/template overlap. They do **not** establish semantic independence. Two records can encode the same reasoning template with low lexical overlap, and different domains can still share the same abstract trap.

Accordingly, final pool review must retain independent semantic sampling across strata. The final report must also disclose the residual risk that, if holdout author and future checker developer are the same person or AI system, familiarity with the author's own trap-design style may remain even when labels are sealed.

## Decision boundary

This addendum:
- does not modify the canonical 720-record schema;
- does not create any holdout record;
- does not modify the frozen FPR criterion;
- does not authorize rating;
- does not authorize checker implementation or tuning on D022-H1;
- does not authorize measured evaluation or production.

## Next action

Independent reviewer reviews this addendum. If accepted and merged, construct D022-H1 under the combined frozen requirements of the construction specification and this addendum. The later pool-freeze PR must include the separate domain metadata, deterministic validator/tests, machine-readable QA summary, canonical pool, manifest, and all required hashes.
