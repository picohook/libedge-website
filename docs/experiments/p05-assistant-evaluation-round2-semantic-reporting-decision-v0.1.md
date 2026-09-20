# P0.5 Assistant Evaluation — Round 2 Semantic Rating Reporting Decision v0.1

Status: `FROZEN CANDIDATE / AUDIT REVIEW REQUIRED`

## Purpose

This document freezes the reporting rule for the two independent primary AI semantic ratings before preparation of the final Round 2 evaluation report.

The original preregistration required two independent primary raters to lock their judgments before reconciliation, but it did not preregister an adjudication rule for disagreements. Both primary packets are now `FINAL / LOCKED`. Because the disagreement pattern is already known, selecting an adjudication rule now could introduce post-hoc discretion.

## Frozen decision: no reconciliation / no adjudicated single semantic score

Round 2 will therefore report the two locked primary ratings side by side. No disagreement will be resolved by choosing R1, choosing R2, taking the stricter label, averaging labels, majority voting, or using a third adjudicator for the primary Round 2 report.

This is a reporting decision, not a retroactive change to either rater's judgments. The raw R1 and R2 packets remain immutable.

## Required reporting

The final Round 2 report must preserve and report, at minimum:

- R1 and R2 claim-label distributions separately.
- Raw claim-level agreement and disagreement counts/rate.
- The locations and qualitative pattern of disagreements without declaring either rater correct.
- R1 and R2 case-level usefulness results separately.
- Fail-closed and conflict-handling results from each rater separately.
- The fact that the two raters were isolated AI raters from different model families, not human experts.
- The existing caveat that model-family diversity reduces same-model correlated-error risk but does not eliminate correlated errors or stylistic identification risk.

Observed locked primary-rating facts may be reported descriptively:
- 191 factual claims per rater.
- R1: 170 SUPPORTED, 19 PARTIALLY_SUPPORTED, 2 UNSUPPORTED.
- R2: 179 SUPPORTED, 12 PARTIALLY_SUPPORTED, 0 UNSUPPORTED.
- Exact claim-label agreement: 178/191 (93.2%); 13 disagreements.
- Claim-label disagreements are concentrated in E21 and E23.
- Usefulness disagreements must likewise be reported as rater-specific results rather than collapsed into a single adjudicated value.

## C3–C6 interpretation

C3 and C6 must not be presented as a single reconciled/adjudicated value. Report the rater-specific values and agreement/disagreement information.

C4 and C5 may be described as concordant only where both locked raters independently reached the same result; the underlying rater-specific observations must remain auditable.

No composite semantic score will be created.

## Boundary

This decision is made after the disagreement pattern became visible. It is explicitly recorded as such rather than represented as preregistered.

It does not alter Round 1, the deterministic Round 2 C1/C2 measurements, latency, token/cost measurements, or either primary semantic-rating packet.

It does not authorize model selection, deployment, production adoption, or a superiority claim.

Any future adjudicated analysis or third-rater exercise must be clearly labeled as a separate post-hoc/sensitivity analysis and must not replace the locked primary Round 2 results.
