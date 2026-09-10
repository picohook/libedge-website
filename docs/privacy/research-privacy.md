# Research Privacy and Evidence Invariants

Status: `ACTIVE`
Canonical decisions: `docs/decisions.md` D-008, D-009
Supersession rule: if these invariants are replaced, this file must be marked `SUPERSEDED (see D-0XX and replacement record)`; a replacement may not silently overwrite the historical governing record.

## LOCKED PRINCIPLES

### Evidence integrity

The system must never claim more evidence than it has actually seen.

Examples:
- Metadata-only records must not be described as if an abstract or full text was reviewed.
- Abstract-derived claims must not be presented as full-text findings.
- Provider provenance and evidence level must remain distinguishable.

### Research-interest privacy

A user's research interests must not be exposed to anyone other than that user.

If institutional analytics are implemented later:
- use aggregate counters only,
- do not store raw queries,
- do not store inferred topics,
- do not store user IDs in research-interest analytics,
- use an unassigned/sentinel institution bucket when institutional identity is unavailable rather than inferring one.

## Governance

Changes to these principles require a new privacy/security decision in `docs/decisions.md` and explicit main-thread review under the human gatekeeper model.

Reviewer and blind-evaluator threads cannot alter these invariants directly.

Last updated: 2026-09-10
