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

## Status vocabulary

- `PROPOSED`
- `LOCKED`
- `SUPERSEDED`

For `experimental-outcome`, outcome is additionally one of:
- `ADOPTED`
- `REJECTED`
- `INCONCLUSIVE`

## Canonical-record routing

To preserve a single source of truth:

- `experimental-outcome` -> `docs/experiments/<slug>.md`
- `architecture` -> `docs/architecture/<slug>.md`
- `privacy/security` -> `docs/privacy/<slug>.md`
- `product-scope` -> the narrowest relevant product/spec document; create one if the decision cannot be represented safely in this log alone
- `process-rule` -> may remain canonical in this file when the rule is short and self-contained

A decision that spans more than one type may list multiple canonical references. Each referenced document is authoritative only for its own dimension; protocol results belong to the experiment record, while architecture consequences belong to the architecture record. `decisions.md` is the cross-reference and decision index, not a duplicate source.

`decisions.md` stores only the decision, type(s), status/outcome, short reason, provenance, and canonical reference(s). Detailed protocols, amendments, evidence tables, or implementation specifications must live in canonical records, not be duplicated here.

## Decision provenance

Every decision created or materially changed from reviewer input must include a `Provenance` field identifying the reviewer packet/session or other traceable source. This is not an assertion that the reviewer made the final decision; it permits later verification that the main-thread transcription/classification faithfully reflects the source finding.

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

Before sending any full Reviewer Packet, the main engineering thread must pass the mandatory checklist in `docs/reviewer-packet-checklist.md`. If any listed raw material is absent, stale, partial while labeled full, or inaccessible, the packet is `INCOMPLETE — DO NOT SEND AS FULL REVIEW PACKET`.

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
- Provenance: main-thread governance design, 2026-09-10.
- Canonical record: this file.

## D-002

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Reviewer packets must expose raw materials in addition to implementer summaries and must explicitly permit proposal-external findings.
- Reason: Reduce anchoring and curated-evidence risk in red-team review.
- Provenance: reviewer governance review, 2026-09-10.
- Canonical record: this file.

## D-003

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Blind evaluations requiring independence must run in a physically separate fresh conversation with minimum necessary context.
- Reason: Prevent context leakage and anchoring from prior labels, mappings, and discussion.
- Provenance: P0.5-A rater reconciliation experience.
- Canonical record: this file.

## D-004

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Seen diagnostic data may not be reused as a future gate set for the same line of development.
- Reason: Prevent test-set contamination and post-hoc optimization.
- Provenance: P0.5-A post-evaluation review.
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
- Status: `SUPERSEDED`
- Decision: Restrict P0.5 to semantic reranking of lexical candidates only.
- Reason: Later semantic-vs-lexical diagnostics found a material retrieval-level recall gap.
- Provenance: semantic-gap diagnostic and reviewer challenge to candidate-pool adequacy.
- Canonical reference: `docs/architecture/research-retrieval.md`

## D-007

- Types: `architecture`, `experimental-outcome`
- Status: `PROPOSED`
- Decision: Evaluate a three-arm P0.5 retrieval design: lexical (L), semantic (S), and hybrid lexical+semantic (H).
- Reason: OpenAlex corpus-level semantic retrieval surfaced many high-relevance works absent from lexical top-100 pools; production architecture remains contingent on a preregistered fresh-holdout experiment.
- Provenance: semantic-gap diagnostic; architecture remains a proposal pending P0.5 hybrid experiment.
- Canonical references:
  - Architecture dimension: `docs/architecture/research-retrieval.md`
  - Experimental dimension: `docs/experiments/p05-hybrid-semantic.md` (to be created at preregistration)

## D-008

- Type: `privacy/security`
- Status: `LOCKED`
- Decision: Never claim more evidence than the system has actually seen.
- Reason: Preserve evidence integrity across metadata/abstract/full-text levels.
- Provenance: main research architecture invariant.
- Canonical reference: `docs/privacy/research-privacy.md`

## D-009

- Type: `privacy/security`
- Status: `LOCKED`
- Decision: Never expose a user's research interests to anyone other than that user; institutional analytics, if added, must be aggregate-only with no stored queries, topics, or user IDs.
- Reason: Preserve research-interest privacy.
- Provenance: main research privacy invariant.
- Canonical reference: `docs/privacy/research-privacy.md`

## D-010

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Reviewer-derived decisions must carry traceable provenance; material out-of-scope findings require explicit main-thread triage; mixed/inconclusive reconciliation observations do not close source conflicts.
- Reason: Prevent transcription drift, orphaned reviewer findings, and false reconciliation.
- Provenance: reviewer governance review, 2026-09-10.
- Canonical record: this file.

## D-011

- Type: `process-rule`
- Status: `LOCKED`
- Decision: A full Reviewer Packet may not be sent until every listed RAW MATERIALS item passes an explicit completeness check for presence/accessibility, currency, and full-vs-excerpt labeling.
- Reason: Two consecutive packets claimed that raw canonical files were attached/pasted when they were not; a declarative rule alone did not prevent recurrence.
- Provenance: `OUT-OF-SCOPE FINDING — Reviewer Packet oluşturma sürecinde tamlık kontrolü yok`, reviewer feedback, 2026-09-10.
- Canonical reference: `docs/reviewer-packet-checklist.md`
- Triage: `OPEN -> RESOLVED BY PROCESS CONTROL` through mandatory pre-send checklist implementation.

Last updated: 2026-09-10
