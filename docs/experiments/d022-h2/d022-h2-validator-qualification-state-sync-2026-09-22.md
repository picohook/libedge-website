# D022-H2 — Validator and primary-rater qualification state sync

Status: `AUDIT SYNC / NOT A METHODOLOGY AMENDMENT`

Recorded: 2026-09-22

## Purpose

Record the post-taxonomy D022-H2 work completed outside the repository so the Git control plane does not silently lag the operator evidence.

This record does **not** modify, recreate, or replace any frozen H2 methodology artifact. Where exact source bytes are not present in this repository, only their known digest and observed outcome are recorded. The four qualification-instrument source files were subsequently located in prior conversation/library storage and independently verified from their raw bytes against the digests below. They are intentionally not copied into this PR because the available GitHub text-write transport was demonstrated not to preserve their exact bytes; repository-frozen copies therefore remain pending a byte-preserving transport.

## Authoritative H2 instrument artifacts observed outside the repository

| Artifact | SHA-256 |
|---|---|
| `d022-h2-format-qualification-90-PROPOSED.json` | `866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2` |
| `d022-h2-rating-instrument-qualification-manifest-v0_1-PROPOSED.md` | `74902be60815b2f015328ba23da7bde4289fcb41da06645aeecb353dbad0be1f` |
| `d022-h2-rating-batch-output.schema-PROPOSED.json` | `b29bf011b294009b969e5d79fc7b80d208f1028d9a02a4f35480f35dd6aa8d07` |
| `d022-h2-primary-rater-prompt-v0_1-PROPOSED.md` | `6cac674e7ed2751ba2867bbf2b9d7d56e8a199e65cb9be8358a4ca2ffe0d989f` |

Qualification requires three fresh-session trials for an exact planned rater identity/configuration. Any failed trial disqualifies that exact identity/configuration. Failed trials are not salvaged.

Raw-byte verification performed during this sync confirmed all four source files exactly match the recorded SHA-256 values. A parsed-text GitHub import test changed byte counts; all four test imports were immediately reverted and are absent from the PR tip.

## Construction/rating validator closure observed outside the repository

Successor validator author for the final correction rounds: **Grok 4.5, built by xAI**.

Independent validator/test reviewer: **DeepSeek `deepseek-v4-pro`**.

Final active package digests:

- validator: `59c9d138c9f311799aa655f23816b38458bdddc7b8e7b467b6b3ede32e59d356`
- tests: `46af134712cc81d3cf5dbb071ad07c0678f3ba1b3080224d67cd8fbc90b3c205`
- manifest: `72bfcf4a0e83ffe90ec052444be740eac3a01f155c348912fe247b169867c8a9`
- validator freeze manifest: `fe8fc85351ea681925847ea2ea9e78dc0c6a853d6629bdf194acae7031c33056`
- Stage K final record: `fa9e729f167bb10ccf9a70b20602b033b0185f3e665e4543673aa2464c31c5a7`
- Stage K identity record: `53e1c3292bc8c89520d2238556ef70e2de855457a3f2bdeaa968b15137c1c99f`

Observed closure:

- author suite: 294/294 PASS
- frozen reviewer suite: 12/12 PASS
- combined: 306/306 PASS
- F07: RESOLVED
- new defects: 0
- independent disposition: ACCEPT
- status: `FINAL / LOCKED`
- gate outcome: primary-rater qualification may begin

These statements are audit synchronization of operator-held evidence, not a new validator review performed by this commit.

## Primary-rater qualification observations

### R1 — Gemini 3.5 Flash-Lite

Trial 1 failed because `bundle_sha256` was the SHA-256 of empty bytes,
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
instead of the required qualification-bundle digest
`866a15b89ce7ace64dac4e24e5f7335c1a688f7e1d6d820af70691c8e4e6a0b2`.

Outcome: **DISQUALIFIED**. Trials 2 and 3 were not run.

Recorded raw-output SHA-256:
`c3c19251959ce0188f74e0edcfbe64b2085835fcb0343a8cdbe79cdd820516b9`.

Recorded failure-record SHA-256:
`d793bb4f11e675703a640dcc7a8a0c1f9d42cd8ae4f76f758edc1662f7dbda03`.

### Replacement R1 — GPT-5.5 Instant

Three fresh-session qualification trials were observed with:

- correct bundle SHA-256;
- exact 90 expected blind IDs in original order;
- required metadata;
- JSON-only visible output;
- status `FINAL / LOCKED`.

Outcome: **3/3 visible-content PASS**.

Evidence limitation: exact raw-output byte preservation/hashes for all three original ChatGPT responses have not yet been frozen into the repository. Therefore this record does **not** promote the qualification evidence to repository-complete/final.

### R2 candidate — DeepSeek `deepseek-flash`

Identity probe observed:

- requested/response model: `deepseek-flash`
- response ID: `8213bb69-0687-49f0-a7b6-56a9ecf2d99c`
- system fingerprint: `aeb56401ca74e127821c4f9126dcb669`
- finish reason: `stop`

Trial 1 failed with the same empty-byte digest mismatch.

Outcome: **DISQUALIFIED**. Trials 2 and 3 were not run.

Recorded trial-record SHA-256:
`9eefccd9f2bcbbedeb9444821b646560aa540b9e4263c2d979e0bcfc06a54d99`.

A later harness issue does not salvage or invalidate the genuine Trial 1 failure. Future qualification transport must also keep the request body byte-identical across all three trials; trial numbering belongs only in local operator records.

## Historical governing-review provenance note

Repository and available conversation/library evidence were re-audited for PR #132 (H2 preregistration) and PR #133 (H2 construction/rating specification). Both PR descriptions explicitly required independent full methodology review. No GitHub-native review submission and no presently recoverable independent-review acceptance artifact for those two PRs was located in the evidence available to this sync.

Later control-plane records treated both governing artifacts as frozen. This sync therefore records a **historical review-provenance gap**: it does not assert that the required reviews did not occur, and it does not assert that they did occur. It also does not reopen, amend, or retrospectively re-review either governing artifact.

Because no unused eligible reviewer identity is presently available without risking the frozen role-separation rules, this gap is not papered over by assigning an already-used model to a second substantive/governance role. Any future closure of this provenance gap must preserve the frozen bytes and role-separation requirements.

## Current gate state

The construction/rating validator gate is closed and accepted.

Primary-rater qualification is **not yet fully closed** because:

1. GPT-5.5 Instant R1 has 3/3 visible-content PASS, but repository-complete raw-byte evidence freeze is outstanding.
2. A qualified R2 exact identity/configuration with three passing fresh-session trials is still outstanding.
3. Any required independent identity-attestation/freeze-manifest review remains separate from this audit-sync record.

Therefore **H2 holdout authorship must not be started from this record alone**.

## Next permitted work

- import the exact frozen instrument artifacts only through a byte-preserving repository transport; the source files have been located and their raw-byte hashes verified;
- preserve/hash the original qualification outputs where the interface permits;
- complete a governance-compliant R2 qualification when an eligible exact identity/configuration is available;
- close any required independent freeze/identity review;
- only then advance to H2 holdout construction under the already-frozen construction/rating specification.

No H2 scenario, evidence item, claim, label, checker threshold, or production support-check behavior is created or changed here.
