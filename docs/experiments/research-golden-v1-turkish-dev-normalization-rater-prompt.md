# Turkish development normalization blind-audit instructions

Purpose: development-only, pre-freeze audit of the six already executed Turkish development questions. This is not held-out acceptance evidence and does not alter the frozen 7/10 Turkish held-out gate.

## Rater qualification and independence
Use **two independent human raters** competent to read Turkish and assess Turkish-to-English semantic preservation. Neither may be the implementer who tuned the normalization path, the independent code reviewer who has seen the case outcomes, or anyone else who has reviewed the per-case system outcomes before rating.

Before receiving the rater bundle, record for each rater: identifier, basis for Turkish-language competence, and an independence attestation. Each rater locks all six judgments before seeing the other rater's output.

## Blinding
Give raters only `research-golden-v1-turkish-dev-normalization-rater-bundle.json` plus these instructions. Keep the item-id mapping private until both outputs are locked.

Rate only the supplied original Turkish question and actual retrieval query. Do not inspect or use application outcome, checker decision/reason, verified-claim count, latency, aggregate/domain success, repository issues/PRs, workflow artifacts, or evaluation results concerning these items until after `FINAL / LOCKED`.

## Judgment
For each item choose exactly one:
- NORMALIZATION_FAITHFUL: the actual retrieval query preserves the material topic, entities, relationships, qualifiers, polarity/negation, and requested scope of the Turkish question without adding a materially different proposition.
- NORMALIZATION_DRIFT: it does not.

Notes must be concise and must identify any material omission/addition when DRIFT is selected. Do not judge whether the literature contains an answer, whether the checker worked, or whether the generated answer was good.

Output fields, in this exact order:
`rater_id, item_id, judgment, notes`

After all six rows, end with exactly:
`FINAL / LOCKED`

Do not revise ratings after viewing another rater's output.

## Pre-stated interpretation
Every `NORMALIZATION_DRIFT` judgment and every inter-rater disagreement will be reported; neither may be adjudicated upward inside this development audit. Results are diagnostic evidence for candidate-freeze readiness only. If they motivate a normalizer change, that change must be generic (no benchmark-specific mappings), separately reviewed with regression coverage, and completed before candidate freeze. A changed normalizer requires a fresh development audit before freeze.

This audit must not be counted in Golden v1 held-out denominators/numerators and cannot substitute for the preregistered two-rater `ON_TOPIC + NORMALIZATION_FAITHFUL` gate on otherwise-qualifying Turkish held-out `OK` rows.
