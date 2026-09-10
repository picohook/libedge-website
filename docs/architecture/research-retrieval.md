# Research Retrieval Architecture

Status: `ACTIVE`
Qualifier: `EXPERIMENTAL / NOT PRODUCTION-ADOPTED`
Canonical decision index: `docs/decisions.md`
Supersession rule: if this architecture record is replaced in full, change this header to `SUPERSEDED (see D-0XX and replacement record)` before treating the replacement as canonical.

## Current status

P0.5 retrieval architecture is under experiment; no production semantic/hybrid retrieval has been adopted yet.

## CURRENT PROPOSAL

Evaluate three retrieval arms before any production implementation:

- `L` — OpenAlex lexical retrieval baseline, top 100 candidates.
- `S` — OpenAlex corpus-level semantic retrieval, top 50 candidates (provider-constrained maximum).
- `H` — lexical + semantic candidate union -> canonical deduplication -> Reciprocal Rank Fusion (`k=60`) -> deterministic tie-break -> top 10.

The full frozen experiment specification, evaluator protocol, gates and amendment history belong in `docs/experiments/p05-hybrid-semantic.md`.

The existing user-facing research endpoint contract remains unchanged during feasibility work.

## REJECTED PRIOR PROPOSAL

`Lexical candidate generation -> semantic reranking only`

Decision status: `REJECTED`, not `SUPERSEDED`.

Reason: the idea was considered but never adopted as governing/production architecture. Provider-level diagnostics found that semantic retrieval returns many strong intent-relevant works absent from lexical top-100 pools. A reranker restricted to lexical candidates cannot recover missing documents.

## Diagnostic evidence

Known harm-regression queries: A1, A2, A5, A6, A7.

Lexical top-100 direct-R counts under strict title-level conjunctive relevance diagnostic:
- A1: 37/100
- A2: 9/100
- A5: 34/100
- A6: 12/100
- A7: 28/100

Semantic-vs-lexical overlap diagnostic:
- A1: 47 semantic results; 3 overlap with lexical top-100; 44 semantic-only.
- A2: 50 semantic results; 0 overlap; 50 semantic-only.
- A5: 49 semantic results; 9 overlap; 40 semantic-only.
- A6: 23 semantic results; 0 overlap; 23 semantic-only.
- A7: 50 semantic results; 1 overlap; 49 semantic-only.

Strict title-level diagnostic of semantic-only first 20:
- A1: ~11 R
- A2: ~10 R
- A5: ~9 R
- A6: ~11 R
- A7: ~14 R

These are architectural diagnostics, not gate metrics.

## Operational constraints for P0.5

### Semantic rate limit

Status: `CONFIRMED`

Claim:
OpenAlex semantic search is limited to 1 request per second.

Source:
OpenAlex official Semantic Search documentation.

Checked:
2026-09-10.

Conflict status:
None currently.

Reconciliation trigger:
Reopen only if current official provider behavior/documentation materially changes.

Consequence:
P0.5 experiment execution must pace semantic calls at <=1 request/second even though the general API documentation describes a higher overall request ceiling.

### Semantic pricing

Status: `RECONCILED — LIVE AUTHENTICATED TELEMETRY`

Claim:
For the authenticated OpenAlex account measured on 2026-09-10, successful `search.semantic` calls were charged `$0.001` per call, equivalent to `$1 / 1,000 semantic calls`.

Source(s):
- OpenAlex `Authentication & Pricing` pricing table: semantic search `$1` per 1,000 calls.
- Same official page's contradictory `/rate-limit` example: `endpoint_costs_usd.semantic = 0.01`, equivalent to `$10` per 1,000 calls.
- Live authenticated GitHub Actions telemetry: run `34483422756`, job `102891595357`, trigger commit `67c3974e7d8aa46ea240dc79db0630f5f2848aef`.
- Canonical raw reconciliation record: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`.

Checked:
2026-09-10.

Raw live observations:

Semantic call 1:
- UTC `2026-09-10T13:33:56.204708+00:00`
- redacted URL `https://api.openalex.org/works?search.semantic=digital+divide+rural+education&per-page=5&api_key=REDACTED`
- HTTP `200`
- `meta.cost_usd = 0.001`
- `X-RateLimit-Credits-Used = 10`
- `X-RateLimit-Cost-USD = 0.001`

Semantic call 2:
- UTC `2026-09-10T13:33:59.021673+00:00`
- same redacted semantic request shape
- HTTP `200`
- `meta.cost_usd = 0.001`
- `X-RateLimit-Credits-Used = 10`
- `X-RateLimit-Cost-USD = 0.001`

Semantic call 3:
- UTC `2026-09-10T13:34:01.395540+00:00`
- same redacted semantic request shape
- HTTP `200`
- `meta.cost_usd = 0.001`
- `X-RateLimit-Credits-Used = 10`
- `X-RateLimit-Cost-USD = 0.001`

Lexical control:
- UTC `2026-09-10T13:34:03.834682+00:00`
- redacted URL `https://api.openalex.org/works?search=digital+divide+rural+education&per-page=5&api_key=REDACTED`
- HTTP `200`
- leading Work IDs differed from the semantic result set.

Semantic first five IDs:
`W3215746815`, `W2088183499`, `W2911768226`, `W2731622968`, `W3156172847`.

Lexical-control first five IDs:
`W2991538617`, `W2040484355`, `W2168637053`, `W2343437055`, `W4252846263`.

Conflict status:
`CLOSED`. Three consecutive authenticated semantic calls gave identical body and header cost telemetry. The request explicitly used `search.semantic`, and the lexical control returned a distinct leading result set, so silent lexical fallback is not a plausible explanation for the measured semantic charge.

Reconciliation trigger:
Reopen D-013 only if later authenticated semantic calls show a materially different charged cost or internally inconsistent body/header cost telemetry.

Consequence:
P0.5 may freeze `$0.001 per semantic call` (`$1 / 1,000`) as its economic assumption. The contradictory documentation example is retained as historical evidence rather than erased.

## Constraints

- Do not use the seen 30-query P0.5-A set as the semantic/hybrid gate set.
- Do not adopt Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- Do not assume dense semantic similarity guarantees conjunctive-intent satisfaction.
- Fresh holdout must include a predeclared conjunctive-intent slice.
- Production changes require preregistered experiment evidence first.
- H execution must use the exact fusion/dedup/tie-break specification frozen in `docs/experiments/p05-hybrid-semantic.md`.
- Semantic calls must be paced at <=1 request/second.
- P0.5 economic calculations use the reconciled `$1 / 1,000` semantic-call charge; materially different future authenticated telemetry reopens D-013 rather than silently rewriting this record.

## Source record — semantic retrieval availability

Claim:
OpenAlex exposes corpus-level semantic work search separately from lexical search and can therefore surface candidates absent from lexical top-N.

Source(s):
- OpenAlex official semantic-search documentation.
- Live provider responses captured in the P0.5 semantic-gap diagnostic run.
- D-013 semantic-vs-lexical control telemetry recorded above.

Checked:
2026-09-10.

Conflict status:
None on endpoint availability.

Reconciliation trigger:
If production/experiment calls materially diverge from documented behavior, open a new operational conflict record rather than silently rewriting this one.

Consequence:
Reranking-only is rejected; L/S/H feasibility is tested under the preregistered fresh-holdout protocol before choosing production retrieval architecture.

Last updated: 2026-09-10
