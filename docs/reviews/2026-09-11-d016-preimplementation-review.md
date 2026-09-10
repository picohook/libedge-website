# D-016 — Semantic-Primary Retrieval Pre-Implementation Review

Status: `HISTORICAL — ACCEPTED WITH MODIFICATION`
Date: 2026-09-11
Packet ID: `P05-D016-PREIMPLEMENTATION-2026-09-11`
Plan reviewed: `docs/architecture/p05-production-retrieval-implementation-plan.md`

## Classification

`ACCEPTED WITH MODIFICATION`

The independent reviewer accepted the implementation direction and found one required pre-code change plus one smaller implementation-detail clarification.

### Required modification before code changes

Cache identity must reflect the **actual retrieval arm that produced the cached OpenAlex result**, not merely the feature-flag/request architecture mode.

Reason: under semantic-primary, an objective S failure may legitimately fall back to L. Caching that lexical fallback result under a generic `semantic-primary` cache partition would allow a transient lexical fallback response to masquerade as semantic output for the cache TTL.

Canonical plan must therefore distinguish at least:

- actual semantic result cache; and
- actual lexical result cache.

A later semantic-primary request must not treat a cached lexical fallback response as if S had succeeded.

### Additional clarification

The current Crossref fallback helper accepts one OpenAlex error. Under S -> L -> Crossref, both S and L may fail. Implementation/code review must preserve enough structured provider metadata to distinguish the S failure from the L failure rather than arbitrarily reporting one as if it represented the whole OpenAlex path.

This is not a blocker requiring a separate architecture decision, but it must be explicit in the implementation plan/code review.

## Other findings

The reviewer accepted:

- S -> L -> Crossref separation;
- valid-empty semantics;
- one shared OpenAlex provider/normalization implementation;
- one named Durable Object as the global semantic pacing primitive;
- pacing-gate fail-closed behavior;
- narrow objective-only fallback categories;
- aggregate privacy-safe telemetry;
- feature-flag/default-off sequencing.

No additional OUT-OF-SCOPE finding was raised in this review.

## Main-thread disposition

Implementation remains blocked until the cache-partitioning correction is incorporated into the canonical plan and receives focused follow-up acceptance. No D-016 production retrieval code is changed by this review record.
