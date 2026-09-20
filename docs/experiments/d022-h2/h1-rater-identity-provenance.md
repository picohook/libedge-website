# D022-H2 — H1 primary-rater identity attestation provenance

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`

Date: 2026-09-20

This artifact operationalizes only the H1-rater identity prerequisite in the accepted D-022 H2 specification.

## Operator attestation

Persistent operator identifier: `OPERATOR-H1-01`.

The operator states that the supplied images were captured from the original H1 rating conversations and that the visible model selectors correspond to those sessions. This same-session linkage is an **operator attestation**; it is not independently established by URL/account/timestamp pixels in the current crops.

- R1 visible selector value: `GPT-5.6 Sol`.
- R2 visible selector value: `Sonnet 5`.
- R1 family assignment: `GPT`, directly present in the visible selector string.
- R2 family assignment: `Claude`, supplied by the operator as the product/account context of the original R2 conversation; the current crop alone does not display the Claude wordmark/URL.

No identity is inferred from writing style, rating labels, H1 consensus, or current/default model settings. The canonical JSON preserves the exact visible identity/version strings: R1 `GPT-5.6 Sol`, R2 `Sonnet 5`.

## Evidence digests and handling

Reviewer-computed SHA-256 digests of the exact supplied image bytes:

- R1 crop (515×292): `b2aa374b84d975d9bfa3fcc1ec4bd0bc23cbfc3e1c1058ed150c6de81fc3d24b`
- R2 crop (512×225): `47c9b6aa3f089e87fbadfcb2eb339fabfa3265cff73d4f41af432961f3508ccb`

Conversation file IDs used only as provenance pointers:
- R1: `file_00000000755c8246a6716b75876966a2`
- R2: `file_00000000298081f498bb34d337df69b3`

The images are not copied into the public repository. The digest commits the reviewed evidence bytes without publishing them.

### Contamination hygiene

The original R1 crop exposes H1 claim-level labels in the background. It must **not** be redistributed to any prospective H2 author, auditor, rater, inventory/taxonomy role, checker implementer, validator reviewer, attester reviewer, or other role whose H1 exposure is prohibited. Anyone who has already viewed those claim-level labels must record that exposure and is ineligible wherever the accepted role matrix/firewall requires non-exposure.

Any future evidence crop intended for wider review must redact the H1 rating background while preserving the selector; the redacted derivative receives its own SHA-256 and never replaces the digest of the evidence reviewed here.

## Evidence limitation

The current crops do not independently prove their same-session linkage. R2's crop also does not independently display the Claude family name. Those facts are operator-attested above. This artifact freezes only product-visible model identity strings plus the operator-attested family/context required by the H2 exclusion rule; it does not claim hidden provider backend build IDs.

## Schema compliance

The canonical JSON uses exactly the schema frozen by #133: `record_version`, four fields under each rater (`model_family, model_identity_version, attested_by, attested_at`), and `status`. Evidence metadata lives only in this provenance document.

## Review and FINAL / LOCKED transition

The JSON remains `PROPOSED / INDEPENDENT REVIEW REQUIRED` until an eligible independent identity-attestation reviewer accepts the evidence/transcription.

After acceptance, the freeze transition is constrained:
1. the freeze commit may change **only** the JSON `status` value from `PROPOSED / INDEPENDENT REVIEW REQUIRED` to `FINAL / LOCKED`; any other JSON byte change reopens identity review;
2. the canonical SHA-256 recorded in the later H2 freeze manifest must be computed from the **post-flip FINAL / LOCKED bytes**, never from the PROPOSED artifact;
3. this provenance file is not silently edited during the status flip; any necessary provenance correction requires review.

No H2 authorship is authorized by this artifact.
