# LibEdge — Decision Log

> SINGLE-WRITER INVARIANT
> This control-plane file is modified only from the main engineering thread under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only. Their outputs must return to the main thread before any project-state change is recorded.

## Decision classes

- `process-rule`
- `architecture`
- `experimental-outcome`
- `privacy/security`
- `product-scope`

A decision may have more than one type when it materially spans domains.

## Decision lifecycle vocabulary

- `PROPOSED` — under consideration; not adopted.
- `LOCKED` — adopted/governing until explicitly changed.
- `REJECTED` — evaluated/considered but never adopted as governing state.
- `SUPERSEDED` — previously LOCKED/adopted, then replaced by a later decision.

Allowed lifecycle transitions:
- `PROPOSED -> LOCKED`
- `PROPOSED -> REJECTED`
- `LOCKED -> SUPERSEDED`

`SUPERSEDED` must not be used merely to mean “an idea we stopped considering.”

For `experimental-outcome`, outcome is additionally one of:
- `ADOPTED`
- `REJECTED`
- `INCONCLUSIVE`

## File-level status vocabulary

Canonical-file status is separate from decision lifecycle status and must use one of:

- `ACTIVE` — currently governing/current canonical operational record.
- `HISTORICAL` — canonical record of a closed experiment/event; retained for audit/history, not governing current product behavior.
- `SUPERSEDED` — the file itself has been replaced by another canonical record; replacement must be named.

A file may add descriptive qualifiers after the controlled status, but the first status token must be one of the three above.

## Canonical-record routing

To preserve a single source of truth:

- `experimental-outcome` -> `docs/experiments/<slug>.md`
- `architecture` -> `docs/architecture/<slug>.md`
- `privacy/security` -> `docs/privacy/<slug>.md`
- `product-scope` -> the narrowest relevant product/spec document; create one if the decision cannot be represented safely in this log alone
- `process-rule` -> may remain canonical in this file when the rule is short and self-contained

A decision that spans more than one type may list multiple canonical references. Each referenced document is authoritative only for its own dimension; protocol results belong to the experiment record, while architecture consequences belong to the architecture record. `decisions.md` is the cross-reference and decision index, not a duplicate source.

`decisions.md` stores only the decision, type(s), lifecycle status/outcome, short reason, provenance, and canonical reference(s). Detailed protocols, amendments, evidence tables, or implementation specifications must live in canonical records, not be duplicated here.

## Decision provenance

Every decision created or materially changed from reviewer input must include a `Provenance` field identifying a concrete review artifact/session, preferably `docs/reviews/<...>.md` plus packet ID when available.

Generic descriptions such as “reviewer governance review, 2026-09-10” alone are insufficient for new reviewer-derived decisions.

This is not an assertion that the reviewer made the final decision; it permits later verification that the main-thread transcription/classification faithfully reflects the source finding.

When no reviewer was involved, record the originating experiment, diagnostic, main-thread decision, or source record instead.

## Source-evidence record format

When an external source materially supports a decision, record in the canonical document:

- Claim
- Source(s)
- Checked date
- Conflict status
- Reconciliation trigger
- Consequence

If official sources conflict, do not silently select one. Record the conflict explicitly and use the conservative interpretation when necessary.

A source conflict must include a concrete reconciliation trigger. Preferred trigger: a real live provider call or telemetry observation that can directly measure the disputed field/value.

A trigger observation closes a conflict only when it is unambiguous and sufficient to distinguish the competing claims. If the observation is mixed, incomplete, or itself inconsistent, the conflict remains open, the conservative interpretation remains in force, and the record must specify the next review trigger or observation count before reconsideration. An unresolved conflict may not be silently treated as reconciled merely because a trigger fired.

## Reviewer governance

Reviewer packets must include both a concise implementer summary and access/references to raw materials. A packet that asks the reviewer to treat raw materials as authoritative but does not actually provide accessible raw materials is incomplete and must not be represented as a full red-team review.

Before sending any full Reviewer Packet, the main engineering thread must pass the mandatory checklist in `docs/reviewer-packet-checklist.md` **and embed the completed attestation in the packet itself**. The existence of the checklist file alone does not satisfy the control.

Required reviewer output categories:

- `ACCEPTED` — implementer proposal accepted as stated
- `ACCEPTED WITH MODIFICATION` — underlying direction accepted but decision/implementation changed
- `REJECTED` — implementer proposal rejected
- `OUT-OF-SCOPE FINDING` — material finding discovered while reviewing that is not itself an evaluation of the proposal

Reviewer freedom invariant: the reviewer is not limited to the implementer framing and may inspect raw materials independently.

