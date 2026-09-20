# D-022 supportCheck — Statistical Acceptance and Fresh-Holdout Freeze v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE FREEZE OR EXECUTION`

Prepared: 2026-09-20

Upstream preregistration: `docs/experiments/d022-supportcheck-evaluation-preregistration-v0.1.md`  
Canonical requirement: D-022 in `docs/decisions.md`

## Purpose

Freeze the statistical production-acceptance criterion and fresh-holdout design **before** a candidate production `supportCheck` is implemented, tuned, or evaluated against holdout labels.

This document does not select a checker and does not authorize execution or deployment.

## Safety target

Primary failure mode:

> A claim that ground truth marks `UNSUPPORTED` is incorrectly returned by the checker as `ACCEPT`.

Primary metric:

`FPR = false accepts / all ground-truth UNSUPPORTED claims`

The production acceptance rule is based on the **one-sided 95% exact Clopper-Pearson upper confidence bound** for FPR.

### Frozen acceptance threshold

The candidate passes the primary D-022 safety gate only if:

1. observed false accepts = **0** on the fresh holdout's primary unsupported set; and
2. the one-sided 95% exact Clopper-Pearson upper bound for FPR is **< 1.0%**.

No rounding may convert an upper bound equal to or above 1.0% into a pass.

For zero false accepts in `n` unsupported trials, the one-sided exact upper bound is:

`U = 1 - 0.05^(1/n)`

To satisfy `U < 0.01`, at least **299 independent primary unsupported claim instances** are required. Therefore the holdout freezes **300 primary UNSUPPORTED claims**.

At n=300 with zero false accepts, the upper bound is approximately **0.9935%**, satisfying the criterion.

Any observed false accept fails this frozen primary gate for this round. The threshold may not be relaxed after results are seen.

## Why this criterion

D-022 is a fail-closed safety requirement. A point estimate of 0% from a small negative set is not adequate evidence.

The selected design makes the statement precise: after observing zero false accepts among 300 frozen unsupported claims, the exact one-sided 95% upper confidence bound is below 1%.

This is a product/architecture acceptance criterion, not a claim that the true production FPR is known to be zero.

## Fresh holdout composition

The fresh holdout must contain at minimum:

- **300 primary UNSUPPORTED claims** for the primary FPR gate;
- **100 primary SUPPORTED claims** for false-negative/usefulness characterization;
- **60 PARTIALLY_SUPPORTED claims** as a separate challenge stratum.

Total minimum: **460 claim instances**.

The 300 unsupported claims must intentionally cover difficult failure modes rather than trivial negatives. Freeze exactly 50 unsupported claims in each of six strata:

1. **near-miss entailment** — evidence is topically close but does not entail the claim;
2. **quantifier/denominator/scope shift** — e.g. subset -> whole population, enrolled -> completed;
3. **causal/mechanistic overreach** — observation exists but mechanism/causation is unsupported;
4. **temporal/generalization overreach** — evidence supports a bounded period/condition but claim extrapolates beyond it;
5. **conflict-side overclaim** — evidence materially conflicts and claim silently selects or strengthens one side;
6. **citation-valid semantic mismatch** — cited evidence ID exists but does not support the claim.

The 100 supported claims must span the same evidence styles and should include multi-evidence synthesis, numeric statements, bounded comparisons, and explicit uncertainty statements.

The 60 partially supported claims must contain a supported core plus a material unsupported extension. They are not part of the primary binary FPR denominator.

## Independence unit and clustering control

The statistical trial unit is the **claim instance**, but claim instances must not be generated as paraphrase clones.

To reduce pseudo-replication:

- each primary unsupported claim must have its own frozen claim ID;
- no two primary unsupported claims may be mere lexical paraphrases of the same proposition/evidence relation;
- no evidence item may contribute more than **3 primary unsupported claims**;
- no base scenario may contribute more than **6 primary unsupported claims**;
- report FPR both overall and by the six unsupported strata.

The exact confidence calculation treats the 300 claim instances as Bernoulli trials. The anti-cloning constraints above are required because perfect statistical independence cannot be guaranteed for synthetic semantic cases; this limitation must remain explicit in the final report.

## Holdout construction and contamination control

The fresh holdout must be constructed without using the candidate checker's outputs.

Before checker implementation/tuning against the holdout:

1. freeze all claim texts and EvidencePacks;
2. freeze case/stratum assignments;
3. freeze the rater rubric;
4. obtain independent semantic labels;
5. lock the final evaluation subset and its hash;
6. seal labels from the checker implementer until checker code/configuration is frozen.

The checker may be developed using separate development examples, but no holdout claim, evidence pair, label, or minimally transformed derivative may enter checker prompt engineering, threshold selection, few-shot examples, unit tests, or manual tuning.

