# D-023 — D-022 H2 risk-acceptance ("Path B") — deferred holdout with monitored trigger conditions

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`
Date: 2026-09-28

## Decision

Production activation of `supportCheck` (Fresh-Checker v0.4.x, `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli`
@ `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`) proceeds without first executing the full
preregistered D022-H2 statistical holdout (1,080 claims / 180 scenarios,
`docs/experiments/d022-supportcheck-h2-preregistration-v0.1.md`).

This is a proposed human-authorized risk acceptance, not a claim that the holdout requirement is
satisfied. The Fresh-Checker qualification/freeze line (A1, A2, Stage-B) remains CLOSED.
The 1,080-claim/180-scenario H2 statistical holdout remains NOT EXECUTED and is explicitly
deferred, not waived.

## Rationale — and its limits

Executing the full holdout now materially delays project completion. However, the existing
all-or-nothing grounding contract is **not** an independent semantic backstop against
`supportCheck` false positives. The Grounding Validator's fail-closed behavior is a
**structural** check (evidence array present, references valid) — it does not independently
re-verify entailment. If `supportCheck` incorrectly labels an UNSUPPORTED claim as SUPPORT,
and that claim carries a structurally valid `evidence_id` (real evidence that does not
actually entail the claim), the fail-closed mechanism does not catch it. A `supportCheck`
false positive is therefore, by itself, a sufficient path for an unsupported claim to reach
the user. This decision accepts that residual risk explicitly, rather than treating the
fail-closed architecture as a substitute mitigant for it.

## Trigger criteria — when further holdout validation must be executed

Two-tier, to avoid production query-mix drift producing false alarms:

**(A) Immediate trigger** — the non-holdout regression/canary set (below) surfaces a
`supportCheck` false positive (an UNSUPPORTED or fabricated claim classified SUPPORT) that
does not match a failure pattern already characterized in Stage-B/H1 evidence. Triggers
holdout validation directly.

**(B) Investigation trigger** — aggregate production SUPPORT/CONTRADICTS/NOT_SUPPORTING rate
telemetry shows a predetermined deviation from the regression/canary set's own observed rate
distribution over a rolling 7-day window. This alone does **not** trigger holdout validation;
it triggers investigation. It escalates to a holdout-validation trigger only if independently
confirmed by a labeled failure on the regression/canary set. (Stage-B's 12 qualification cases
are not used as the statistical baseline — too small a sample and not representative of
production query composition.)

When a trigger fires, execute **either**: the frozen preregistered 1,080-claim H2 holdout
as-is, **or** a separately preregistered and independently reviewed successor validation
protocol with its own explicit sample-size/power justification. A smaller sample (e.g.
200–300 claims) may not be selected ad hoc after the fact and designated as "H2 executed" —
doing so would silently amend the frozen preregistration.

Either trigger tier pauses new production reliance on `supportCheck`-gated claims pending
validation; it does not require reverting the fail-closed architecture itself.

## Monitoring mechanism (privacy-compliant — D-009)

1. **Non-holdout regression/canary set** — a fixed, non-user-derived set spanning U1–U6
   stratum types, run on every deploy and daily. This is a regression-detection instrument,
   not independent validation evidence — it does not substitute for the deferred H2 holdout.
2. **Aggregate rate monitoring** — SUPPORT/CONTRADICTS/NOT_SUPPORTING counts via the existing
   atomic D1 UPSERT counter pattern (no query text, topics, or user IDs stored), used only as
   a drift signal per trigger tier (B) above.
3. **Internal-team-only testing** — real-shaped (not real customer) queries during staged
   rollout.

Explicitly excluded, per D-009: sampling or human review of real-user query content for QA.
Any future proposal to do so requires a separate, independent privacy/consent review.

## Related, distinct risk: all-or-nothing grounding contract UX impact

Staging E2E smoke acceptance criteria add a **grounded-response rate** metric (share of
eligible queries receiving a fully-grounded `OK` response vs. a fail-closed state), measured
against the regression/canary set and internal-team traffic. If low, review prompt/
evidence-pack design or the all-or-nothing policy itself (D-020) — not add further
`supportCheck` validation.

## Open items — not yet resolved, block full readiness of this decision

- `supportCheck` service missing/error/timeout/invalid-result behavior must be verified in
  the wired implementation and CI/integration tests. Under the existing all-or-nothing
  grounding contract, these conditions must not produce a grounded `OK` response; the
  implementation must fail closed. An operational mechanism to pause production reliance on
  `supportCheck`-gated claims (independent of the fail-closed check itself) must exist and be
  exercised in CI/staging before production authorization, so that a trigger event can
  actually be acted on.

- Qualification/Stage-B language coverage must be established before production
  authorization. Any production language not covered by accepted checker validation
  evidence (including Turkish, if unsupported by that evidence) remains outside the
  authorized `supportCheck` production scope until separately validated.

- Aggregate-drift trigger rule (Trigger B) is not yet frozen. Before production monitoring
  begins, the regression/canary baseline window, minimum observation count, deviation
  statistic/threshold, rolling-window treatment, and investigation/escalation rule must be
  specified prospectively and independently reviewed. No threshold may be selected or
  retuned after observing production telemetry, for the purpose of avoiding or causing a
  trigger.

## Explicitly out of scope

- Does not close or modify D-022 H1 or the H2 preregistration.
- Does not authorize semantic-primary (D-016) or production D1 migration (Track B).
- Does not authorize real-user-content sampling for QA.
- Does not waive the holdout requirement — defers execution under stated trigger conditions.

## Authority

Proposed decision authority: Altan. This record becomes `ADOPTED` only after Altan explicitly
approves the independently reviewed final text. It is not decided or authorized by the
reviewer or implementer threads.
