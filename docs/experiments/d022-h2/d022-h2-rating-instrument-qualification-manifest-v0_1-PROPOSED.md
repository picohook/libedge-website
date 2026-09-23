# D022-H2 Rating Instrument and Qualification Manifest v0.1

Status: **PROPOSED / QUALIFICATION AND INDEPENDENT REVIEW REQUIRED**

Base staging commit: `8786055cd2b0ce422c6c472a069464896f407260`

## Planned primary-rater identities

- R1 candidate: `Gemini 3.5 Flash-Lite`; family `Gemini`; operator-visible selector evidence recorded; clean-session attestation: prohibited H1/H2 exposure `NO`, prior D-022 substantive role `NO`, eligibility `ELIGIBLE`.
- R2 candidate: `Claude Opus 4.7`; family `Claude (Anthropic)`; operator-visible selector evidence recorded; clean-session attestation: prohibited H1/H2 exposure `NO`, prior D-022 substantive role `NO`, eligibility `ELIGIBLE`.
- Different-lineage requirement: satisfied at the candidate stage (`Gemini` vs `Claude`).
- These are planned identities only. Qualification must pass 3/3 before this prerequisite can be frozen. No substitution after the canonical freeze-manifest gate is permitted.

## Proposed instrument artifacts

- `d022-h2-primary-rater-prompt-v0_1-PROPOSED.md`: SHA-256 `6cac674e7ed2751ba2867bbf2b9d7d56e8a199e65cb9be8358a4ca2ffe0d989f`.
- `d022-h2-rating-batch-output.schema-PROPOSED.json`: SHA-256 `b29bf011b294009b969e5d79fc7b80d208f1028d9a02a4f35480f35dd6aa8d07`.
- `d022-h2-format-qualification-90-PROPOSED.json`: SHA-256 `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`.

## H1 semantic-rubric preservation

The three label definitions and the paragraph beginning `A claim is not supported merely because...` are carried forward verbatim from the frozen H1 primary-rater prompt. The H2 textual deltas are limited to format/transport/batching and role wording: H1→H2 naming; 720-item single bundle→90-item batch; copying batch metadata; first/last item IDs; and an explicit non-holdout qualification note. Independent review must confirm that these deltas do not alter SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED semantics.

## Planned interface/configuration freeze

For both raters, the qualification and later H2 rating configuration must be identical within each identity/version. Tools, web/browsing, external retrieval, memory/project context, and access to other rater outputs are disabled/not supplied. Each trial and each H2 batch uses a fresh isolated session/context.

Parameters not exposed by the consumer UI (including temperature or max-output-token controls when absent) must be recorded literally as `NOT EXPOSED BY INTERFACE`; they must not be guessed. Any exposed reasoning/effort control must be fixed to one operator-selected value before qualification trial 1 and recorded here before freeze. The operator must record the exact UI/product surface used for each rater.

**Open configuration fields that block qualification execution:**
- R1 interface/product surface: `TO BE OPERATOR-RECORDED`.
- R1 exposed reasoning/effort setting: `TO BE OPERATOR-RECORDED` or `NOT EXPOSED BY INTERFACE`.
- R1 temperature: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.
- R1 max output tokens: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.
- R2 interface/product surface: `TO BE OPERATOR-RECORDED`.
- R2 exposed reasoning/effort setting: `TO BE OPERATOR-RECORDED` or `NOT EXPOSED BY INTERFACE`.
- R2 temperature: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.
- R2 max output tokens: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.

## Qualification protocol

The qualification input is synthetic and is not an H1/H2 record or derivative. It contains exactly 90 blind-format items. Semantic accuracy is not scored. For each planned rater identity/version run exactly three independent fresh-session trials using byte-identical qualification input, the same proposed evaluator prompt/schema, the same fixed exposed configuration, and tools off.

A trial passes only if the delivered response is UTF-8/no-BOM JSON-only and structurally satisfies the frozen batch contract: correct metadata; exactly 90 unique expected IDs in exact order; one allowed label per ID; no extra fields/text/fences; `status` exactly `FINAL / LOCKED`. Leading/trailing ASCII whitespace may be stripped solely for JSON parsing. No extraction or salvage is permitted. Any qualification failure disqualifies that planned identity/configuration before H2 authorship.

Raw qualification outputs must be preserved byte-for-byte where the interface permits and SHA-256 hashed. Record three hashes and PASS/FAIL for each rater. Do not expose either rater to the other rater's outputs.

## Remaining items before Prerequisite 5 can be FINAL / LOCKED

1. Operator records the exact interface and every exposed generation/reasoning control for R1 and R2.
2. Independent review confirms the prompt deltas are format-only and the synthetic set is non-H1/H2.
3. The construction/rating validator package required by Prerequisite 6 provides the structural validator/tests used to validate qualification outputs.
4. Both planned identities pass 3/3 qualification trials.
5. Qualification raw-output hashes/results are added without changing semantic rubric or planned identity/configuration.
6. The final rating manifest records the blind-bundle construction/ordering algorithm from the locked operational spec. Actual 12 H2 batch-file hashes are a later derived-hash amendment after the frozen H2 pool/bundle exists, as permitted by the locked spec.

## Boundary

This proposal does **not** authorize H2 scenario, evidence, claim, author_intent, candidate-pool, or checker-output creation. H2 authorship remains closed until Prerequisites 5 and 6 and the canonical freeze manifest are independently accepted and merged.