### OUT-OF-SCOPE FINDING triage

Every material `OUT-OF-SCOPE FINDING` must return to the main engineering thread and receive exactly one explicit triage disposition:

1. `OPEN` — create a new decision, experiment, risk, or follow-up task with a canonical reference where appropriate.
2. `ACKNOWLEDGED / DEFERRED` — finding accepted as valid but no action is currently taken; record reason and revisit trigger if one exists.
3. `REJECTED` — finding is not carried forward; record reason.

An out-of-scope finding may not disappear merely because it does not modify the active proposal.

Blind-evaluator invariant: a blind evaluator is not a reviewer. It receives only the frozen evaluation bundle and rubric required for the task, with no mapping, previous labels, prior gate results, or discussion context.

---

## D-001

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Only the main engineering thread may write `docs/current-state.md` and `docs/decisions.md`.
- Reason: Prevent reviewer/evaluator outputs from becoming project state before human-gated reconciliation.
- Provenance: main-thread governance design; indexed by `docs/reviews/2026-09-10-governance-red-team.md` for later governance review.
- Canonical record: this file.

## D-002

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Reviewer packets must expose raw materials in addition to implementer summaries and must explicitly permit proposal-external findings.
- Reason: Reduce anchoring and curated-evidence risk in red-team review.
- Provenance: `docs/reviews/2026-09-10-governance-red-team.md`; Reviewer Packet `91637` and prior governance-review thread.
- Canonical record: this file.

## D-003

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Blind evaluations requiring independence must run in a physically separate fresh conversation with minimum necessary context.
- Reason: Prevent context leakage and anchoring from prior labels, mappings, and discussion.
- Provenance: P0.5-A rater reconciliation; canonical experiment record `docs/experiments/p05a-lexical.md`.
- Canonical record: this file.

## D-004

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Seen diagnostic data may not be reused as a future gate set for the same line of development.
- Reason: Prevent test-set contamination and post-hoc optimization.
- Provenance: P0.5-A post-evaluation review; `docs/experiments/p05a-lexical.md`.
- Canonical record: this file.

## D-005

- Type: `experimental-outcome`
- Status: `LOCKED`
- Outcome: `REJECTED`
- Decision: The conditional lexical phrase heuristic will not ship and no second lexical-tuning round will be opened.
- Reason: P0.5-A reached Gate A2 FAIL and Gate B FAIL under both rating definitions.
- Provenance: `docs/experiments/p05a-lexical.md` final evaluation.
- Canonical reference: `docs/experiments/p05a-lexical.md`

## D-006

- Type: `architecture`
- Status: `REJECTED`
- Decision: Restrict P0.5 to semantic reranking of lexical candidates only.
- Reason: The idea was never adopted as governing/production architecture; later semantic-vs-lexical diagnostics showed a material retrieval-level recall gap.
- Provenance: semantic-gap diagnostic plus reviewer challenge; see `docs/reviews/2026-09-10-governance-red-team.md` and `docs/architecture/research-retrieval.md`.
- Canonical reference: `docs/architecture/research-retrieval.md`

## D-007

- Type: `experimental-outcome`
- Status: `LOCKED`
- Decision: Execute the frozen three-arm P0.5 retrieval experiment using lexical (L), semantic (S), and hybrid lexical+semantic (H) exactly as specified in `docs/experiments/p05-hybrid-semantic.md`.
- Reason: The L/S/H experimental design and preregistration are frozen; locking this decision authorizes experiment execution only and does not adopt any arm as production retrieval architecture.
- Provenance: semantic-gap diagnostic; frozen preregistration and technical/governance review recorded in `docs/reviews/2026-09-10-governance-red-team.md`.
- Canonical reference: `docs/experiments/p05-hybrid-semantic.md`

## D-016

- Type: `architecture`
- Status: `PROPOSED`
- Decision: Adopt lexical (L), semantic (S), or hybrid lexical+semantic (H) as the production retrieval architecture only after the frozen P0.5 experiment is completed and a separate post-experiment architecture decision is made.
- Reason: Experiment execution is now locked, but production architecture remains contingent on fresh-holdout evidence, the preregistered A/B decision matrix, S-vs-L evidence, and a later architecture decision.
- Provenance: split from the former mixed architecture/experimental D-007 during pre-retrieval governance cleanup; no frozen experimental parameter changed.
- Canonical references:
  - Architecture dimension: `docs/architecture/research-retrieval.md`
  - Experimental evidence: `docs/experiments/p05-hybrid-semantic.md`

## D-008

