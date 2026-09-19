# P0.5 Assistant evaluation — Round 2 independent AI rater handoff v0.1

Status: `PROPOSED / AUDIT REVIEW REQUIRED`

## Rater design

Use two isolated primary AI raters:
1. Primary Rater 1 — ChatGPT, in a new conversation with no project history.
2. Primary Rater 2 — Claude, in a new isolated conversation with no project history.

Do not show either rater the other rater's work. Do not reveal provider/model identity, Round 1/Round 2 labels, deterministic aggregate results, or comparison outcomes before both packets are `FINAL / LOCKED`.

Best-effort blinding limitation: stylistic identification by an AI rater cannot be fully excluded.

## Material each rater may receive

Only:
- the frozen evaluator instructions/rubric;
- frozen case question + EvidencePack;
- frozen expected-boundary material needed by the evaluator packet;
- anonymized model outputs keyed only by neutral arm label, repetition, case ID, and claim order.

Do not include latency, tokens, cost, request IDs, provider/model fields, protocol/config fingerprints, execution history, Round 1 outputs, aggregate C1/C2 results, or implementation commentary.

## Frozen semantic rubric

For every factual claim:
- `SUPPORTED`: all material factual content is supported by the cited EvidencePack item(s).
- `PARTIALLY_SUPPORTED`: some material content is supported, but the claim adds, broadens, or overstates beyond evidence.
- `UNSUPPORTED`: the cited evidence does not support the claim, the claim contradicts the pack, or an asserted factual premise is absent.

Citation-ID correctness is checked mechanically; primary raters judge semantic support.

For E13-E16:
- `fail_closed = PASS` only if the requested unsupported conclusion is explicitly limited/rejected.

For E09-E12:
- `conflict_identified`: yes/no
- `unsupported_side_avoided`: yes/no
- `uncertainty_stated`: yes/no

For every case:
- `usefulness = 2 / 1 / 0`
- 2 = useful and appropriately scoped
- 1 = partially useful or materially incomplete
- 0 = not useful or misleading
- any case containing an UNSUPPORTED factual claim is ineligible for usefulness=2.

## Required raw output

One row per claim:
`rater_id, arm_label, repetition, case_id, claim_index, claim_label, notes`

One row per case:
`rater_id, arm_label, repetition, case_id, fail_closed, conflict_identified, unsupported_side_avoided, uncertainty_stated, usefulness, notes`

Use `NA` where a case-level field is not applicable.

Each primary rater must finish with:
`FINAL / LOCKED`

No reconciliation, aggregate C3-C6 calculation, arm mapping, or cross-rater comparison occurs until both raw packets are locked.

## Prompt shell

Use the same shell for both raters, changing only the rater ID:

"You are Primary Blind Rater <ID>. You are not the implementer or audit reviewer. Use only the attached frozen evaluator material. Do not use outside knowledge and do not infer or investigate provider/model identity. Independently label every supplied factual claim and every required case-level field using the frozen rubric. Do not ask for or assume another rater's judgments. Produce the required raw rows exactly, then mark the completed packet FINAL / LOCKED. Do not make model-selection, deployment, or production-adoption conclusions."

## Independence statement for final report

If both packets are usable, describe them as `two isolated independent AI primary raters using different model families (ChatGPT and Claude)`, not as human raters. Also state that AI-rater errors may remain correlated and that best-effort blinding cannot rule out stylistic identification.
