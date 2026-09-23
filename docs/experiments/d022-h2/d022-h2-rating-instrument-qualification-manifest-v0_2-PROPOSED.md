# D022-H2 Rating Instrument and Qualification Manifest v0.2

Status: **PROPOSED / QUALIFICATION AND INDEPENDENT REVIEW REQUIRED**

Base staging commit: `8786055cd2b0ce422c6c472a069464896f407260`

## Planned primary-rater identities

- R1 candidate: **TO BE SELECTED AND RECORDED BEFORE SUCCESSOR QUALIFICATION STARTS**. The obsolete `Gemini 3.5 Flash-Lite` identity is not carried forward.
- R2 candidate: `Claude Opus 4.7`; family `Claude (Anthropic)`; operator-visible selector evidence recorded; clean-session attestation: prohibited H1/H2 exposure `NO`, prior D-022 substantive role `NO`, eligibility `ELIGIBLE`.
- Different-lineage requirement: satisfied at the candidate stage once R1 is selected.
- Planned identities only. Qualification must pass 3/3 before this prerequisite can be frozen. No substitution after the canonical freeze-manifest gate is permitted.

## Proposed instrument artifacts

- `d022-h2-primary-rater-prompt-v0_2-PROPOSED.md`: SHA-256 `TO BE RECORDED`.
- `d022-h2-rating-batch-output.schema-v0_2-PROPOSED.json`: SHA-256 `TO BE RECORDED`.
- `d022-h2-format-qualification-90-PROPOSED.json`: SHA-256 `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`.

## H1 semantic-rubric preservation

The three label definitions and the paragraph beginning `A claim is not supported merely because...` are carried forward verbatim from the frozen H1 primary-rater prompt. H2 textual deltas are limited to format/transport/batching and role wording. Independent review must confirm these deltas do not alter label semantics.

## SHA-256 and transcription contract

- Bundle content identity: the harness computes SHA-256 over the exact frozen qualification JSON bytes.
- The qualification request supplies the authoritative digest literally.
- Rater transcription requirement: copy that literal exactly into `bundle_sha256`. The rater must not calculate, derive, infer, reconstruct, or independently verify SHA-256.
- Checker exact-equality is mandatory; mismatch is a substantive qualification failure.
- Raw response identity: the harness computes SHA-256 over the exact delivered assistant content bytes.
- Transport failure: no accepted model response; not a substantive qualification failure.
- Substantive response failure: delivered response violating a structural requirement; disqualifying.
- Streaming may concatenate only final-answer content deltas in order; reasoning/thinking content is excluded. No stripping, JSON repair, fence removal, normalization, or salvage is permitted before preservation/checking.

## Planned interface/configuration freeze

For both raters, the qualification and later H2 rating configuration must be identical within each identity/version. Tools, web/browsing, external retrieval, memory/project context, and access to other rater outputs are disabled/not supplied. Each trial and each H2 batch uses a fresh isolated session/context.

Parameters not exposed by the consumer UI must be recorded literally as `NOT EXPOSED BY INTERFACE`; they must not be guessed. Any exposed reasoning/effort control must be fixed to one operator-selected value before qualification trial 1 and recorded here before freeze. The operator must record the exact UI/product surface used for each rater.

**Open configuration fields:**
- R1 interface/product surface: `TO BE OPERATOR-RECORDED`.
- R1 exposed reasoning/effort setting: `TO BE OPERATOR-RECORDED` or `NOT EXPOSED BY INTERFACE`.
- R1 temperature: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.
- R1 max output tokens: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.
- R2 interface/product surface: `TO BE OPERATOR-RECORDED`.
- R2 exposed reasoning/effort setting: `TO BE OPERATOR-RECORDED` or `NOT EXPOSED BY INTERFACE`.
- R2 temperature: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.
- R2 max output tokens: `NOT EXPOSED BY INTERFACE` unless the selected surface exposes it.

## Qualification protocol

The qualification input is synthetic and is not an H1/H2 record or derivative. It contains exactly 90 blind-format items. Semantic accuracy is not scored.

For each planned rater identity/version run exactly three independent fresh-session trials using byte-identical qualification input, the same proposed evaluator prompt/schema, the same fixed exposed configuration, and tools off.

A trial passes only if the delivered response is UTF-8/no-BOM JSON-only and structurally satisfies the frozen batch contract: correct metadata; exactly 90 unique expected IDs in exact order; one allowed label per ID; no extra fields/text/fences; `status` exactly `FINAL / LOCKED`. Leading/trailing ASCII whitespace may be stripped solely for JSON parsing. No extraction or salvage is permitted.

Any substantive qualification failure disqualifies that planned identity/configuration before H2 authorship.

Raw qualification outputs must be preserved byte-for-byte where the interface permits and SHA-256 hashed by the harness. Record three hashes and PASS/FAIL for each rater. Do not expose either rater to the other rater's outputs.

## Historical qualification dispositions

These remain closed without retroactive alteration:
- `GPT-5.5 Instant`: T1 PASS, T2 FAIL hash mismatch.
- `Qwen3.8-27B / DeepInfra`: T1 FAIL hash mismatch.
- `Meta Llama 4 Maverick / OpenRouter`: T1 FAIL hash mismatch + B0030 field defect/item-order failure.

## Remaining items before Prerequisite 5 can be FINAL / LOCKED

1. Operator records the exact interface and every exposed generation/reasoning control for R1 and R2.
2. Independent review confirms the prompt deltas are format-only and the synthetic set is non-H1/H2.
3. The construction/rating validator package required by Prerequisite 6 provides the structural validator/tests used to validate qualification outputs.
4. Both planned identities pass 3/3 qualification trials.
5. Qualification raw-output hashes/results are added without changing semantic rubric or planned identity/configuration.
6. The final rating manifest records the blind-bundle construction/ordering algorithm from the locked operational spec. Actual 12 H2 batch-file hashes are a later derived-hash amendment after the frozen H2 pool/bundle exists, as permitted by the locked spec.

## Boundary

This proposal does **not** authorize H2 scenario, evidence, claim, author_intent, candidate-pool, or checker-output creation. H2 authorship remains closed until Prerequisites 5 and 6 and the canonical freeze manifest are independently accepted and merged.
