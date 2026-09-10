# P0.5 Fresh-Gate Mapping / Seed / Gate Review — 2026-09-10

Status: `HISTORICAL`

## Scope

Independent review of the opened private mapping, seed commitment reveal/verification, locked-rater label reconstruction, Gate A / Gate B / S-vs-L component calculations, third-rater trigger, and predeclared decision-matrix outcome.

## Reviewer verification level

`fresh contents/diff inspected`

The reviewer reported independent end-to-end verification without relying on implementer assertions.

## Verified chain

- Private mapping artifact ZIP SHA-256 matched the canonical bundle record.
- Internal `p05-evaluator-mapping.json` SHA-256 matched the recorded mapping-file hash.
- Revealed seed matched the seed stored in the private mapping artifact.
- SHA-256 of the revealed seed matched the frozen commitment `388813fddbb0d2519baafa62cbc28af7e82f3a0cd665314c61ed4c1ddf801bd1`.
- All 40 mapping rows (holdout ID plus A/B/C assignment; 160 mapped fields) were compared against the canonical published mapping table with zero mismatch.
- Locked rater labels were reconstructed through the verified mapping.
- Gate A, Gate B, and S-vs-L were independently recomputed per rater under frozen thresholds.
- Both primary raters independently yielded Gate A PASS and Gate B FAIL.
- Third-rater trigger did not fire.
- The predeclared matrix therefore yields `H REJECTED`.

## Classification

`ACCEPTED`

The reviewer described the acceptance as complete and unconditional, with no missing raw material and no calculation discrepancy.

## Consequence

D-017 upstream review for the fresh gate is closed. The preregistered A1/A2/A5/A6/A7 harm-regression stage is authorized to proceed under its separate retrieval, review, bundle-freeze, and blind-rater sequence.

Last updated: 2026-09-10
