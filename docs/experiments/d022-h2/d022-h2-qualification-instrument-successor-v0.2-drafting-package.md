# D-022 H2 — Qualification Instrument Successor v0.2 Drafting Package

Status: **DRAFTING INPUT / NOT AN ACCEPTED INSTRUMENT**

Date: 2026-09-23

## Author task

Produce an exact successor package containing:

1. `d022-h2-primary-rater-prompt-v0_2-PROPOSED.md`
2. `d022-h2-rating-batch-output.schema-v0_2-PROPOSED.json`
3. `d022-h2-rating-instrument-qualification-manifest-v0_2-PROPOSED.md`

Do not modify the 90-item qualification JSON itself.

## Frozen qualification bundle identity

- batch ID: `D022-H2-QUAL-90`
- holdout version: `D022-H2-QUALIFICATION`
- exact qualification JSON SHA-256: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`

## Required normative change from v0.1

The execution harness computes SHA-256 from the exact frozen qualification JSON bytes before the model request.

The request supplies this exact authoritative digest to the rater as a literal value:

`866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`

The rater must copy that literal value exactly into `bundle_sha256`.

The rater is not asked to calculate, derive, infer, reconstruct, or independently verify SHA-256.

The checker still requires exact equality between the emitted value and the harness-computed digest. A mismatch remains a qualification failure.

## Requirements that MUST remain unchanged

- format qualification is separately identified non-holdout input;
- semantic accuracy is not scored;
- literal assigned `rater_id` must be preserved;
- output is exactly one UTF-8/no-BOM JSON object;
- no prose, markdown fences, or extra text;
- exact permitted top-level fields only;
- exact qualification metadata;
- exactly 90 rating rows;
- exact B0001 through B0090 expected IDs in exact original order;
- no duplicate, missing, renamed, or extra item IDs;
- every rating row has exactly `item_id` and `label`;
- allowed labels are exactly `SUPPORTED`, `PARTIALLY_SUPPORTED`, and `UNSUPPORTED`;
- status is exactly `FINAL / LOCKED`;
- tools, web retrieval, external retrieval, code execution, and external hash utilities are disabled for the rater;
- each identity/version/configuration uses three independent fresh-session trials;
- the same prompt, schema, qualification input, and fixed generation configuration are used across all three trials;
- any substantive qualification failure disqualifies that identity/configuration for this qualification version;
- raw outputs are preserved byte-for-byte and SHA-256 hashed by the harness;
- no failed historical trial is retroactively salvaged or rescored;
- H2 holdout authorship remains closed until all prerequisites and the canonical freeze manifest are accepted/merged.

## Schema rule

The output schema remains structurally identical to the v0.1 schema unless a syntactic version identifier outside the rater output is needed. Do not add a field that reveals trial number, provider, model identity, implementation notes, or governance state to the rater output.

## Manifest additions

The v0.2 manifest must explicitly distinguish:

- `bundle content identity`: harness-computed from exact bytes;
- `rater transcription requirement`: exact literal copy;
- `raw response identity`: harness-computed SHA-256 of the delivered assistant content;
- `transport failure`: no accepted model response, therefore not a substantive qualification failure;
- `substantive response failure`: any delivered response that violates a structural requirement, therefore disqualifying.

Streaming transport is allowed when necessary. When streaming is used, only final-answer content deltas are concatenated in order. Reasoning/thinking channels are excluded. No stripping, JSON repair, fence removal, normalization, or salvage is allowed before raw-output preservation and checking.

## Empirical motivation / non-retroactivity

The following failures remain historical failures:

- GPT-5.5 Instant rerun: T1 PASS, T2 FAIL due bundle hash mismatch.
- Qwen3.8-27B / DeepInfra: T1 FAIL due bundle hash mismatch.
- Meta Llama 4 Maverick / OpenRouter: T1 FAIL due bundle hash mismatch plus B0030 field-name defect and resulting item-ID/order failure.

The successor must not change these dispositions.

## Required author output

Return the three complete proposed files, clearly delimited by filename. Do not claim ACCEPTED, FROZEN, MERGED, or qualification authorization. The package must state `PROPOSED` until independently reviewed and accepted.
