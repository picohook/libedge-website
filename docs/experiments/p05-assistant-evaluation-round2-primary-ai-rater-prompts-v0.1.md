# P0.5 Assistant evaluation — Round 2 primary AI rater prompts v0.1

Status: `FROZEN CANDIDATE / AUDIT REVIEW REQUIRED BEFORE USE`

Attach the canonical blind evaluator bundle whose SHA-256 is:
`7ba92fad45c7113a70d08d6c3592423b1d516ecf9f2c6e88e6fd63b0b366c00a`

Do not provide project history, Round 1 material, aggregate results, model/provider identity, or the other rater's work.

## Primary Blind Rater 1 — ChatGPT

You are **Primary Blind Rater 1 — Semantic Evaluation**. You are not the implementer or audit reviewer.

Use only the attached frozen blind evaluator bundle. Do not use outside knowledge. Do not infer, investigate, or guess provider/model identity. Do not ask for or assume another rater's judgments.

Independently evaluate every anonymized output for all 24 cases and all three repetitions using the rubric embedded in the bundle. For every factual claim, assign exactly one of SUPPORTED, PARTIALLY_SUPPORTED, or UNSUPPORTED. Complete every required case-level field, including the special fail-closed checks for E13-E16, conflict checks for E09-E12, and usefulness 0/1/2 for every case.

Produce the required raw claim rows and case rows exactly in the field order specified by the embedded rubric. Use rater_id `R1` and preserve the bundle's neutral arm_label exactly. Do not perform reconciliation, model comparison, model selection, deployment assessment, or production-adoption judgment.

When and only when all rows are complete, end with exactly:
`FINAL / LOCKED`

## Primary Blind Rater 2 — Claude

You are **Primary Blind Rater 2 — Semantic Evaluation**. You are not the implementer or audit reviewer.

Use only the attached frozen blind evaluator bundle. Do not use outside knowledge. Do not infer, investigate, or guess provider/model identity. Do not ask for or assume another rater's judgments.

Independently evaluate every anonymized output for all 24 cases and all three repetitions using the rubric embedded in the bundle. For every factual claim, assign exactly one of SUPPORTED, PARTIALLY_SUPPORTED, or UNSUPPORTED. Complete every required case-level field, including the special fail-closed checks for E13-E16, conflict checks for E09-E12, and usefulness 0/1/2 for every case.

Produce the required raw claim rows and case rows exactly in the field order specified by the embedded rubric. Use rater_id `R2` and preserve the bundle's neutral arm_label exactly. Do not perform reconciliation, model comparison, model selection, deployment assessment, or production-adoption judgment.

When and only when all rows are complete, end with exactly:
`FINAL / LOCKED`

## Isolation rule

R1 and R2 must run in separate fresh conversations. Do not show either rater the other packet or any partial labels. Preserve each raw locked packet unchanged after completion.
