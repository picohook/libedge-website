# Governance Red-Team Review — 2026-09-10

Status: `CLOSED — FINDINGS TRIAGED`
Review type: independent reviewer / red team (not blind evaluation)
Origin: reviewer response following Reviewer Packet `91637`, 2026-09-10

## Scope

Review of the actual canonical governance files:
- `docs/current-state.md`
- `docs/decisions.md`
- `docs/experiments/p05a-lexical.md`
- `docs/architecture/research-retrieval.md`
- `docs/privacy/research-privacy.md`
- `docs/reviewer-packet-checklist.md`

## Positive verification

The reviewer independently checked the migrated P0.5-A numeric results and found the TP/FP/FN/TN, precision/recall, mean-gain, and discipline breakdown consistent with the original evaluation. No silent historical rewrite was identified in those metrics.

## Governance finding G-01

Classification: `ACCEPTED WITH MODIFICATION`

Finding: D-011 correctly diagnosed that a declarative completeness rule had failed twice, but the checklist itself remained declarative. A packet could still be sent without evidence that the checklist had actually been completed.

Disposition: require every full Reviewer Packet to embed a completed per-material attestation mini-form. The packet itself must show `[x]`/YES for each RAW MATERIAL and consistency item before it can be labeled COMPLETE.

## Governance finding G-02

Classification: `ACCEPTED WITH MODIFICATION`

Finding: `current-state.md` omitted several active canonical records from its Canonical records section.

Disposition: make the list complete for current governance/architecture/privacy/checklist records.

## Governance finding G-03

Classification: `ACCEPTED WITH MODIFICATION`

Finding: decision-level and file-level status semantics were not formally related. Canonical files used free-form status strings.

Disposition: define a file-status vocabulary (`ACTIVE`, `HISTORICAL`, `SUPERSEDED`) separately from decision lifecycle status and require canonical files to use it.

## Governance finding G-04

Classification: `ACCEPTED WITH MODIFICATION`

Finding: D-006 was marked `SUPERSEDED` even though the reranking-only architecture was never adopted/locked for production.

Disposition: add decision lifecycle state `REJECTED`; use `PROPOSED -> REJECTED` for evaluated but never adopted proposals. Reserve `SUPERSEDED` for previously `LOCKED` decisions replaced by a later decision. Reclassify D-006 as `REJECTED`.

## Governance finding G-05

Classification: `ACCEPTED WITH MODIFICATION`

Finding: several Provenance fields were descriptive but not traceable to a specific review artifact/session.

Disposition: reviewer-derived decisions must cite this or another concrete `docs/reviews/...` record (and packet ID when available), not only a generic date/description.

## Governance finding G-06

Classification: `ACCEPTED WITH MODIFICATION`

Finding: P0.5-A amendment history omitted the explicit methodological decision separating `missed veto` (non-veto + harmful) from the false-veto confusion-matrix metric.

Disposition: append a historical amendment note documenting that decision without changing the final metrics or locked protocol.

## OUT-OF-SCOPE finding OOS-01

Finding: technical reviewer observations about OpenAlex semantic pricing, semantic-specific rate limiting, and undefined hybrid fusion had not entered canonical project state.

Main-thread triage: `OPEN`.

Sub-triage after official-source verification on 2026-09-10:
- Semantic rate limit: CONFIRMED at 1 request/second; record as active operational constraint.
- Semantic pricing: current official OpenAlex pricing pages converge on $1 per 1,000 semantic-search calls. A previously reported $10/1,000 conflict is treated as historical/conflict evidence, not a currently active pricing fact, unless the conflicting official source is reproduced or observed again.
- Hybrid fusion algorithm: CONFIRMED UNDEFINED in current architecture record. Must be specified and frozen in the P0.5 hybrid preregistration before the H arm can be executed.

## OUT-OF-SCOPE finding OOS-02

Finding: checklist enforcement remained declaration-based.

Main-thread triage: `OPEN -> RESOLVED BY PROCESS CONTROL` through embedded packet attestation requirements.

Last updated: 2026-09-10
