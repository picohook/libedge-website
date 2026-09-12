# Reviewer Packet Completeness Checklist

Status: `ACTIVE`
Canonical decision index: `docs/decisions.md`

## Purpose

Prevent a Reviewer Packet from claiming that raw materials are attached or accessible when they are not actually present.

## Mandatory pre-send check

Before a Reviewer Packet is handed to an independent reviewer, the main engineering thread must verify every item below **inside the packet itself**.

A separate checklist file is not sufficient evidence of completion. Every full Reviewer Packet must carry a completed attestation block showing the actual materials and checks for that packet.

## PR-centered review handoff

For ordinary LibEdge reviewer handoffs, prefer a GitHub Pull Request as the durable review surface so that the diff, packet, discussion, and reviewer result remain together.

The human gatekeeper should not be required to copy review materials between AI threads. The minimum handoff message is:

`Kontrol et: #<PR number>`

The PR number is intentionally retained. A content-free instruction such as `Kontrol et.` is insufficient when multiple workstreams or reviewable PRs may exist, because the reviewer must not guess which PR is intended.

The reviewer must use the supplied PR number to read the PR description, changed files/diff, canonical records, and relevant repository content directly from GitHub. The reviewer must treat repository raw material as authoritative over any implementer summary.

If GitHub/API access fails or is rate-limited, the reviewer must report the access failure against the supplied PR number rather than guessing another PR, selecting the most recent PR, or asking the human gatekeeper to copy the repository contents into the conversation. The review remains incomplete until the referenced raw material can actually be inspected.

The PR description must contain the full reviewer packet required by this checklist, including scope, exact version context, raw-material references, and a decision boundary that explicitly states what the review/change does **not** authorize. This packet must be written for the actual PR and must not be reduced to unexamined boilerplate.

Reviewer results should remain attached to the PR discussion/review surface when tooling permits. Before the main engineering thread proceeds from a reviewer result, the human gatekeeper should have an opportunity to see the verdict. In particular, `REJECTED` and `ACCEPTED WITH MODIFICATION` must not be silently converted into an implementer continuation without human visibility and main-thread reconciliation.

A plain `ACCEPTED` result may proceed after the human gatekeeper has seen the result and says to continue; this preserves human gatekeeper awareness without requiring copy/paste of the reviewer output.

This PR-centered handoff protocol changes the transport of review material, not reviewer independence, decision authority, or the existing single-writer/control-plane rules.

## Required embedded attestation block

Every full Reviewer Packet must contain a block equivalent to:

```text
REVIEWER PACKET COMPLETENESS ATTESTATION
Packet ID: <id>
Branch/ref/commit: <exact version context>

RAW MATERIALS
[x] <material 1> — present/accessibly linked — full/excerpt correctly labeled — current intended version
[x] <material 2> — present/accessibly linked — full/excerpt correctly labeled — current intended version
...

CONSISTENCY
[x] No claim such as attached/pasted/included is false.
[x] Implementer summary is separated from raw material.
[x] Raw material is authoritative over the summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.

RESULT: COMPLETE
```

Unchecked `[ ]`, missing rows, or a non-COMPLETE result mean the packet is not a full Reviewer Packet.

### RAW MATERIALS completeness

For each item listed under `RAW MATERIALS` in the packet:

- [ ] The referenced file/output/diff is actually included in the message OR provided through an accessible link/reference that the reviewer can open.
- [ ] The material is the current intended version, not an obsolete copy.
- [ ] If the packet says `full`, the full content is present; excerpts may not be described as full raw material.
- [ ] If a canonical file is cited, its branch/ref or commit context is clear enough to identify the exact version reviewed.
- [ ] No listed raw-material item is missing.

### Commit-based raw-material verification

A commit hash may stand in for an embedded diff only when the repository and commit are actually accessible to the reviewer and the packet gives enough version context to reproduce the exact change.

- [ ] When a commit hash is used as RAW MATERIAL, the packet identifies both ends of the change (`base -> head`) or otherwise names the exact parent/base needed for comparison.
- [ ] The packet explicitly instructs the reviewer to refresh the repository state and verify the exact committed diff, not merely confirm that the commit exists. For a local git workflow, the minimum instruction is equivalent to `git fetch`, checkout/switch to the intended branch or commit, then diff/compare `base -> head`.
- [ ] A reviewer verification statement must distinguish `commit exists` from `fresh contents/diff inspected`; the latter is required before the change is treated as independently verified.
- [ ] For small surgical changes, prefer embedding the exact diff in the packet in addition to the commit hash. If repository/tool access is unavailable or uncertain, the exact diff or full changed material MUST be embedded; a bare hash is insufficient RAW MATERIAL.

### Consistency check

- [ ] The packet does not say `attached`, `pasted below`, `included`, or equivalent unless that statement is literally true.
- [ ] The implementer summary is clearly separated from raw materials.
- [ ] The reviewer is explicitly told that raw materials are authoritative over the implementer summary.
- [ ] The reviewer has permission to report `OUT-OF-SCOPE FINDING` items.

## Gate

A packet is `COMPLETE` only if:

1. every applicable checklist condition is YES; and
2. the packet itself contains the completed attestation block with every listed material explicitly marked `[x]`.

If any item is NO or unchecked:

- Status: `INCOMPLETE — DO NOT SEND AS FULL REVIEW PACKET`.
- Either add the missing material or explicitly downgrade the request to a limited summary-only review.
- A summary-only review must not later be described as a full red-team review.

## Failure handling

If an incomplete packet is nevertheless sent:

1. record the incident as a process defect;
2. triage it in the main engineering thread;
3. correct the packet before requesting a full red-team conclusion;
4. do not reuse conclusions that depended on falsely claimed raw-material completeness as if they came from a complete packet.

Last updated: 2026-09-12
