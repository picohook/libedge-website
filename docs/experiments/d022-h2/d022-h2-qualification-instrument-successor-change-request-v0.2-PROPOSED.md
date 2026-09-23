# D-022 H2 — Qualification Instrument Successor Change Request v0.2-PROPOSED

Status: **PROPOSED / NOT AUTHORIZED FOR QUALIFICATION USE**

Date: 2026-09-23

## Purpose

Remove an observed construct-irrelevant bottleneck from the R1 format-qualification instrument without weakening the structural format gate.

The frozen v0.1 procedure requires the rater to compute SHA-256 from the exact UTF-8 qualification-bundle bytes. Repeated candidate failures show that this requirement can dominate the qualification outcome even when the intended structural output behavior is otherwise substantially present. This proposal does not retroactively convert any failed trial into a pass.

## Proposed narrow change

The execution harness SHALL compute the qualification bundle SHA-256 from the exact frozen UTF-8 bytes before the model request.

The prompt SHALL provide that authoritative digest as a literal value and instruct the rater to copy it exactly into `bundle_sha256`.

The mechanical checker SHALL continue to require exact equality between the emitted `bundle_sha256` and the harness-computed digest.

The rater SHALL NOT be asked to perform the cryptographic hash computation itself.

## Checks that remain unchanged

A trial still fails unless all of the following hold:

1. UTF-8, no BOM, JSON-only response; no prose or markdown fences.
2. Exact permitted top-level fields; no additional fields.
3. Exact qualification metadata values.
4. Exactly 90 rating rows.
5. Exact expected blind item IDs in exact original order and without duplicates.
6. Each rating row has exactly `item_id` and `label`.
7. Each label is one of `SUPPORTED`, `PARTIALLY_SUPPORTED`, or `UNSUPPORTED`.
8. `status` is exactly `FINAL / LOCKED`.
9. `bundle_sha256` exactly matches the authoritative harness-computed digest.
10. Three independent fresh-session trials are required; any substantive qualification failure disqualifies that identity/configuration for this qualification version.

## Non-retroactivity

GPT-5.5 Instant, Qwen3.8-27B/DeepInfra, and Meta Llama 4 Maverick/OpenRouter failures remain failures under the instruments used for those trials. They are not salvaged or rescored by this proposal.

## Required governance before use

This file is a change request only. Before any model is qualified under the successor instrument:

- exact successor prompt/schema/manifest bytes must be prepared and hashed;
- the change must receive independent methodology review by an eligible reviewer who has not authored/tuned the successor;
- the accepted successor package and review disposition must be merged;
- the chosen R1 identity/version/configuration must then start a new 3/3 qualification sequence under that accepted successor.

No H2 holdout authorship is authorized by this proposal.
