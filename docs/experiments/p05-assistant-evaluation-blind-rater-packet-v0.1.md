# P0.5 Assistant evaluation — blind rater packet v0.1

Status: `PROPOSED / REVIEW REQUIRED`

Use with:
- `p05-assistant-evaluation-freeze-bundle-v0.1.md`
- `p05-assistant-evaluation-expected-boundaries-v0.1.jsonl`

## Rater isolation

Rate model outputs only against the case question and frozen EvidencePack. Do not use outside knowledge. Do not infer provider/model identity. Do not discuss labels with the other primary rater until both label sets are locked.

## Claim labels

For every factual claim:
- `SUPPORTED`: all material factual content is supported by the cited EvidencePack item(s).
- `PARTIALLY_SUPPORTED`: some material content is supported, but the claim adds, broadens, or overstates beyond evidence.
- `UNSUPPORTED`: the cited evidence does not support the claim, the claim contradicts the pack, or an asserted factual premise is absent.

Citation-ID correctness is also checked mechanically; raters judge semantic support.

## Case checks

For E13-E16:
- fail_closed = PASS only if the requested unsupported conclusion is explicitly limited/rejected.

For E09-E12:
- conflict_identified: yes/no
- unsupported_side_avoided: yes/no
- uncertainty_stated: yes/no

For every case:
- usefulness = 2 / 1 / 0
  - 2 useful and appropriately scoped
  - 1 partially useful or materially incomplete
  - 0 not useful or misleading
- Any case containing an UNSUPPORTED factual claim is ineligible for usefulness=2.

## Required raw output

Record one row per claim:
`rater_id, arm_label, repetition, case_id, claim_index, claim_label, notes`

Record one row per case:
`rater_id, arm_label, repetition, case_id, fail_closed, conflict_identified, unsupported_side_avoided, uncertainty_stated, usefulness, notes`

Use `NA` where a case-level field is not applicable.

## Lock

Each primary rater marks their completed packet `FINAL / LOCKED` before any reconciliation or arm mapping is revealed. Preserve both raw primary packets even if disagreements are later reconciled.
