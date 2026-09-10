# P0.5 — Hybrid Semantic Retrieval

Status: `ACTIVE`
Qualifier: `PREREGISTRATION DRAFT — NOT FROZEN / DO NOT EXECUTE GATE`
Canonical decision index: `docs/decisions.md` D-007, D-012, D-013, D-014

## PURPOSE

Determine whether OpenAlex corpus-level semantic retrieval, alone or combined with lexical retrieval, materially improves top-10 intent relevance over the existing lexical baseline without unacceptable regressions, while preserving a reproducible and economically bounded retrieval path.

This experiment evaluates retrieval, not production deployment. A winning arm does not automatically become production architecture.

## PRE-FREEZE BLOCKERS

The preregistration MUST NOT be marked FROZEN until:

1. D-013 semantic-search pricing conflict is reconciled by live authenticated telemetry, OR the experiment explicitly freezes the conservative `$10 / 1,000 semantic calls` assumption while leaving D-013 OPEN.
2. Independent reviewer has reviewed this preregistration draft and all raw canonical materials required for the review.
3. Any accepted reviewer modifications are incorporated before holdout construction.

No gate queries may be generated or inspected before the retrieval/fusion rules and gate definitions below are frozen.

## ARMS

### L — Lexical baseline

Provider: OpenAlex works endpoint.

Query mechanism: standard lexical `search=<intent>`.

Candidate depth: first 100 works returned by the provider, subject to provider availability.

Output: provider lexical order, truncated to top 10 after normalization/deduplication.

### S — Semantic retrieval

Provider: OpenAlex works endpoint.

Query mechanism: `search.semantic=<intent>`.

Candidate depth: first 50 works returned by the provider, or all returned works when fewer than 50 are available.

Execution pacing: semantic calls MUST be paced at <=1 request/second under D-012.

Output: provider semantic order, truncated to top 10 after normalization/deduplication.

### H — Hybrid retrieval

Candidate pool: union of the L top-100 and S top-50 candidate sets.

Deduplication identity, in order:
1. OpenAlex Work ID when available.
2. Normalized DOI when OpenAlex ID is unavailable.
3. Existing normalized title identity only when neither OpenAlex ID nor DOI exists.

Fusion algorithm: Reciprocal Rank Fusion (RRF), fixed `k = 60`.

For candidate `d`:

`RRF(d) = I_L(d)/(60 + rank_L(d)) + I_S(d)/(60 + rank_S(d))`

where ranks are 1-based and `I` is 1 when the candidate occurs in that arm, otherwise 0.

Score normalization: none. Provider lexical and semantic scores, if exposed, are not mixed or tuned.

Tie-breaking, in order:
1. Higher RRF score.
2. Better minimum rank across L and S.
3. Better lexical rank when present; absent lexical rank sorts after present lexical rank.
4. Better semantic rank when present; absent semantic rank sorts after present semantic rank.
5. Lexicographically ascending canonical identity string.

Final truncation: first 10 unique candidates after deterministic RRF ordering.

The RRF constant, candidate depths, deduplication identity, normalization rule, tie-break sequence, and truncation rule MUST NOT be tuned after the fresh holdout is generated.

## QUERY HANDLING

The exact user intent string is supplied independently to L and S.

No phrase quoting, query expansion, synonym injection, LLM rewrite, discipline-specific rewrite, or result-dependent query transformation is permitted in this experiment.

This isolates retrieval-mode effects from query-construction effects.

## FRESH GATE HOLDOUT — CONSTRUCTION PROTOCOL

Target size: 40 previously unseen queries.

The holdout is generated only after this protocol is frozen.

It must be hypothesis-driven rather than a random list and balanced across four broad domains:
- Materials / Energy: 10
- Biomedical: 10
- Social Science: 10
- Humanities: 10

Within each domain, include a deliberate mixture of:
- straightforward intents,
- conjunctive intents,
- lexical-ambiguity intents,
- technical/jargon intents,
- broad conceptual intents.

Mandatory slices across the 40-query holdout:
- Conjunctive-intent slice: at least 12 queries.
- Lexical-ambiguity slice: at least 8 queries.
- Technical/jargon slice: at least 8 queries.

Slices may overlap, but every query must have its slice tags frozen before retrieval results are inspected.

The 30-query P0.5-A benchmark is SEEN/CONTAMINATED and prohibited from the gate holdout.

A1/A2/A5/A6/A7 remain a separate mandatory diagnostic harm-regression slice. They are not counted in the fresh 40-query gate and cannot cause Gate PASS.

After generation, the 40 queries and their domain/slice tags are frozen. No replacement is permitted because a query produces inconvenient results. A query may be excluded only by a preregistered mechanical validity rule below.

## MECHANICAL VALIDITY / COVERAGE

For each arm/query, record returned candidate count before top-10 truncation.

A query-arm is `low-corpus` if fewer than 8 unique normalized candidates are returned.

Primary pairwise relevance comparisons involving an arm require both compared arms to have at least 8 unique candidates. Low-corpus cases remain reported and are not silently replaced.

Coverage itself is an outcome and must be reported per arm and domain.

## RELEVANCE RUBRIC

Evaluation unit: each displayed work title plus the minimum frozen bibliographic/evidence fields included in the evaluator bundle. The exact evaluator bundle fields must be fixed before labels begin and applied identically across arms.