- Type: `privacy/security`
- Status: `LOCKED`
- Decision: Never claim more evidence than the system has actually seen.
- Reason: Preserve evidence integrity across metadata/abstract/full-text levels.
- Provenance: main research architecture invariant; canonical record `docs/privacy/research-privacy.md`.
- Canonical reference: `docs/privacy/research-privacy.md`

## D-009

- Type: `privacy/security`
- Status: `LOCKED`
- Decision: Never expose a user's research interests to anyone other than that user; institutional analytics, if added, must be aggregate-only with no stored queries, topics, or user IDs.
- Reason: Preserve research-interest privacy.
- Provenance: main research privacy invariant; canonical record `docs/privacy/research-privacy.md`.
- Canonical reference: `docs/privacy/research-privacy.md`

## D-010

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Reviewer-derived decisions must carry traceable provenance; material out-of-scope findings require explicit main-thread triage; mixed/inconclusive reconciliation observations do not close source conflicts.
- Reason: Prevent transcription drift, orphaned reviewer findings, and false reconciliation.
- Provenance: `docs/reviews/2026-09-10-governance-red-team.md`.
- Canonical record: this file.

## D-011

- Type: `process-rule`
- Status: `LOCKED`
- Decision: A full Reviewer Packet may not be sent until every listed RAW MATERIALS item passes an explicit completeness check and the completed attestation is embedded in the packet itself.
- Reason: Two consecutive packets claimed that raw canonical files were attached/pasted when they were not; a declarative checklist file alone did not prevent recurrence.
- Provenance: `docs/reviews/2026-09-10-governance-red-team.md`, findings G-01/OOS-02.
- Canonical reference: `docs/reviewer-packet-checklist.md`
- Triage: `OPEN -> RESOLVED BY PROCESS CONTROL` through embedded pre-send attestation.

## D-012

- Type: `architecture`
- Status: `LOCKED`
- Decision: Treat OpenAlex semantic search as a 1 request/second dependency during P0.5 feasibility work and design experiment execution/budgeting accordingly.
- Reason: Current official semantic-search documentation specifies a 1 request/second semantic-search limit, which is stricter than the general API ceiling.
- Provenance: OOS-01 in `docs/reviews/2026-09-10-governance-red-team.md`; official OpenAlex semantic-search documentation rechecked 2026-09-10.
- Canonical reference: `docs/architecture/research-retrieval.md`

## D-013

- Type: `architecture`
- Status: `LOCKED`
- Decision: For P0.5 planning, OpenAlex authenticated `search.semantic` is charged at the observed live rate of `$0.001 per call` (`$1 / 1,000` semantic calls).
- Reason: Three successful authenticated semantic calls returned `meta.cost_usd = 0.001`, `X-RateLimit-Cost-USD = 0.001`, and `X-RateLimit-Credits-Used = 10` on 3/3 observations; the explicit `search.semantic` request shape and distinct lexical-control result set verified retrieval mode. The previously conflicting `$10/1,000` documentation example remains historical conflict evidence.
- Provenance: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`; reviewer acceptance/freeze authorization returned to the main engineering thread on 2026-09-10.
- Canonical reference: `docs/architecture/research-retrieval.md`
- Reopen trigger: materially different authenticated `meta.cost_usd`, `X-RateLimit-Cost-USD`, or equivalent charged-credit telemetry observed in diagnostic or production operation.

## D-014

- Types: `architecture`, `experimental-outcome`
- Status: `LOCKED`
- Decision: The H arm must not be executed or evaluated until its fusion/ranking algorithm, tie-breaking, candidate depths, and any score normalization are explicitly specified and frozen in the P0.5 hybrid preregistration.
- Reason: “Frozen deterministic fusion/ranking” currently names a requirement, not an algorithm; leaving it undefined would permit post-hoc tuning and invalidate a clean L/S/H comparison.
- Provenance: OOS-01 in `docs/reviews/2026-09-10-governance-red-team.md`.
- Canonical references:
  - Architecture constraint: `docs/architecture/research-retrieval.md`
  - Experimental protocol: `docs/experiments/p05-hybrid-semantic.md`

## D-015

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Canonical files and decision records use separate controlled status vocabularies; `SUPERSEDED` is reserved for previously adopted/LOCKED state, while never-adopted proposals use `REJECTED`.
- Reason: Prevent readers from inferring that a discarded proposal was once production/governing state and remove free-form file-status ambiguity.
- Provenance: governance findings G-03/G-04 in `docs/reviews/2026-09-10-governance-red-team.md`.
- Canonical record: this file.

Last updated: 2026-09-10
