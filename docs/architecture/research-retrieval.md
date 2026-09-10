# Research Retrieval Architecture

Status: `ACTIVE`
Qualifier: `EXPERIMENTAL / NOT PRODUCTION-ADOPTED`
Canonical decision index: `docs/decisions.md`

## Current status

P0.5 retrieval architecture is under experiment; no production semantic/hybrid retrieval has been adopted yet. The P0.5 experiment protocol is FROZEN in `docs/experiments/p05-hybrid-semantic.md`.

## CURRENT PROPOSAL

Evaluate three retrieval arms before any production implementation:
- `L` — OpenAlex lexical retrieval baseline, top 100 candidates.
- `S` — OpenAlex corpus-level semantic retrieval, top 50 candidates.
- `H` — lexical + semantic union -> canonical deduplication -> RRF `k=60` -> deterministic tie-break -> top 10.

The existing user-facing research endpoint contract remains unchanged during feasibility work.

## REJECTED PRIOR PROPOSAL

`Lexical candidate generation -> semantic reranking only` — `REJECTED`, not `SUPERSEDED`.
Reason: semantic retrieval surfaced many strong intent-relevant works absent from lexical top-100 pools; lexical-only candidate reranking cannot recover them.

## Diagnostic evidence

Known harm-regression queries: A1, A2, A5, A6, A7.
Lexical top-100 direct-R counts: A1 37, A2 9, A5 34, A6 12, A7 28.
Semantic-vs-lexical overlap: A1 3/47 semantic results overlap lexical100; A2 0/50; A5 9/49; A6 0/23; A7 1/50. These are diagnostics, not gate metrics.

## Operational constraints for P0.5

### Semantic rate limit

Status: `CONFIRMED`
Claim: OpenAlex semantic search is limited to 1 request/second.
Source: OpenAlex official Semantic Search documentation.
Checked: 2026-09-10.
Conflict status: none currently.
Reconciliation trigger: reopen if current official provider behavior/documentation materially changes.
Consequence: semantic calls are paced <=1 request/second.

### Semantic pricing

Status: `RECONCILED — LIVE AUTHENTICATED TELEMETRY / D-013 LOCKED`

Claim: for the authenticated OpenAlex account measured on 2026-09-10, successful `search.semantic` calls were charged `$0.001` per call = `$1 / 1,000`.

Source(s):
- OpenAlex Authentication & Pricing table: semantic search `$1 / 1,000`.
- Same page's contradictory historical `/rate-limit` example: semantic `0.01` = `$10 / 1,000`.
- Live authenticated GitHub Actions run `34483422756`, job `102891595357`, trigger commit `67c3974e7d8aa46ea240dc79db0630f5f2848aef`.
- Raw reconciliation record: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`.

Checked: 2026-09-10.

Raw live observations: three consecutive authenticated semantic calls each returned HTTP 200, `meta.cost_usd=0.001`, `X-RateLimit-Credits-Used=10`, and `X-RateLimit-Cost-USD=0.001`. Semantic first-five Work IDs differed completely from the same-intent lexical control first-five IDs, while request URLs explicitly used `search.semantic`, verifying retrieval mode.

Conflict status: `CLOSED`. Body/header telemetry agreed 3/3 and unambiguously distinguished the prior 10x documentation conflict.

Reopen trigger: materially different authenticated semantic charged-cost telemetry or internally inconsistent body/header cost telemetry.

Consequence: P0.5 frozen economic assumption is `$0.001/call`. The contradictory documentation example remains historical evidence.

### Passive charged-cost observation

The existing OpenAlex provider implementation exposes `extractOpenAlexTelemetry()`, which extracts:
- `requestCredits` from `X-RateLimit-Credits-Used`,
- `requestCostUsd` from `X-RateLimit-Cost-USD`, falling back to `payload.meta.cost_usd`,
- rate-limit family/remaining/reset fields.

This existing extraction is the basis for passive D-013 reopen detection during P0.5 and any later production semantic operation. Operational telemetry may retain charged-cost/rate fields needed to detect a provider-price change, but must not add stored query text, topic labels, or user research-interest content.

A semantic observation materially different from `$0.001/call`, or conflicting body/header charged-cost evidence, must raise a D-013 review signal rather than silently changing the assumed price. During the frozen P0.5 experiment, such a signal does not authorize mid-experiment repricing/tuning; execution pauses for governance review if the operational cap or data integrity is affected.

## Constraints

- Do not use the seen 30-query P0.5-A set as the semantic/hybrid gate set.
- Do not adopt Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- Do not assume dense semantic similarity guarantees conjunctive-intent satisfaction.
- Fresh holdout includes a predeclared conjunctive-intent slice.
- Production changes require preregistered experiment evidence first.
- H execution uses the exact fusion/dedup/tie-break specification frozen in `docs/experiments/p05-hybrid-semantic.md`.
- Semantic calls paced <=1 request/second.
- P0.5 economic calculations use `$1 / 1,000`; materially different future authenticated telemetry reopens D-013 rather than silently rewriting the record.

## Source record — semantic retrieval availability

Claim: OpenAlex exposes corpus-level semantic work search separately from lexical search and can surface candidates absent from lexical top-N.
Sources: official semantic-search documentation; live semantic-gap diagnostic; D-013 semantic-vs-lexical control telemetry.
Checked: 2026-09-10.
Conflict status: none on endpoint availability.
Reconciliation trigger: if provider behavior materially diverges, open a new operational conflict record.
Consequence: reranking-only remains rejected; L/S/H feasibility is tested under the frozen fresh-holdout protocol.

Last updated: 2026-09-10
