# Turkish development normalization blind-audit instructions

Purpose: development-only, pre-freeze audit of the six already executed Turkish development questions. This is not held-out acceptance evidence and does not alter the frozen 7/10 Turkish held-out gate.

## Rater qualification and independence
Use two independent Turkish-competent raters. Neither may be the implementer who tuned the normalization path. Each rater locks all six judgments before seeing the other rater's output.

## Blinding
Rate only the supplied original Turkish question and actual retrieval query. Do not inspect or use application outcome, checker decision/reason, verified-claim count, latency, or aggregate/domain success.

## Judgment
For each item choose exactly one:
- NORMALIZATION_FAITHFUL: the actual retrieval query preserves the material topic, entities, relationships, qualifiers, polarity/negation, and requested scope of the Turkish question without adding a materially different proposition.
- NORMALIZATION_DRIFT: it does not.

Notes must be concise and must identify any material omission/addition when DRIFT is selected. Do not judge whether the literature contains an answer, whether the checker worked, or whether the generated answer was good.

Output fields, in this exact order:
`rater_id, case_id, judgment, notes`

After all six rows, end with exactly:
`FINAL / LOCKED`

Do not revise ratings after viewing another rater's output.

## Interpretation
This audit is diagnostic evidence for candidate-freeze readiness only. It must not be counted in Golden v1 held-out denominators/numerators and cannot substitute for the preregistered two-rater ON_TOPIC + NORMALIZATION_FAITHFUL gate on otherwise-qualifying Turkish held-out OK rows.
