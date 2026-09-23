# D022-H2 R1 Successor Qualification Evidence — Nex-N2.5-Pro

Status: **QUALIFICATION 3/3 PASS / R1 IDENTITY LOCKED**

Date: 2026-09-23

This record is mechanical qualification evidence only. It does not authorize H2 authorship, checker execution, canonical freeze, or deployment.

## Locked R1 identity

- Model: Nex AGI Nex-N2.5-Pro
- OpenRouter model ID: `nex-agi/nex-n2.5-pro:free`
- Surface/provider: OpenRouter
- Assigned literal rater ID: `R1`
- Qualification instrument: D022-H2 successor v0.2
- Qualification bundle authoritative SHA-256: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- Trials: three independent fresh sessions, same selected model/configuration, qualification-only input.

## Trial results

| Trial | Result | Raw output bytes | Raw output SHA-256 |
|---|---|---:|---|
| T1 | PASS | 4802 | `2898c00be2ba66884010f5737e3a2e5265aee542e72692049d069d0362689fb6` |
| T2 | PASS | 4216 | `a86b8a696eb4c779a827f299f7e70595425bfdbaa98bcc4cd7ad2cf83182bef0` |
| T3 | PASS | 4216 | `a86b8a696eb4c779a827f299f7e70595425bfdbaa98bcc4cd7ad2cf83182bef0` |

T2 and T3 are byte-identical raw JSON artifacts and therefore intentionally have the same byte count and SHA-256.

## Mechanical checks applied to each trial

- UTF-8 JSON object parses without repair or salvage.
- Required metadata matches the qualification batch.
- `bundle_sha256` exactly transcribes the authoritative supplied digest.
- `rater_id` is exactly `R1`.
- `batch_id` is exactly `D022-H2-QUAL-90`.
- `first_item_id` / `last_item_id` are `B0001` / `B0090`.
- Exactly 90 ratings are present.
- IDs are unique and in exact `B0001` through `B0090` order.
- Every label is in the allowed enum.
- No extra output fields are present.
- `status` is exactly `FINAL / LOCKED`.

Result: **3/3 PASS.** Under the accepted successor qualification protocol, the exact Nex-N2.5-Pro identity/configuration used for these trials is locked as actual H2 R1. A later H2 rating run must not substitute another identity/configuration.

## Raw-artifact custody note

The three operator-saved raw JSON artifacts were supplied as conversation attachments and mechanically hashed from their exact mounted bytes. Their hashes above are the authoritative linkage values for repository/evidence reconciliation. This record does not reconstruct or normalize those raw files.
