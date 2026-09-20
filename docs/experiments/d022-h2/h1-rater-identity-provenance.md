# D022-H2 — H1 primary-rater identity attestation provenance

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`

Date: 2026-09-20

This artifact exists only to operationalize the H1-rater identity prerequisite in the accepted D-022 H2 specification.

## Operator evidence

The H1 evaluation operator supplied two screenshots from the original rating conversations:

- R1 screenshot: conversation file ID `file_00000000755c8246a6716b75876966a2`. The visible model selector has `GPT-5.6 Sol` selected.
- R2 screenshot: conversation file ID `file_00000000298081f498bb34d337df69b3`. The visible model selector has `Sonnet 5` selected under the Claude interface.

No identity is inferred from writing style, rating labels, H1 consensus, or current/default model settings.

Canonical family assignments for the H2 exclusion rule are therefore proposed as:
- R1: family `GPT`; exact visible identity/version `GPT-5.6 Sol`.
- R2: family `Claude`; exact visible identity/version `Claude Sonnet 5`.

## Evidence limitation

The screenshots themselves are conversation evidence and are **not copied into the public repository** by this PR. The repository records their conversation file IDs and the operator-observed selector values. The independent reviewer must inspect the supplied screenshots or equivalent operator/session evidence; repository text alone is not independent proof.

This PR does not claim the screenshots establish hidden provider backend build IDs beyond the product-visible model identities shown. It freezes only the product-visible identity/version required by the accepted H2 protocol.

## Review and freeze rule

The JSON attestation remains `PROPOSED / INDEPENDENT REVIEW REQUIRED` in this PR. An eligible independent identity-attestation reviewer must verify both screenshots and the transcription.

Only after reviewer acceptance may a narrow corrective/freeze commit change the status to `FINAL / LOCKED` and record the canonical attestation SHA-256 for the later H2 freeze manifest.

The reviewer must not be an H1/H2 rater, H2 author, inventory/taxonomy constructor or reviewer, construction auditor, checker implementer/tuner, validator reviewer, attester, or rater conduit as prohibited by the accepted role matrix.

No H2 authorship is authorized by this artifact.
