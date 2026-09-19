# P0.5 Assistant evaluation — Round 2 blind evaluator bundle manifest v0.1

Status: `FROZEN CANDIDATE / AUDIT REVIEW REQUIRED BEFORE RATING`

Canonical bundle:
`docs/experiments/p05-assistant-evaluation-round2-blind-evaluator-bundle-v0.1.json`

SHA-256 (UTF-8 bytes, including final newline):
`7ba92fad45c7113a70d08d6c3592423b1d516ecf9f2c6e88e6fd63b0b366c00a`

Integrity:
- 24 frozen cases
- 24 frozen expected-boundary records
- 72 anonymized measured outputs
- exactly 3 repetitions per case
- neutral arm label: `X`
- embedded frozen blind-rater rubric

Withheld from bundle:
- provider/model identity
- region/operation
- timestamps
- request IDs
- protocol/config fingerprints
- latency
- token/cache usage
- cost
- deterministic C1/C2 aggregate/checker fields
- Round 1 outputs/results
- implementation commentary

Blinding is best-effort; stylistic identification by an AI rater cannot be fully excluded.

Both primary AI raters must receive byte-identical copies matching the SHA-256 above. No rating should start until this bundle PR is independently accepted and merged.

Primary Rater 1: isolated ChatGPT conversation.
Primary Rater 2: isolated Claude conversation.
Both must finish `FINAL / LOCKED` before reconciliation or cross-rater comparison.
