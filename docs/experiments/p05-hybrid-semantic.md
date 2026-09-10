# P0.5 — Hybrid Semantic Retrieval

Status: `ACTIVE`
Qualifier: `PREREGISTRATION FROZEN — HOLDOUT MAY NOW BE CONSTRUCTED / NO RETRIEVAL TUNING`
Frozen: `2026-09-10`
Canonical decision index: `docs/decisions.md` D-007, D-012, D-013, D-014

## PURPOSE

Determine whether OpenAlex corpus-level semantic retrieval, alone or combined with lexical retrieval, materially improves top-10 intent relevance over the existing lexical baseline without unacceptable regressions, while preserving a reproducible and economically bounded retrieval path.

This experiment evaluates retrieval, not production deployment. A winning arm does not automatically become production architecture.

## FREEZE CONDITIONS — SATISFIED

1. D-013 is CLOSED by live authenticated telemetry at `$0.001 / semantic call` (`$1 / 1,000`).
2. Independent reviewer reviewed the preregistration and canonical evidence and reported no remaining methodological FREEZE blocker.
3. Accepted reviewer modifications were incorporated before holdout construction.
4. No fresh gate holdout was generated or inspected before this freeze.

From this point onward, retrieval/fusion rules, evaluator protocol, gate thresholds, economic assumption, and mechanical validity rules below are immutable for this experiment except through an explicit append-only amendment made before affected data are observed. No amendment may respond to observed gate results.

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
The L=100 / S=50 asymmetry is provider-constrained, not a tuning choice: the semantic endpoint supports at most 50 returned works per query in the current official interface.
Execution pacing: semantic calls MUST be paced at <=1 request/second under D-012.
Output: provider semantic order, truncated to top 10 after normalization/deduplication.

### H — Hybrid retrieval
Candidate pool: union of the L top-100 and S top-50 candidate sets.
Deduplication identity, in order:
1. OpenAlex Work ID when available.
2. Normalized DOI when OpenAlex ID is unavailable.
3. Existing normalized title identity only when neither OpenAlex ID nor DOI exists.

Fusion algorithm: Reciprocal Rank Fusion (RRF), fixed `k = 60`.

`RRF(d) = I_L(d)/(60 + rank_L(d)) + I_S(d)/(60 + rank_S(d))`

where ranks are 1-based, an absent arm contributes exactly zero, and no synthetic rank/penalty is assigned.

Score normalization: none. Provider lexical and semantic scores are not mixed or tuned.

Tie-breaking, in order:
1. Higher RRF score.
2. Better minimum rank across L and S.
3. Better lexical rank when present; absent sorts after present.
4. Better semantic rank when present; absent sorts after present.
5. Lexicographically ascending canonical identity string.

Final truncation: first 10 unique candidates after deterministic RRF ordering.

The RRF constant, candidate depths, deduplication identity, normalization rule, tie-break sequence, and truncation rule MUST NOT be tuned after this freeze.

## QUERY HANDLING

The exact user intent string is supplied independently to L and S. No phrase quoting, query expansion, synonym injection, LLM rewrite, discipline-specific rewrite, or result-dependent query transformation is permitted.

## FRESH GATE HOLDOUT — CONSTRUCTION PROTOCOL

Target size: 40 previously unseen queries, generated only after this frozen protocol.

Balanced domains:
- Materials / Energy: 10
- Biomedical: 10
- Social Science: 10
- Humanities: 10

Within each domain include a deliberate mixture of straightforward, conjunctive, lexical-ambiguity, technical/jargon, and broad conceptual intents.

Mandatory slices across the 40-query holdout:
- Conjunctive-intent: at least 12.
- Lexical-ambiguity: at least 8.
- Technical/jargon: at least 8.

Slices may overlap; every query's domain/slice tags are frozen before retrieval results are inspected.

The 30-query P0.5-A benchmark is SEEN/CONTAMINATED and prohibited from the gate holdout. A1/A2/A5/A6/A7 remain a separate mandatory diagnostic harm-regression slice and cannot cause Gate PASS.

After generation, no query replacement is permitted because of inconvenient results. Exclusion is permitted only by the frozen mechanical validity rule below.

## MECHANICAL VALIDITY / COVERAGE

For each arm/query record unique normalized candidate count before top-10 truncation.

Coverage comparator baseline:
- H vs L -> L.
- S vs L -> L.
- H vs S -> S.