Labels:
- `R` — directly relevant to the stated intent.
- `M` — materially related but incomplete/partial.
- `N` — indirect, topic-adjacent, or irrelevant.

Conjunctive-intent invariant:
`R` requires direct coverage of ALL essential explicitly stated components of the intent. Strong coverage of only one essential component is `M`, not `R`.

Primary relevance metric: `Relevant@10`, where only `R` counts positive.

Secondary diagnostic metric: `(R+M)@10`; it is descriptive and cannot override a failed primary gate.

## BLIND EVALUATION

The evaluator must operate in a physically separate fresh conversation/context.

The evaluator receives:
- anonymous query ID,
- intent text,
- randomized anonymous result lists,
- frozen relevance rubric,
- only the bibliographic/evidence fields defined in the frozen evaluator bundle.

The evaluator must NOT receive:
- L/S/H mapping,
- provider/ranking-arm identity,
- previous P0.5-A labels or results,
- A1/A2/A5/A6/A7 diagnostic history,
- expected winner,
- gate calculations,
- implementation discussion.

Arm mapping is opened only after labels are locked.

## PRIMARY COMPARISONS

Primary product question: whether H is safe and materially better than L.

Primary comparison: `H vs L`.

Secondary architecture comparison: `S vs L`.

Diagnostic comparison: `H vs S`.

The experiment must report all three, but H cannot be adopted merely because S beats L.

## GATE — H VS L

Let `N_eff` be fresh-holdout queries valid for both H and L.

H passes only if ALL conditions hold:

1. Mean Relevant@10 improvement H-L >= +5 percentage points.
2. Non-worse queries (`delta >= 0`) >= ceil(0.70 * N_eff).
3. Strong-improvement queries (`delta >= +20pp`) >= ceil(0.25 * N_eff).
4. No domain mean regression worse than -5pp.
5. No single-query regression worse than -20pp.
6. Conjunctive-intent slice mean regression is not below 0pp.
7. Lexical-ambiguity slice mean regression is not below 0pp.
8. H coverage-valid rate is not more than 5 percentage points below L.

Failure of any condition means H does not pass the adoption gate.

## S VS L DIAGNOSTIC GATE

S is evaluated with the same metrics as H vs L, but the result is architecture evidence rather than an automatic production-adoption decision.

This distinguishes whether gains come from semantic retrieval itself or from hybrid fusion.

## SEEN HARM-REGRESSION SLICE

After the fresh gate is fully evaluated and mappings are locked/opened, run A1/A2/A5/A6/A7 through L/S/H using the same frozen retrieval rules.

Purpose: detect recurrence of previously observed harm patterns.

These five queries:
- are diagnostic only,
- cannot rescue a failed fresh gate,
- cannot create a PASS,
- must be reported even if results are unfavorable.

## ECONOMIC / OPERATIONAL RECORD

Before execution, freeze:
- semantic calls required by the protocol,
- maximum planned semantic-call cost under the governing D-013 assumption,
- semantic pacing plan under D-012,
- retry policy.

Until D-013 is reconciled, use `$0.01 per semantic call` (`$10 / 1,000`) for conservative maximum-cost calculations.

Retries caused by transport/provider failure must be counted in actual semantic-call cost. Result-dependent retries are prohibited.

## D-013 TELEMETRY RECONCILIATION PROTOCOL

Before preregistration freeze, attempt 3 authenticated semantic calls using the same simple intent, paced >=1 second apart.

For each call record:
- UTC timestamp,
- request URL with API key/token redacted,
- HTTP status,
- `meta.cost_usd`,
- `X-RateLimit-Credits-Used`, if present,
- `X-RateLimit-Cost-USD`, if present,
- detected header family,
- first returned OpenAlex Work IDs/titles sufficient to audit retrieval mode.

Semantic-mode verification:
- run one lexical control call using `search=<same intent>`;
- compare its leading work IDs/titles with the semantic calls;
- do not infer semantic pricing from a call unless the request URL explicitly contains `search.semantic` and the response is a successful semantic result set.

Reconciliation rule:
- If all successful semantic calls provide the same unambiguous per-call USD cost and telemetry is internally consistent, D-013 may be reconciled to that observed cost.
- If values differ, required fields conflict, the endpoint mode is uncertain, or telemetry is incomplete in a way that prevents distinguishing `$0.001` from `$0.01`, D-013 remains OPEN and `$0.01/call` remains the conservative assumption.

Raw measurement evidence must be preserved in `docs/architecture/research-retrieval.md`; do not record only the conclusion.

## EXECUTION ORDER

1. Reviewer reviews this DRAFT and raw canonical materials.
2. Main thread reconciles reviewer findings.
3. Resolve D-013 by the telemetry protocol, or explicitly retain OPEN conflict + conservative cost.
4. Mark this preregistration `FROZEN`.
5. Generate/freeze the fresh 40-query holdout and slice tags.
6. Execute L/S/H retrieval without tuning.
7. Prepare randomized blind evaluator bundle.
8. Obtain and lock blind labels.
9. Open arm mapping and calculate gates.
10. Run/report seen harm-regression slice.
11. Record final outcome and architecture consequence.

## AMENDMENT HISTORY

Append-only after the first FROZEN version. No amendment may retroactively alter already-observed gate data or labels.

No amendments yet — preregistration is still DRAFT.

Last updated: 2026-09-10
