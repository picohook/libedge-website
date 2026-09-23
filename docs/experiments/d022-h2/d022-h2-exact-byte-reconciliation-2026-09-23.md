# D022-H2 exact-byte repository reconciliation — 2026-09-23

Status: **MECHANICALLY RECONCILED / PRE-CANONICAL-FREEZE**

This record resolves the line-ending/byte-preservation ambiguity identified before canonical freeze.

## Accepted exact artifacts

| Artifact | Bytes | SHA-256 | Git blob |
| --- | ---: | --- | --- |
| `d022-supportcheck-h2-construction-rating-spec-v0.2-PROPOSED.md` | 35,848 | `4608338132762a0046f0edb24d80c61f5a13cf8cb7916e6216a50594916e292b` | `d90b3d90ed014234f64221dc8c3b6fb47873e95a` |
| `d022-h2-primary-rater-prompt-v0_2-PROPOSED.md` | 2,752 | `7bc539fb0afc85c69e2e028ed8e008de2c4862309283fa90542a0fa06f53704e` | `877dd34f813795edc55ca9cf734254ea75453b61` |
| `d022-h2-rating-batch-output.schema-v0_2-PROPOSED.json` | 1,707 | `8ecb53b4e336641310be61a1bfb70815d8304259c929e83e05b8c453778db923` | `7ce93c9b3c8fe6a348bfbf7656e09fb34732f70e` |
| `d022-h2-rating-instrument-qualification-manifest-v0_2-PROPOSED.md` | 6,606 | `a386f83b79a7a61edf244e2896b7785105710d73a8062c3e50ec0562573d005d` | `e919a64ac3df90cb41cfcbb8ec762f0725486d9e` |

The three qualification successor artifacts use their accepted CRLF bytes. They were written as raw Git blobs rather than through a text-normalizing path. The operational specification already matched its independently accepted exact bytes.

## Boundary

This is mechanical identity reconciliation only. It does not independently review content and does not open H2 authorship. Canonical freeze-manifest independent acceptance and merge remain required.
