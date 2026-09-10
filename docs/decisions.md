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

`decisions.md` stores only the decision, type, status/outcome, short reason, and canonical reference. Detailed protocols, amendments, evidence tables, or implementation specifications must live in the canonical record, not be duplicated here.

## Source-evidence record format

When an external source materially supports a decision, record in the canonical document:

- Claim
- Source(s)
- Checked date
- Conflict status
- Reconciliation trigger
- Consequence

If official sources conflict, do not silently select one. Record the conflict explicitly and use the conservative interpretation when necessary.

A source conflict must include a concrete reconciliation trigger. Preferred trigger: the next real live provider call or telemetry observation that can directly measure the disputed field/value. When the trigger occurs, update or close the conflict record; do not allow `unresolved` to persist indefinitely without a defined observation path.

## Reviewer governance

Reviewer packets must include both a concise implementer summary and access/references to raw materials.

Required reviewer output categories:

- `ACCEPTED` — implementer proposal accepted as stated
- `ACCEPTED WITH MODIFICATION` — underlying direction accepted but decision/implementation changed
- `REJECTED` — implementer proposal rejected
- `OUT-OF-SCOPE FINDING` — material finding discovered while reviewing that is not itself an evaluation of the proposal

`OUT-OF-SCOPE FINDING` does not modify the active proposal. The main engineering thread decides whether to open it as a new decision, experiment, risk, or follow-up task.

Reviewer freedom invariant: the reviewer is not limited to the implementer framing and may inspect raw materials independently.

Blind-evaluator invariant: a blind evaluator is not a reviewer. It receives only the frozen evaluation bundle and rubric required for the task, with no mapping, previous labels, prior gate results, or discussion context.

---

## D-001

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Only the main engineering thread may write `docs/current-state.md` and `docs/decisions.md`.
- Reason: Prevent reviewer/evaluator outputs from becoming project state before human-gated reconciliation.
- Canonical record: this file.

## D-002

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Reviewer packets must expose raw materials in addition to implementer summaries and must explicitly permit proposal-external findings.
- Reason: Reduce anchoring and curated-evidence risk in red-team review.
- Canonical record: this file.

## D-003

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Blind evaluations requiring independence must run in a physically separate fresh conversation with minimum necessary context.
- Reason: Prevent context leakage and anchoring from prior labels, mappings, and discussion.
- Canonical record: this file.

## D-004

- Type: `process-rule`
- Status: `LOCKED`
- Decision: Seen diagnostic data may not be reused as a future gate set for the same line of development.
- Reason: Prevent test-set contamination and post-hoc optimization.
- Canonical record: this file.

## D-005

- Type: `experimental-outcome`
- Status: `LOCKED`
- Outcome: `REJECTED`
- Decision: The conditional lexical phrase heuristic will not ship and no second lexical-tuning round will be opened.
- Reason: P0.5-A reached Gate A2 FAIL and Gate B FAIL under both rating definitions.
- Canonical record: `docs/experiments/p05a-lexical.md`

## D-006

- Type: `architecture`
- Status: `SUPERSEDED`
- Decision: Restrict P0.5 to semantic reranking of lexical candidates only.
- Reason: Later semantic-vs-lexical diagnostics found a material retrieval-level recall gap.
- Canonical record: `docs/architecture/research-retrieval.md`

## D-007

- Type: `architecture`
- Status: `PROPOSED`
- Decision: Evaluate a three-arm P0.5 retrieval design: lexical (L), semantic (S), and hybrid lexical+semantic (H).
- Reason: OpenAlex corpus-level semantic retrieval surfaced many high-relevance works absent from lexical top-100 pools.
- Canonical record: `docs/architecture/research-retrieval.md`

## D-008

- Type: `privacy/security`
- Status: `LOCKED`
- Decision: Never claim more evidence than the system has actually seen.
- Reason: Preserve evidence integrity across metadata/abstract/full-text levels.
- Canonical record: `docs/privacy/research-privacy.md`

## D-009

- Type: `privacy/security`
- Status: `LOCKED`
- Decision: Never expose a user's research interests to anyone other than that user; institutional analytics, if added, must be aggregate-only with no stored queries, topics, or user IDs.
- Reason: Preserve research-interest privacy.
- Canonical record: `docs/privacy/research-privacy.md`

Last updated: 2026-09-10
