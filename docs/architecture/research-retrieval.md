# Research Retrieval Architecture

Status: `ACTIVE`
Qualifier: `EXPERIMENTAL / NOT PRODUCTION-ADOPTED`
Canonical decision index: `docs/decisions.md`
Supersession rule: if this architecture record is replaced in full, change this header to `SUPERSEDED (see D-0XX and replacement record)` before treating the replacement as canonical.

## Current status

P0.5 retrieval architecture is under experiment; no production semantic/hybrid retrieval has been adopted yet.

## CURRENT PROPOSAL

Evaluate three retrieval arms before any production implementation:

- `L` — OpenAlex lexical retrieval baseline.
- `S` — OpenAlex corpus-level semantic retrieval.
- `H` — lexical + semantic candidate union -> deduplication -> **preregistered deterministic fusion/ranking** -> top 10.

The existing user-facing research endpoint contract remains unchanged during feasibility work.

This proposal spans two canonical dimensions:
- architecture rationale and consequences live in this file;
- preregistration, frozen protocol, amendments, and gate results will live in `docs/experiments/p05-hybrid-semantic.md` once created.

Neither dimension substitutes for the other.

### H-arm unresolved prerequisite

The H-arm fusion/ranking algorithm is **NOT YET DEFINED**.

Before H can be executed, the preregistration must explicitly freeze:
- lexical candidate depth,
- semantic candidate depth,
- deduplication identity rule,
- fusion/ranking algorithm,
- score normalization if any,
- tie-breaking,
- final truncation rule.

The phrase `deterministic fusion/ranking` is a requirement, not evidence that an algorithm is already locked.

## REJECTED PRIOR PROPOSAL

`Lexical candidate generation -> semantic reranking only`

Decision status: `REJECTED`, not `SUPERSEDED`.

Reason: the idea was considered but never adopted as governing/production architecture. Provider-level diagnostics later found that semantic retrieval returns many strong intent-relevant works absent from lexical top-100 pools. A reranker restricted to lexical candidates cannot recover missing documents.

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

Consequence:
P0.5 experiment execution must pace semantic calls at <=1 request/second even though the general API documentation describes a higher overall request ceiling.

### Semantic pricing

Status: `CURRENT ASSUMPTION — OFFICIAL SOURCES CONVERGED ON CHECK DATE`

Claim:
Use $1 per 1,000 semantic-search calls for current P0.5 planning.

Source(s):
- OpenAlex official Example Costs page: semantic search $1/1,000 calls.
- OpenAlex official Semantic Search page: pricing delegated to pricing-by-endpoint documentation.

Checked:
2026-09-10.

Conflict status:
A reviewer previously reported an official-source discrepancy of $1 vs $10 per 1,000 semantic calls. On the current check date, the authoritative pages inspected do not reproduce the $10 semantic-search price. Therefore the discrepancy is preserved as **historical conflict evidence**, not treated as an active current conflict/fact.

Reconciliation/reopen trigger:
Reopen the pricing conflict if an official OpenAlex page, billing metadata, API usage metadata, or invoice again shows a semantic-search rate inconsistent with $1/1,000.

Consequence:
Budget P0.5 using $1/1,000 semantic calls today, but do not erase the historical discrepancy.

## Constraints

- Do not use the seen 30-query P0.5-A set as the semantic/hybrid gate set.
- Do not adopt Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- Do not assume dense semantic similarity guarantees conjunctive-intent satisfaction.
- Fresh holdout must include a predeclared conjunctive-intent slice.
- Production changes require preregistered experiment evidence first.
- Do not execute H until its fusion specification is frozen as required by D-014.

## Source record — semantic retrieval availability

Claim:
OpenAlex exposes corpus-level semantic work search separately from lexical search and can therefore surface candidates absent from lexical top-N.

Source(s):
- OpenAlex official semantic-search documentation.
- Live provider responses captured in the P0.5 semantic-gap diagnostic run.

Checked:
2026-09-10.

Conflict status:
None on endpoint availability.

Reconciliation trigger:
If production/experiment calls materially diverge from documented behavior, open a new operational conflict record rather than silently rewriting this one.

Consequence:
Reranking-only is rejected; L/S/H feasibility must be preregistered and tested before choosing production retrieval architecture.

Last updated: 2026-09-10
