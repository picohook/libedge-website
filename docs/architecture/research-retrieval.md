# Research Retrieval Architecture

Status: `ACTIVE`
Qualifier: `D-016 LOCKED — SEMANTIC PRIMARY / LEXICAL AVAILABILITY FALLBACK`
Canonical decision index: `docs/decisions.md`
Primary production architecture record: `docs/architecture/p05-production-retrieval-decision.md`

## Current status

P0.5 is closed. D-016 is now LOCKED after independent architecture review and follow-up acceptance.

The governing production retrieval architecture for the existing top-10 research-result contract is:

- `S` — OpenAlex corpus-level semantic retrieval as primary.
- `L` — lexical retrieval retained only as objective availability fallback/rollback.
- `H` — rejected; not used as primary, fallback, supplement, or reranking/fusion stage.
- Vectorize — not adopted; revisit only with new product evidence, including capacity/availability evidence.

Implementation is authorized only through controlled staging/feature-flag rollout. Broad enablement remains subject to the locked operational constraints in `docs/architecture/p05-production-retrieval-decision.md`.

## Locked semantic-primary path

For eligible research queries:

1. Send the existing user intent unchanged to OpenAlex semantic retrieval.
2. Request up to the provider-supported semantic candidate depth (`<=50`).
3. Apply existing normalization/deduplication projection.
4. Return the first 10 unique normalized semantic results under the existing evidence contract.

No LLM query rewrite, phrase injection, result-dependent transformation, lexical supplementation, or RRF fusion is used.

## Objective lexical fallback only

L may be invoked only for objective semantic-path availability/validity failures such as timeout/network error, 429 after permitted handling, provider 5xx, semantic endpoint unavailable/disabled, or malformed/unprocessable provider response.

A valid successful semantic response with zero candidates is **not** an availability failure and does not trigger L fallback. A valid short semantic response likewise does not trigger supplementation or replacement.

Fallback MUST NOT depend on candidate content, candidate count once the response is valid, apparent relevance, expected answer quality, topic, discipline, or whether lexical results appear preferable.

## P0.5 evidence summary

Fresh frozen evaluation:

- H vs L Gate A: PASS for both primary raters.
- H vs S Gate B: FAIL for both primary raters.
- Predeclared matrix: `H REJECTED`.
- S vs L mean Relevant@10 delta: Rater 1 `+26.75pp`; Rater 2 `+25.25pp`.
- S vs L non-worse: Rater 1 `39/40`; Rater 2 `37/40`.
- All four domain means and frozen conjunctive/lexical-ambiguity slice means were positive for S vs L for both raters.

Known unfavorable fresh examples remain visible: Q08 `-10pp` for Rater 1 and Q27 `-40pp` for Rater 2. They are historical monitoring context only and do not authorize query-specific routing.

Seen harm diagnostic aggregate Relevant@10:

- Rater 1: L `44%`, H `72%`, S `78%`.
- Rater 2: L `46%`, H `72%`, S `82%`.

The harm slice was diagnostic only.

## Operational constraints

### Semantic rate/capacity

Treat semantic search as a `<=1 request/second` dependency until new provider evidence changes that constraint.

Before broad semantic-primary enablement, aggregate/no-query-text traffic evidence or a documented conservative forecast must show peak eligible research-query arrival rate `<=0.5 requests/second`.

If the estimate exceeds `0.5 requests/second`, or a representative/conservative estimate cannot be produced, broad enablement is blocked pending explicit capacity review/plan. Controlled staging/feature-flag implementation may proceed within the provider limit.

### Candidate depth

Semantic retrieval is provider-constrained to at most 50 candidates versus lexical top-100. P0.5 therefore supports the current top-10 result contract only; it does not establish superiority for deep pagination, exhaustive recall, or arbitrary candidate depth.

The frozen S-vs-L coverage rule reported `40/40` regressions because of this depth asymmetry. This caveat remains part of the evidence record.

### Pricing / D-013

Observed authenticated semantic charge remains `$0.001/call` (`$1/1,000`) for current planning, subject to D-013 reopen conditions.

First production-scale D-013 checkpoint: after the first `1,000` charged semantic responses or `7 calendar days` of enabled real traffic, whichever occurs first, review aggregate authenticated cost/credit telemetry. Do not store query text, topics, research interests, or user IDs for this checkpoint.

### Monitoring

Monitor aggregate operational fields only, including:

- semantic success/failure counts;
- valid zero-candidate semantic response count;
- objective L fallback count/rate;
- latency distribution;
- 429/5xx/network-failure rates;
- charged-cost/credit telemetry.

A rising fallback rate, material zero-result rate, capacity pressure, or changed provider cost/rate behavior triggers operational review. It does not authorize content-dependent switching.

## Historical/rejected paths

### Lexical candidate generation -> semantic reranking only

`REJECTED`, not `SUPERSEDED`.

Reason: semantic retrieval surfaced strong intent-relevant works absent from lexical top-100 pools; lexical-only candidate reranking cannot recover them.

### H — lexical + semantic RRF

`REJECTED BY EXPERIMENTAL EVIDENCE`.

H improved L but failed H-vs-S non-inferiority for both primary fresh raters, while adding a second provider call and fusion complexity.

### Vectorize now

Not adopted. Current evidence does not justify new retrieval infrastructure. Revisit if semantic-provider capacity/availability or other product requirements are not satisfied.

## Source records

Semantic retrieval availability and endpoint behavior were established through official OpenAlex documentation plus live authenticated diagnostics and P0.5 execution records.

D-013 pricing remains based on live authenticated telemetry at `$0.001/call`, with its existing reopen trigger.

Canonical evidence and decision records:

- `docs/experiments/p05-final-outcome.md`
- `docs/architecture/p05-production-retrieval-decision.md`
- `docs/reviews/2026-09-10-d016-production-architecture-review.md`
- `docs/reviews/2026-09-10-d016-production-architecture-followup-review.md`
- `docs/decisions.md` D-016

Last updated: 2026-09-10
