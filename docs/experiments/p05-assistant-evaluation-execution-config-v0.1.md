# P0.5 Assistant evaluation execution configuration v0.1

Status: `PROPOSED / VALUES MUST BE VERIFIED AND FROZEN BEFORE EXECUTION`

## Admitted route

- provider/host: AWS Bedrock
- model: `anthropic.claude-sonnet-4-6`
- inference profile: `us.anthropic.claude-sonnet-4-6`
- operation: `bedrock-runtime / InvokeModel`
- effective retention: `none`
- prompt caching: baseline implicit caching; no explicit cache controls
- optional provider-side paths: disabled

These fields describe the already reviewed PASS scope. Execution must stop if the effective route/configuration differs.

## Model instruction

Use only the supplied question and EvidencePack. Do not use or claim outside knowledge. Return JSON only in the frozen evaluation response shape. Every factual claim must cite one or more pack-local evidence IDs. If evidence is insufficient or materially conflicting, say so rather than resolving the gap by inference.

## Inference controls

The following values MUST be filled with exact API-compatible values and independently reviewed before execution:
- AWS region: `TO_FREEZE`
- max output tokens: `TO_FREEZE`
- temperature/randomness: `TO_FREEZE`
- streaming: `TO_FREEZE`
- timeout: `TO_FREEZE`
- SDK/client version: `TO_FREEZE`

Fixed:
- tools: disabled
- measured retries: none
- explicit cache controls: none
- concurrency: serial
- warm-up: 1 unscored request before measured sequence
- measured repetitions: 3 per case
- measured cases: 24

## Measurement record

For every measured request retain a machine-readable record containing:
- protocol git SHA
- execution timestamp
- case_id and opaque arm label
- repetition
- exact model/profile/region/operation
- configuration fingerprint
- success/failure
- end-to-end latency milliseconds
- provider request ID when available and privacy-safe
- input tokens
- output tokens
- cache-read/cache-write token fields when exposed
- calculated request cost
- pricing source identifier and checked date

Do not write question text, EvidencePack text, model output, user identifiers, or research-interest-bearing content to application telemetry.

## Pricing

Official exact-route pricing must be checked on the execution date. The source, currency, unit prices, cache pricing treatment, and checked date must be recorded before cost calculations are finalized. Do not hard-code a price in this proposal.

## Execution authorization boundary

This file is intentionally incomplete while any `TO_FREEZE` value remains. Reviewer acceptance of the bundle does not authorize API execution. A later freeze commit must replace every `TO_FREEZE`, record the exact pricing source/date, and receive independent review before measured requests begin.
