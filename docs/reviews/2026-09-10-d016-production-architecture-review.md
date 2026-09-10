# D-016 — Production Retrieval Architecture Review

Status: `HISTORICAL — ACCEPTED WITH MODIFICATION`
Date: 2026-09-10
Packet ID: `P05-D016-PRODUCTION-ARCHITECTURE-2026-09-10`
Proposal reviewed: `docs/architecture/p05-production-retrieval-decision.md`

## Classification

`ACCEPTED WITH MODIFICATION`

The independent reviewer accepted the core architecture direction: semantic retrieval S as primary for the existing top-10 research-result contract, lexical L only as objective fallback/rollback, no H, and no Vectorize at this stage.

Before D-016 may transition from PROPOSED to LOCKED, the canonical architecture record must close two implementation ambiguities:

1. Define how a valid HTTP-success semantic response with zero candidates is treated for fallback purposes.
2. Add a concrete pre-adoption capacity check against the current <=1 request/second semantic dependency, rather than treating queueing/concurrency control alone as sufficient.

The reviewer also requested that the known fresh S-vs-L weak-query examples Q08 (Rater 1, -10pp) and Q27 (Rater 2, -40pp) be retained in the canonical record as monitoring context, without turning them into a new relevance gate.

The reviewer further recommended a concrete first production-scale D-013 telemetry review checkpoint rather than an indefinitely open-ended monitoring instruction.

## OUT-OF-SCOPE FINDING

Vectorize may become relevant in the future because of capacity/availability evidence even if semantic relevance remains strong. This is `ACKNOWLEDGED / DEFERRED`.

Revisit trigger: measured production/staging capacity or availability evidence shows the provider semantic path cannot satisfy the product's operational requirements within acceptable latency/availability bounds.

A future Vectorize evaluation triggered this way should primarily test scalability/availability architecture, not reopen P0.5 relevance merely because S is semantic.

## Main-thread disposition

The core D-016 direction is retained, but D-016 remains PROPOSED until the requested canonical modifications receive follow-up reviewer acceptance. No production retrieval code is authorized by this review alone.
