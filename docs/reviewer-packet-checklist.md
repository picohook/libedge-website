# Reviewer Packet Completeness Checklist

Status: `ACTIVE`
Canonical decision index: `docs/decisions.md`

## Purpose

Prevent a Reviewer Packet from claiming that raw materials are attached or accessible when they are not actually present.

## Mandatory pre-send check

Before a Reviewer Packet is handed to an independent reviewer, the main engineering thread must verify every item below **inside the packet itself**.

A separate checklist file is not sufficient evidence of completion. Every full Reviewer Packet must carry a completed attestation block showing the actual materials and checks for that packet.

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

Last updated: 2026-09-10
