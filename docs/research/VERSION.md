# LibEdge Research Version Governance

Status: `ADOPTED / PRE-1.0`

Date: 2026-10-06

## Purpose

LibEdge Research has an independent version lifecycle from the LibEdge website/product baseline. Website `VERSION` and Research version MUST NOT be inferred from one another.

Canonical machine-readable Research version: `RESEARCH_VERSION`.
Canonical Research release ledger: `docs/research/CHANGELOG.md`.

Current Research version: **0.9.0**.
Current maturity status: **experimental**.

Version and maturity status are separate dimensions. A higher Research version records accumulated capability milestones; it does not by itself authorize pilot or production use.

## Version policy

Research uses a SemVer-inspired pre-1.0 policy:

- `0.MINOR.0`: a material Research capability or architecture milestone.
- `0.MINOR.PATCH`: backward-compatible hardening, bug fix, or correction that does not establish a new capability milestone.
- documentation/test-only work does not require a bump unless it changes the declared Research contract or release evidence.
- released ledger entries are immutable; corrections are recorded in a later entry or explicit historical note.

## Maturity status

Allowed lifecycle labels:

- `experimental`: active development/measurement; domain capability is not yet broadly validated.
- `review`: candidate has a versioned fixed-rubric golden-set evidence package under review.
- `publishable`: independently reviewed evidence and authorization gates for the declared scope are complete.
- `archived`: retained as historical evidence and no longer an active candidate.

The status MUST NOT be promoted merely because a version number increased.

## 1.0.0 gate

Research `1.0.0` is reserved for a pilot-ready declared scope. It requires, at minimum:

1. #536 closure under its explicit quality gate: either the versioned golden set meets its predeclared domain acceptance targets or the pilot scope is explicitly narrowed in writing.
2. #399 authorization packet complete, including mandatory item 13: domain-level validation evidence, pilot-scope declaration, and rejected-query UX review.
3. exact-candidate CI/staging evidence and independent review required by #399.
4. no weakening of checker thresholds, pins, D-023, or fail-closed behavior to satisfy the gate.
5. separate explicit production/pilot activation authorization remains required; version `1.0.0` alone is not deployment authorization.

## Historical reconstruction rule

Versions 0.1.0–0.9.0 are a retrospective governance baseline reconstructed from repository evidence. Dates in the ledger are tied to real commits/merged milestones; they are not claims that formal Research releases or Git tags existed on those dates.

Future versions MUST be recorded prospectively in the Research changelog when the milestone is accepted.
