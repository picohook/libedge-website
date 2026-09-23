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

## R1 Trial 2 — rerun failure preserved 2026-09-23

- raw output filename: `T2.json`
- exact byte length: `3856`
- exact SHA-256: `8522d7e9706a23faae9c42146381a949f438f735a5f782b6f22b6cf34d947ffb`
- emitted bundle SHA-256 field: `866a15b89cccd9b6dd729a4d1c2fb4ef93942f56d4c6700d1946ebbc0843f78f`
- authoritative qualification input SHA-256: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- structural qualification result: `FAIL` — bundle identity mismatch

Per the frozen qualification protocol, any qualification failure disqualifies that planned identity/configuration before H2 authorship. No salvage, normalization, correction, or Trial 3 is used to convert this failed three-trial sequence into a pass. The GPT-5.5 Instant R1 rerun configuration is therefore disqualified for this H2 version.

No replacement R1 is recorded by this audit entry. A different eligible rater identity/version could be selected only before the canonical authorship gate and would itself require the full frozen 3/3 qualification; after authorship begins, a rater identity/configuration change requires a successor version.


## Replacement R1 candidate — Qwen3.8-27B / DeepInfra — Trial 1 failure

- model identity: `Qwen/Qwen3.8-27B`
- provider: `deepinfra`
- interface: Hugging Face Inference Providers OpenAI-compatible streaming chat completions
- fixed configuration: stream=true; temperature=1.0; top_p=0.95; max_tokens=12000; reasoning_effort=low; tools=none
- raw output byte length: `4218`
- raw output SHA-256: `632375a757ed0b5241bdddc7234a9e4679e5a1756647359fe568d886328f3753`
- authoritative qualification bundle SHA-256: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- emitted bundle SHA-256: `3f7a2b8c9d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a`
- structural result: `FAIL` — bundle_sha256 mismatch
- disposition: configuration disqualified; no Trial 2 or Trial 3

The streaming transport completed successfully. This is a substantive qualification response, not a transport failure.

## Replacement R1 candidate — Meta Llama 4 Maverick / OpenRouter — Trial 1 failure

- model identity: `meta-llama/llama-4-maverick`
- OpenRouter returned backend provider: `Parasail`
- interface: OpenRouter OpenAI-compatible streaming chat completions
- fixed configuration: stream=true; temperature=0; max_tokens=12000; tools=none
- raw output byte length: `4218`
- raw output SHA-256: `48b2642ccd0bcd29d013e48202e66de8b6b082b04f360d13a2a25ca5373853da`
- authoritative qualification bundle SHA-256: `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`
- emitted bundle SHA-256: `9b2ad55f6c991f5fe3b1c1e9e4d93e1d1f4d7d1e1c1a1d1e1f4d7d1e1c1a1d1e`
- additional structural defect: B0030 used `B_item_id` instead of `item_id`
- structural result: `FAIL` — bundle_sha256 mismatch; rating 30 fields mismatch; item IDs/order mismatch
- disposition: configuration disqualified; no Trial 2 or Trial 3

## Current R1 gate conclusion

No R1 candidate is qualified under the current frozen qualification instrument. H2 holdout authorship remains closed. The repeated exact-hash failures are preserved as evidence; they are not normalized, corrected, or salvaged.
