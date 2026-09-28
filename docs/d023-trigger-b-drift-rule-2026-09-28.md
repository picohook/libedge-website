# D-023 Open Item #3 — Trigger-B Prospective Drift Rule

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`

Date: 2026-09-28

## Purpose

Prospectively specify the aggregate-rate investigation trigger required by D-023 before any production monitoring begins. This is an operational drift signal, not a statistical validation of supportCheck and not a substitute for the deferred H2 holdout.

## Privacy boundary

Only aggregate counts of checker outcomes are used:

- SUPPORT;
- CONTRADICTS;
- NOT_SUPPORTING.

Do not store query text, evidence text, topics, inferred research interests, user IDs, or per-user linkage for this trigger.

## Baseline

The baseline is produced only from the fixed, non-user-derived regression/canary set required by D-023.

Before production monitoring can use Trigger B:

1. the canary set and exact checker/runtime pin must be frozen;
2. at least 7 complete scheduled canary executions on separate calendar days must be recorded;
3. every execution must use the same frozen canary inputs and checker/runtime pin;
4. incomplete/error runs are recorded as operational failures and are not silently removed from the record;
5. the aggregate baseline proportions for SUPPORT, CONTRADICTS, and NOT_SUPPORTING are frozen before any production-rate comparison is inspected.

A deploy-triggered canary run may provide additional regression evidence but does not replace the requirement for 7 separate daily baseline executions.

Because repeated fixed-canary outcomes are not independent random samples of production traffic, Trigger B does not use a p-value or claim population-level statistical significance.

## Production observation window

Production monitoring uses a rolling 7-day aggregate window.

A window is eligible for drift evaluation only when it contains at least **500 checker decisions** within the already-authorized language/scope boundary. If fewer than 500 decisions exist, the result is `INSUFFICIENT_VOLUME`; no drift conclusion is drawn and counts roll naturally into later 7-day windows.

The window advances once per UTC day. Intraday repeated evaluation is not used to hunt for a threshold crossing.

## Drift statistic

For category set C = {SUPPORT, CONTRADICTS, NOT_SUPPORTING}, let:

- `p_c` = frozen canary baseline proportion for category c;
- `q_c` = current eligible rolling-7-day production proportion for category c.

Define total-variation distance:

`TVD = 0.5 * sum_c |q_c - p_c|`.

Also compute:

`MAX_DELTA = max_c |q_c - p_c|`.

A single eligible window is a **drift candidate** only when both are true:

- `TVD >= 0.15`; and
- `MAX_DELTA >= 0.10`.

These thresholds are frozen prospectively by this record. They may not be tuned after observing production telemetry to avoid or cause a trigger.

## Persistence rule

One drift-candidate window is recorded as `WATCH`, not an investigation trigger.

Trigger-B investigation begins only when **two consecutive eligible daily evaluations** are drift candidates under the frozen rule. A day with `INSUFFICIENT_VOLUME` breaks consecutiveness rather than being treated as drift or no-drift.

This persistence rule reduces reaction to one transient query-mix shift while preserving the adopted D-023 requirement that aggregate production drift can initiate investigation.

## Investigation and escalation

When the persistence rule fires:

1. mark Trigger B `INVESTIGATE`;
2. do not inspect or sample real-user query/evidence content;
3. run the frozen non-user-derived regression/canary set under the exact production checker/runtime pin;
4. independently label and review any canary failure identified by that run.

Trigger B escalates to the D-023 holdout-validation trigger only if the investigation confirms a labeled checker failure on the regression/canary set.

Aggregate-rate drift alone never establishes a supportCheck false positive and never counts as H2 execution.

If a confirmed canary false positive matches D-023 Trigger A, the immediate Trigger-A rule governs and production reliance is paused without waiting for another Trigger-B window.

## Operational states

The monitoring implementation should expose only these Trigger-B states:

- `BASELINE_NOT_FROZEN`
- `INSUFFICIENT_VOLUME`
- `NORMAL`
- `WATCH`
- `INVESTIGATE`
- `ESCALATED`

State transitions must be auditable from aggregate counters and canary execution records without retaining user content.

## Change control

After adoption, changing the baseline construction, 500-decision minimum, 7-day window, TVD threshold, MAX_DELTA threshold, persistence rule, or escalation rule is a material D-023 monitoring change. It requires a prospective PR, independent review, and human adoption before the changed rule is used.

No retrospective threshold retuning is permitted against already-observed production telemetry.

## Non-goals

This record does not:

- authorize production activation;
- authorize collection or human review of real-user content;
- close D-023 open item #1 or #2;
- validate the checker statistically;
- execute or waive the 1,080-claim H2 holdout;
- authorize semantic-primary D-016 or Track B;
- define the fixed canary-set content itself.

## Canonical reference

- `docs/d023-d022-h2-path-b-risk-acceptance-2026-09-28.md`
