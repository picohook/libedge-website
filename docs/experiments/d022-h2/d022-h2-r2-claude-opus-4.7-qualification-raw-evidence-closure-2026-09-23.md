# D022-H2 R2 Qualification Raw-Evidence Closure — Claude Opus 4.7

Status: **RAW-EVIDENCE CLOSED / QUALIFICATION 3/3 PASS PRESERVED**

Date: 2026-09-23

This record is mechanical evidence closure only. It does not authorize H2 authorship, checker execution, canonical freeze, H2 rating, or deployment.

## Locked R2 identity

- Model: Claude Opus 4.7
- Assigned literal rater ID: `R2`
- Qualification input: `D022-H2-QUALIFICATION`
- Qualification batch: `D022-H2-QUAL-90`
- Qualification bundle authoritative SHA-256: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- Existing disposition: visible 3/3 qualification PASS; locked R2.
- This closure supplies the previously missing exact raw-output byte linkage.

## Operator-saved raw artifacts

| Trial | Result | Exact bytes | SHA-256 |
|---|---|---:|---|
| T1 | PASS | 4216 | `916843547057aa654fa1f2be511b1b80278ed8393182b58dbb8d83850c416629` |
| T2 | PASS | 4216 | `916843547057aa654fa1f2be511b1b80278ed8393182b58dbb8d83850c416629` |
| T3 | PASS | 4216 | `916843547057aa654fa1f2be511b1b80278ed8393182b58dbb8d83850c416629` |

All three operator-saved raw JSON artifacts are byte-identical. The repeated hash is therefore intentional and is not a reconstructed value.

## Mechanical validation

Each exact uploaded artifact was read directly as bytes and checked without JSON repair, fence removal, normalization, or salvage.

- UTF-8 JSON parses successfully.
- Required top-level fields are present and no extra top-level fields are present.
- `holdout_version` = `D022-H2-QUALIFICATION`.
- `bundle_sha256` exactly equals the authoritative qualification digest.
- `rater_id` = `R2`.
- `batch_id` = `D022-H2-QUAL-90`.
- `first_item_id` / `last_item_id` = `B0001` / `B0090`.
- Exactly 90 ratings are present.
- IDs are unique and exactly ordered `B0001` through `B0090`.
- Each rating contains only `item_id` and `label`.
- Every label is in the allowed qualification label set.
- `status` = `FINAL / LOCKED`.

Result: **R2 raw-output evidence gap CLOSED.** No raw-output hash was invented or reconstructed.
