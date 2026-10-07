# Research Multilingual Roadmap

Status: `ROADMAP`  
Origin: #592  
Current pilot boundary: #591  
Production authorization: #399

> This is a long-term roadmap, not a Golden Set v1 or current-pilot blocker. Language support is enabled only after that language passes its own preregistered validation gate.

## Vision
Separate three language layers:
1. query language,
2. evidence/literature language,
3. answer language.

Long-term goal: a user asks in a supported language, selects a supported answer language, and the system can retrieve and verify evidence in independently validated source languages while preserving original-source provenance. Language support is claimed only after that language passes its own preregistered validation gate.

This roadmap is **not a Golden Set v1 / current pilot blocker**. The current pilot remains scoped by #591 to English authorized evidence and the existing pinned English Fresh-Checker.

## Invariants
- Every displayed factual claim is traceable to original source evidence.
- No claim may be stronger than its source; preserve hedging, numbers, negation, and quantifiers.
- Fail closed on uncertainty.
- Preserve the chain: original source -> normalized evidence representation -> canonical proposition -> verification result -> rendered answer.
- Machine translation, if used for display/processing, is explicitly labeled and is never silently treated as original evidence.
- No “supports all languages / all literature” claim. Each language is enabled only after measured acceptance.

## Workstreams

### A. Multilingual validation corpus
Build human-labelled claim/evidence pairs per target language, including SUPPORT / NOT_SUPPORTING / CONTRADICTION / partial-or-overreach cases. Include adversarial semantic-preservation cases: hedging, numeric values, negation, causal vs associative wording, subgroup/population qualifiers. Use >=2 independent bilingual raters plus adjudication; implementation/tuning personnel do not label their own candidate outputs.

### B. Verifier candidates
Evaluate multilingual NLI and/or pinned judge candidates against the original-language evidence, not merely machine-translated premises. Freeze model/revision/manifest/decision thresholds per candidate. Primary safety metric must include false-accept rate. Measure latency/capacity/cost against #399 constraints and the 45 s request boundary.

### C. Multilingual retrieval
Measure query normalization/cross-language retrieval rather than assuming lexical overlap works cross-language. Evaluate multilingual ranking/embedding candidates. Add source coverage only with licensing/access review; Turkish sources may include OpenAlex/Crossref plus separately evaluated TR Dizin/DergiPark coverage. Report recall/coverage limitations explicitly.

### D. Evidence depth
Coordinate with #495 for passage/full-text evidence. Title/abstract/metadata search must not be marketed as “all literature” or full-text coverage. Validate extraction/OCR/diacritics separately where applicable.

### E. Verified answer rendering
Render only from verified propositions. Add deterministic semantic-preservation checks for numbers, named entities, negation, qualifiers and hedging. Validate each answer language with independent bilingual audit before enabling it.

### F. Product and operations
Language selector; source-language badge; machine-translation label where applicable; explicit coverage statement; clear “could not verify” UX. Content-free per-language telemetry, feature flags/kill switches, and stage-level latency/cost budgets.

## Preregistered gates before enabling a language
- fixed labelled corpus and provenance;
- frozen candidate identity/config;
- per-language acceptance thresholds (no cross-language averaging);
- false-accept safety gate;
- retrieval coverage/recall gate;
- answer-render semantic-preservation gate;
- latency/cost/capacity gate;
- independent reviewer approval;
- successor-candidate rule for material changes.

## Suggested order
1. Complete current pilot / Golden v1 under #591’s English-evidence boundary.
2. Validate Turkish answer rendering from already verified propositions as a separately gated feature.
3. Build Turkish original-language evidence corpus and compare multilingual verifier candidates.
4. Add Turkish multilingual retrieval/source coverage only after retrieval measurement.
5. Enable Turkish evidence verification only after all Turkish-specific gates pass.
6. Repeat language-by-language.

## Non-goals for current pilot
No direct Turkish evidence into the current English-only pinned checker; no unvalidated translated premise as evidence; no multilingual model swap; no claim that retrieval covers all literature.


## Governance

This roadmap does not authorize production changes, checker/model/pin changes, threshold weakening, translated evidence being treated as original evidence, or held-out execution. Current execution remains governed by #591, #536, #583, and #399.
