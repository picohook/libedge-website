# D-022 H2 — R1 Qualification Raw-Output Evidence Recovery Record

Status: **AUDIT RECORD / DOES NOT CLOSE QUALIFICATION**

Date: 2026-09-23
Repository baseline: `9ba9190e4c8eabac3dc155aeea0a181bf77dda3d`

## Scope

This record documents a recovery attempt for the exact raw assistant-response bytes from the three GPT-5.5 Instant R1 format-qualification trials. It does not reconstruct, normalize, reserialize, or substitute output bytes.

## Known qualification state

- Planned replacement R1 identity/configuration used for these trials: GPT-5.5 Instant, literal rater ID `R1`.
- Three fresh-session trial responses were observed and checked at execution time as structurally conforming visible JSON with the authoritative qualification bundle SHA-256 `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`, the expected 90 blind item IDs/order, allowed labels, and `FINAL / LOCKED` status.
- This is therefore recorded only as **3/3 visible-content PASS**.
- It is not recorded as byte-evidence-complete qualification.

## Recovery performed on 2026-09-23

Available ChatGPT conversation and Library file indexes were searched for the three R1 trial outputs using combinations of:

- `GPT-5.5 Instant`
- `D022-H2-QUALIFICATION`
- `D022-H2-QUAL-90`
- authoritative bundle SHA-256 `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- literal rater ID `R1`
- `B0001` / `B0090`
- `FINAL / LOCKED`
- Trial 1 / Trial 2 / Trial 3 descriptors

The searches returned D-022 validator/test/governance artifacts and unrelated files, but did not locate three independently addressable raw assistant-response artifacts for the GPT-5.5 Instant qualification trials.

## Recovery conclusion

**Exact raw-response bytes for the three GPT-5.5 Instant R1 qualification trials are NOT RECOVERABLE from the presently available indexed conversation/Library evidence.**

No SHA-256 values are assigned to reconstructed, copied, normalized, or reserialized versions of those responses. Such values would not establish the required raw-output provenance.

This conclusion means only that the documented recovery attempt did not find recoverable exact raw-response artifacts. It does not prove that no lower-level platform record exists outside the available evidence surfaces.

## Gate effect

- R1 remains: **3/3 visible-content PASS; exact raw-response byte evidence unavailable from the presently recoverable evidence**.
- This record does **not** upgrade R1 to evidence-complete qualification.
- R2 qualification remains open.
- The historical #132/#133 independent-review provenance gap remains open.
- The canonical H2 freeze manifest remains absent/unaccepted.
- H2 holdout authorship remains closed.

This record is an audit/provenance record only and is not a methodology amendment.

## New exact-byte recovery trial

### R1 Trial 1 — rerun preserved 2026-09-23

- raw output filename: `T1.json`
- exact byte length: `4216`
- exact SHA-256: `a86b8a696eb4c779a827f299f7e70595425bfdbaa98bcc4cd7ad2cf83182bef0`
- UTF-8 JSON parse: PASS
- holdout_version: `D022-H2-QUALIFICATION`
- qualification bundle SHA-256 field: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- rater_id: `R1`
- batch_id: `D022-H2-QUAL-90`
- first/last item: `B0001` / `B0090`
- ratings: exactly 90 unique expected IDs in exact order
- labels: all within the allowed enum
- top-level and rating-entry fields: no extras
- status: `FINAL / LOCKED`
- structural qualification result: `PASS`

This is the first newly preserved exact-byte rerun trial. Two additional fresh-session R1 trials remain required before the rerun qualification set is complete. The earlier unrecoverable trials are not assigned reconstructed hashes.