If contamination is discovered, affected claims are invalidated and may not simply be replaced after checker outputs are known. Close the round and create a newly frozen holdout/version as needed.

## Fresh-holdout raters

Use **two isolated primary AI raters from different model families**, matching the model-diversity discipline used in Round 2 (for example, one ChatGPT-family rater and one Claude-family rater).

Requirements:

- fresh isolated conversations;
- same frozen blind evaluator bundle and rubric;
- no checker outputs;
- no other rater's judgments;
- no provider/model identity of the candidate checker where avoidable;
- both packets must end `FINAL / LOCKED`.

These are AI raters, not human experts. Model diversity reduces same-model correlated-error risk but does not eliminate correlated errors or stylistic identification risk.

## Ground-truth adjudication rule — frozen before rating

Unlike Round 2, the holdout requires a single binary production ground truth for the primary gate. Therefore the adjudication rule is frozen now, before rater outputs exist.

For each claim:

- if both primary raters independently assign `SUPPORTED`, ground truth = `SUPPORTED`;
- if both independently assign `UNSUPPORTED`, ground truth = `UNSUPPORTED`;
- if either rater assigns `PARTIALLY_SUPPORTED`, or the two raters otherwise disagree, the claim is **not eligible for the primary binary set** and moves to the challenge/disagreement stratum.

There is **no post-hoc semantic adjudicator** for the primary gate.

Because exclusions can reduce the binary set below the frozen target, construct an **oversampled candidate pool before rating**. The pool size and deterministic selection rule must be frozen in the holdout-construction artifact before raters see it.

The final primary unsupported set must contain at least 300 exact-agreement UNSUPPORTED claims and preserve at least 50 per unsupported stratum. If this requirement is not met from the pre-frozen candidate pool, the holdout construction fails; do not add cases after seeing ratings. A new holdout version is required.

The final primary supported set must contain at least 100 exact-agreement SUPPORTED claims. Failure to reach it likewise requires a new holdout version.

## Deterministic subset selection

If the pre-frozen candidate pool yields more eligible exact-agreement claims than required, select the evaluation subset without looking at checker outputs:

- sort eligible claims lexicographically by immutable claim ID within each frozen stratum;
- take the first required number from each unsupported stratum;
- for supported claims, use the same lexicographic rule across their frozen supported strata;
- retain all remaining eligible claims as non-primary supplementary observations.

This selection happens before checker execution.

## Secondary metrics

Report, without changing the primary gate:

- false-negative rate on the >=100 consensus-supported primary claims;
- ERROR rate;
- per-stratum unsupported FPR;
- decisions on all PARTIALLY_SUPPORTED claims;
- decisions on primary-rater disagreement claims;
- supplementary eligible claims;
- latency and cost where applicable.

No secondary metric can compensate for failure of the primary FPR gate.

## Round 2 seed benchmark

The 191 locked Round 2 claim instances remain a separate seed/regression benchmark under the upstream preregistration.

They must **not** be counted toward the 300 fresh unsupported claims or the 100 fresh supported claims and do not affect the primary production acceptance calculation.

Results on the seed benchmark are reported separately for continuity/regression evidence.

## Execution prerequisites

Before any measured checker execution:

1. this statistical/holdout freeze receives independent review and is merged;
2. holdout-construction artifact freezes the oversampled pool size and exact contents;
3. both independent AI-rater packets are FINAL/LOCKED;
4. deterministic primary subset is derived and hashed;
5. candidate checker implementation/configuration is frozen without access to sealed holdout labels;
6. evaluation harness and result schema are frozen and independently reviewed;
7. model-backed checker route, if any, has the required Provider Privacy Gate status.

No measured execution is authorized by this document.

## Stop conditions

Stop and open a new version/round if:

- fewer than 300 consensus-UNSUPPORTED claims remain;
- any unsupported stratum has fewer than 50 consensus-UNSUPPORTED claims;
- fewer than 100 consensus-SUPPORTED claims remain;
- holdout contamination is detected;
- candidate checker was tuned against sealed labels;
- metric, confidence method, threshold, decision mapping, or primary subset would need to change after checker results are visible.

## Decision boundary

Passing this gate would establish only that the exact frozen checker met the frozen evidence-support false-positive criterion on this holdout.

It would not:
- establish retrieval truth or relevance;
- certify factual truth beyond the supplied evidence;
- select an Assistant model;
- generalize to a materially changed checker/configuration;
- authorize deployment by itself;
- alter Track A/B or the paused go-live/migration state.

A separate reviewed implementation/deployment decision remains required.

## Next action

Independent reviewer reviews this statistical acceptance and holdout-design proposal. If accepted, the next artifact is the fresh-holdout construction specification and oversampled candidate-pool freeze. No candidate checker should be tuned against holdout labels before that sequence is complete.