A pairwise coverage regression occurs if comparator baseline count >=8 and compared-arm count <8, OR compared-arm count/comparator baseline count <0.80.

If either arm in a pair returns fewer than 8 unique normalized candidates, that pair/query is `low-corpus`, excluded from aggregate pairwise relevance metrics, and still reported. Sparse queries are never silently replaced. Coverage is reported per arm, pair, domain, and declared slice.

## RELEVANCE RUBRIC

Labels:
- `R` — directly relevant to the stated intent.
- `M` — materially related but incomplete/partial.
- `N` — indirect, topic-adjacent, or irrelevant.

Conjunctive invariant: `R` requires direct coverage of ALL essential explicitly stated components. Strong coverage of only one essential component is `M`.

Primary metric: `Relevant@10`, only R positive.
Secondary diagnostic: `(R+M)@10`; descriptive only and cannot override a failed primary gate.

The evaluator bundle's exact bibliographic/evidence fields must be frozen before labels begin and applied identically across arms.

## BLIND TWO-RATER EVALUATION

The fresh 40-query evaluation uses two independent blind raters in physically separate fresh context lineages. Neither sees the other's labels/reasoning/gates before locking.

Each receives only anonymous query ID, intent, randomized anonymous result lists, frozen rubric, and frozen evaluator-bundle fields. They must not receive L/S/H mapping, provider identity, prior P0.5-A results, A1/A2/A5/A6/A7 history, expected winner, gate calculations, implementation discussion, or other-rater output.

Same frozen randomized bundle/rubric for both. Mapping opens only after BOTH primary raters lock all labels.

Gate A, Gate B and S-vs-L metrics are calculated separately per rater. N_eff is mechanically determined from retrieval coverage. Do not average labels before gate calculation or post-hoc reconcile item labels.

If both raters agree on Gate A PASS/FAIL and Gate B PASS/FAIL, outcome is `RATER-ROBUST`. If either gate differs, obtain a third blind evaluator in a third fresh independent lineage using the same frozen bundle/rubric and no prior outputs. Each disputed gate is resolved by 2-of-3 gate-level majority. No synthetic numeric metric or consensus item labels are created. All valid per-rater component vectors remain official.

S-vs-L disagreement alone does not trigger a third rater; preserve all valid rater-specific diagnostic metrics.

## COMPONENT-LEVEL REPORTING

For every valid rater report separately for Gate A, Gate B and S-vs-L: N_eff; mean Relevant@10 delta; non-worse count/rate; strong-improvement count/rate where defined; domain deltas; worst query delta/ID; conjunctive and lexical-ambiguity slice deltas/effective N; coverage-regression count/rate/IDs; and every gate component PASS/FAIL where applicable.

If a gate fails, identify all failed components. With a third rater, show all three component vectors side by side and then the binary majority result. No aggregate component vector replaces individual vectors.

## PRIMARY COMPARISONS

Primary adoption comparison: H vs L.
Mandatory non-inferiority guardrail: H vs S.
Secondary architecture diagnostic: S vs L; NOT an adoption gate.

## GATE A — H VS L

H passes only if ALL hold:
1. Mean Relevant@10 H-L >= +5pp.
2. Non-worse >= ceil(0.70*N_eff).
3. Strong improvement (>=+20pp) >= ceil(0.25*N_eff).
4. No domain mean regression worse than -5pp.
5. No single-query regression worse than -20pp.
6. Conjunctive slice mean >= -3pp.
7. Lexical-ambiguity slice mean >= -3pp.
8. No frozen-rule coverage regression pattern.

## GATE B — H VS S NON-INFERIORITY

H passes only if ALL hold:
1. Mean Relevant@10 H-S >=0pp.
2. Non-worse >= ceil(0.60*N_eff).
3. No domain mean regression worse than -5pp.
4. No single-query regression worse than -20pp.
5. Conjunctive slice mean >= -3pp.
6. Lexical-ambiguity slice mean >= -3pp.
7. No frozen-rule coverage regression pattern.

## S VS L DIAGNOSTIC

Report the same relevant component metrics. It has no PASS/FAIL adoption status in this experiment and informs whether semantic-only is a simpler promising alternative.

## PREDECLARED A/B DECISION MATRIX

