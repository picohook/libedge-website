# D-022 H2 role-separation and checker-isolation evidence worksheet

Status: OPEN / EVIDENCE ASSEMBLY ONLY

This worksheet records already-known role assignments and explicit exclusions. It does not appoint a new substantive role, qualify a rater, authorize checker implementation/tuning, authorize H2 authorship, or close the canonical freeze gate. Any identity not backed by preserved evidence must remain unverified in the eventual canonical roster.

## Previously occupied substantive roles

| Model identity/version | Recorded substantive role | H2 reuse constraint |
| --- | --- | --- |
| GPT-5.6 Sol | H1 Primary Blind Rater R1 | Must not take another mutually exclusive substantive D-022 role |
| Claude Sonnet 5 | H1 Primary Blind Rater R2 | Must not take another mutually exclusive substantive D-022 role |
| Gemini 3.1 Pro Preview | H1 Structural Inventory Constructor | Mutually exclusive substantive role already occupied |
| Gemini 3.8 Flash | Independent H1 Structural Inventory Reviewer | Mutually exclusive substantive role already occupied |
| Gemini 3.7 Flash | H1 Structural Inventory Construction Validator / Test Author | Mutually exclusive substantive role already occupied |
| Gemini 3.6 Flash | Failed H1 Independent Validator/Test Reviewer | Preserve failed-role history; do not silently recycle |
| Claude Opus 4.8 | Independent H1 Structural Inventory Validator/Test Reviewer | Mutually exclusive substantive role already occupied |
| Claude Opus 5 | H2 taxonomy author | Must remain separated from incompatible H2 roles |
| Gemini 3.6 Thinking | Independent H2 taxonomy reviewer | Must remain separated from incompatible H2 roles |
| Claude Sonnet 4.6 | Original H2 validator author | Validator authorship role already occupied |
| Grok 4.5 | Successor H2 validator author | Validator authorship role already occupied |
| DeepSeek deepseek-v4-pro | Independent H2 validator reviewer | Independent validator-review role already occupied |
| Gemini 3.5 Flash-Lite | Original H2 R1 candidate; qualification failed | Disqualified for the planned rater role |
| GPT-5.5 Instant | Replacement H2 R1 candidate | T1 PASS; T2 bundle-hash FAIL; DISQUALIFIED; do not reuse as R1 |
| Nex AGI Nex-N2.5-Pro (`nex-agi/nex-n2.5-pro:free`) via OpenRouter | H2 Primary Rater R1; successor-v0.2 qualification 3/3 PASS | R1 role locked; exact raw-output hashes preserved; do not assign another substantive D-022 role |
| Claude Opus 4.7 | H2 Primary Blind Rater R2; eligibility PASS and 3/3 format qualification PASS | R2 role locked; exact raw-output evidence CLOSED; do not assign another substantive D-022 role |
| DeepSeek deepseek-flash | H2 R2 candidate; Trial 1 failed | Disqualified for the planned rater role |
| Claude Opus 5.5 | Independent H2 Methodology Reviewer (#132/#133 and successor v0.2 review) | Independent methodology-review role already occupied |
| Claude Opus 4.6 | H2 Successor Operational Specification Author | Specification-author role already occupied |
| Claude Opus 3 | Candidate supportCheck implementer/tuner attempt; eligibility passed, no deliverable after two refusals | Preserve consumed role history; do not silently recycle |
| Grok 4.7 | Candidate supportCheck Implementer/Tuner; eligibility/isolation PASS; recovered implementation complete | Implementer/tuner role locked; exact candidate accepted unchanged by independent checker-freeze review |
| Claude Haiku 4.5 | Independent Candidate supportCheck Checker-Freeze Reviewer | ACCEPT / FINAL / LOCKED; role occupied; exact candidate bytes approved unchanged for later H2 evaluation |

The eventual canonical role roster must cite the preserved evidence for each entry and resolve any naming/version ambiguity before freeze. This worksheet itself is not that canonical roster.

## Current unfilled / unresolved functions

- Qualified H2 R1: CLOSED — Nex AGI Nex-N2.5-Pro, 3/3 successor-v0.2 qualification PASS; exact raw-output hashes preserved.
- Qualified H2 R2: CLOSED — Claude Opus 4.7, 3/3 fresh-session qualification PASS; exact raw-output evidence CLOSED.
- Candidate semantic `supportCheck` implementer/tuner: CLOSED for implementation — Grok 4.7; recovered exact artifact hashes and 15/15 deterministic unit-test rerun are recorded in `docs/d022-supportcheck-candidate-provenance.md`.
- Independent candidate checker-freeze review: CLOSED — Claude Haiku 4.5, ACCEPT / FINAL / LOCKED; exact candidate bytes accepted unchanged.
- H2 holdout construction roles permitted by the frozen construction specification: must not be filled until the authorship gate permits construction.
- Canonical freeze-manifest independent reviewer: must be eligible and independent at the time of review.

## Checker-isolation boundary

Before candidate-checker implementation/tuning and before H2 pool commitment, the evidence package must establish all of the following:

1. The checker implementer/tuner has no access to H2 holdout claim content before the checker artifact/version is frozen as required.
2. H2 holdout constructors do not implement or tune the candidate checker.
3. H2 primary raters do not implement/tune the checker or author the holdout.
4. Independent H2 validator/reviewer roles remain separate from incompatible construction/checker/rating roles.
5. Checker identity/version/hash is frozen before it is evaluated on the frozen H2 holdout under the preregistered protocol.
6. Evaluation results are not used for post-hoc threshold tuning.
7. A failed H2 evaluation does not authorize editing the frozen holdout or silently substituting a tuned checker under the same evaluation identity.
8. Production deployment authorization remains separate from checker validation.

## Current checker-isolation evidence status

The candidate checker implementer/tuner is Grok 4.7. Its eligibility/isolation gate passed before the allowed-input package was supplied, and the recovered implementation provenance is recorded separately. Independent checker-freeze review is CLOSED. The accepted checker identity/hashes must now be bound into the canonical freeze manifest before H2 commitment.

The current GPT-5.6 Sol session is already recorded as H1 Primary Blind Rater R1 and is excluded from serving as candidate-checker implementer/tuner, H2 holdout author, H2 rater, or independent H2 methodology reviewer.

## Freeze-gate consequence

This worksheet may be used as an input to the prerequisite evidence package, but it must not be treated as the canonical `d022-h2-freeze-manifest.json`. H2 authorship remains CLOSED until the frozen prerequisites, including canonical binding and required final independent review, are complete.
