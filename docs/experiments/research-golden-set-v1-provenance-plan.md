# Research Golden Set v1 — Held-out provenance plan

**Status:** PROPOSED / must be independently reviewed and frozen before held-out question authoring  
**Protocol:** `docs/experiments/research-golden-set-v1-preregistration.md`

## Purpose

Freeze provenance allocation and author-independence rules before any of the 90 held-out questions are authored. This artifact does not contain held-out questions and does not authorize execution.

## Fixed cells

The held-out manifest will contain exactly 90 questions:

| Domain | English | Turkish | Total |
| --- | ---: | ---: | ---: |
| Humanities | 20 | 10 | 30 |
| Biomedical | 20 | 10 | 30 |
| Social science | 20 | 10 | 30 |
| **Total** | **60** | **30** | **90** |

## Provenance classes

Each cell must use exactly one recorded provenance class per question:

- `PILOT_NEED`: an authentic information need supplied from the intended pilot university-library/user context, collected without running it through Research. It may be collected only through an institution-approved process for this evaluation: no names, emails, account IDs, free-text personal identifiers, or other personal data are stored in the Golden Set; the institution/user contributor must understand that the de-identified research question may be used for evaluation. If a need cannot be safely de-identified without changing its substance, exclude it from `PILOT_NEED` and fill that quota independently.
- `INDEPENDENT_AUTHORED`: authored by an independent subject-informed person who has not implemented or tuned Research retrieval, generation, grounding, checker behavior, thresholds, #536 diagnostic cases, or the measured candidate.

No synthetic question may be relabeled as `PILOT_NEED`. The provenance record stores only the class, domain/language cell and non-identifying source role/context needed for audit; it must not contain a user identity or link a question back to a person.

## Allocation freeze

Before question authoring starts, the product owner and independent reviewer record, for each of the six domain × language cells:
1. how many authentic `PILOT_NEED` items are actually available;
2. the remaining count to be filled as `INDEPENDENT_AUTHORED`;
3. the role/qualification of the independent author(s), without storing answer-bearing expectations.

The six cell counts must sum to the fixed 90-question matrix above. Once signed off, provenance allocations cannot be changed because of observed Research/checker behavior.

If authentic pilot-user needs are unavailable or sparse, do not delay by inventing them: freeze the truthful count, fill the remainder independently, and carry the representativeness limitation into the final report and #399 pilot-scope declaration.

## Independence

The implementer may provide the frozen schema/template only. The implementer may not author, select, rewrite, substitute, remove, translate, or rebalance held-out questions after seeing system behavior.

Turkish questions must be naturally authored by Turkish-competent contributors. They must not be machine translations or translations of previously executed English questions.

## Required freeze record

Before held-out authoring:
- product-owner sign-off;
- independent-reviewer sign-off;
- per-cell provenance allocation;
- author-role/qualification attestations;
- confirmation that no held-out question has yet been executed through Research.

After authoring, the separate sealed held-out manifest/hash records question IDs, provenance class, domain/language cell, and author role.