| Gate A | Gate B | H disposition | Consequence |
| --- | --- | --- | --- |
| PASS | PASS | `H ELIGIBLE` | Separate production-architecture decision required; compare complexity/cost with S-vs-L evidence. |
| PASS | FAIL | `H REJECTED` | H improves L but is inferior to simpler S; use S-vs-L evidence for separate S consideration. |
| FAIL | PASS | `H REJECTED` | H not materially better than L; consider S only if S-vs-L merits it, otherwise retain L. |
| FAIL | FAIL | `H REJECTED` | Use S-vs-L to assess S; if not compelling retain L. Vectorize is not automatically triggered. |

No post-hoc fifth category.

## SEEN HARM-REGRESSION SLICE

After fresh gate evaluation/reconciliation and mapping opening, run A1/A2/A5/A6/A7 through all L/S/H using the frozen rules. This slice is diagnostic only, cannot rescue/create PASS, and must report unfavorable results.

Use the same frozen R/M/N rubric and two-rater blind-independence standard with a separate randomized anonymous harm-slice bundle. Each rater uses a distinct fresh lineage and sees no mapping or other-rater labels before locking. Because this slice has no adoption gate, disagreement does not trigger a third rater; preserve both rater-specific results separately with no synthetic consensus.

## ECONOMIC / OPERATIONAL RECORD — FROZEN

Governing D-013 price: `$0.001 / semantic call` (`$1 / 1,000`), reconciled by 3/3 authenticated live observations on 2026-09-10. Canonical raw evidence: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`.

The prior `$0.01/call` conservative interim assumption is historical only and is NOT used for this frozen experiment's budget/capacity calculation.

Planned semantic calls for fresh retrieval: 40 S calls. H reuses the same frozen L/S candidate sets and does not issue an additional semantic request. Seen harm slice adds 5 S calls after gate reconciliation. Base planned semantic-call count: 45. Base planned semantic charge: `$0.045`.

Transport/provider retries are counted in actual cost. Result-dependent retries are prohibited. For operational headroom, maximum planned semantic charge before manual investigation is frozen at `$0.060` (60 charged semantic calls total, allowing at most 15 transport/provider retry calls across the experiment). Exceeding this cap stops automated execution for investigation; it does not authorize query/result replacement.

Semantic pacing remains <=1 request/second.

### Passive D-013 reopen observation

Existing provider telemetry extraction already captures `requestCostUsd` from `X-RateLimit-Cost-USD` or `meta.cost_usd` and `requestCredits` from `X-RateLimit-Credits-Used`. During P0.5 execution and any later production semantic operation, preserve these fields in operational telemetry at aggregate/request-cost level without storing user query text or research-interest content.

If an authenticated semantic call reports a materially different charge from `$0.001`, or body/header cost telemetry conflicts, flag D-013 for review rather than silently accepting the new price. This passive observation is a reopen detector, not permission to change the frozen experiment's pricing assumption mid-run.

## D-013 RECONCILIATION — CLOSED BEFORE FREEZE

Three authenticated `search.semantic` calls returned `meta.cost_usd=0.001`, `X-RateLimit-Cost-USD=0.001`, and `X-RateLimit-Credits-Used=10` on 3/3 observations. A lexical control on the same intent returned a distinct leading Work-ID set, verifying semantic mode. D-013 is LOCKED at the observed `$1/1,000` P0.5 planning price; materially different authenticated telemetry is the reopen trigger.

## EXECUTION ORDER

1. **FROZEN preregistration — completed 2026-09-10.**
2. Generate/freeze the fresh 40-query holdout and slice tags.
3. Execute L/S/H retrieval without tuning; H reuses L/S candidate sets.
4. Prepare one frozen randomized blind evaluator bundle and freeze its bibliographic/evidence fields.
5. Obtain/lock two independent blind-rater label sets in separate fresh lineages.
6. Open mapping only after both lock; calculate Gate A, Gate B, S-vs-L separately per rater.
7. If Gate A or B differs, obtain third fresh blind rater and apply only 2-of-3 binary gate majority.
8. Apply predeclared A/B matrix.
9. Run/report A1/A2/A5/A6/A7 harm-regression slice under its own two-rater blind diagnostic protocol.
10. Record final experiment outcome and architecture consequence.

## AMENDMENT HISTORY

Append-only from this frozen version onward. No amendment may retroactively alter observed gate data or labels.

- `2026-09-10 — FREEZE`: initial frozen preregistration. D-013 price fixed for this experiment at `$0.001/call`; base semantic-call budget fixed at 45 calls / `$0.045`, operational cap 60 calls / `$0.060`; passive cost-telemetry reopen detector specified. No fresh gate holdout existed at freeze time.

Last updated: 2026-09-10
