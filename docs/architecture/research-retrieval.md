# Research Retrieval Architecture

## Current status

P0.5 retrieval architecture is under experiment; no production semantic/hybrid retrieval has been adopted yet.

## CURRENT PROPOSAL

Evaluate three retrieval arms before any production implementation:

- `L` — OpenAlex lexical retrieval baseline.
- `S` — OpenAlex corpus-level semantic retrieval.
- `H` — lexical + semantic candidate union -> deduplication -> frozen deterministic fusion/ranking -> top 10.

The existing user-facing research endpoint contract remains unchanged during feasibility work.

## SUPERSEDED ARCHITECTURE

`Lexical candidate generation -> semantic reranking only`

Reason for supersession: provider-level diagnostics found that semantic retrieval returns many strong intent-relevant works absent from lexical top-100 pools. A reranker restricted to lexical candidates cannot recover missing documents.

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

## Constraints

- Do not use the seen 30-query P0.5-A set as the semantic/hybrid gate set.
- Do not adopt Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- Do not assume dense semantic similarity guarantees conjunctive-intent satisfaction.
- Fresh holdout must include a predeclared conjunctive-intent slice.
- Production changes require preregistered experiment evidence first.

## Source record

Claim:
OpenAlex exposes corpus-level semantic work search separately from lexical search and can therefore surface candidates absent from lexical top-N.

Source(s):
- OpenAlex official semantic-search documentation.
- Live provider responses captured in the P0.5 semantic-gap diagnostic run.

Checked:
2026-09-10

Conflict status:
No architectural conflict recorded for semantic-vs-lexical retrieval availability. Historical OpenAlex pricing/header documentation conflicts must be recorded separately when they affect operational limits or cost assumptions.

Reconciliation trigger:
For any operational source conflict, the next real provider call exposing the disputed field/value in live telemetry must reconcile or update the conflict record.

Consequence:
Reranking-only is superseded; L/S/H hybrid feasibility must be tested before choosing production retrieval architecture.

Last updated: 2026-09-10
