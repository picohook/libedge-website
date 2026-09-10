# P0.5 — Production Retrieval Architecture Proposal

Status: `ACTIVE — PROPOSED / PENDING INDEPENDENT ARCHITECTURE REVIEW`
Decision index: `docs/decisions.md` D-016
Evidence closure: `docs/experiments/p05-final-outcome.md`

## Decision to review

Adopt OpenAlex corpus-level semantic retrieval (`S`) as the **primary production retrieval path for the existing top-10 research-result contract**, with lexical retrieval (`L`) retained only as an objective availability fallback. Do not adopt the tested RRF hybrid (`H`). Do not add Vectorize at this stage.

This is a separate production-architecture proposal. It is not an automatic consequence of the P0.5 experiment and is not governing production state until D-016 is explicitly LOCKED after review.

## Evidence supporting the proposal

### Fresh 40-query holdout

The independently verified frozen experiment produced:

- Gate A, H vs L: PASS for both primary raters.
- Gate B, H vs S: FAIL for both primary raters.
- Predeclared matrix: `H REJECTED`.
- S vs L mean Relevant@10 delta:
  - Rater 1: `+26.75pp`.
  - Rater 2: `+25.25pp`.
- S vs L non-worse:
  - Rater 1: `39/40`.
  - Rater 2: `37/40`.
- S vs L domain means were positive in all four domains for both raters.
- S vs L conjunctive and lexical-ambiguity slice means were positive for both raters.

The frozen S-vs-L coverage rule reports `40/40` regressions because L retrieves up to 100 candidates while the provider semantic endpoint is constrained to at most 50. This is a real depth asymmetry and remains a limitation; it is not treated as a standalone top-10 relevance failure.

### Seen harm-regression slice

Two new independent harm raters produced aggregate Relevant@10:

- Rater 1: L `44%`, H `72%`, S `78%`.
- Rater 2: L `46%`, H `72%`, S `82%`.

Both therefore show `S > H > L` on aggregate, while unfavorable per-case results remain retained. This slice is diagnostic only and does not itself create an adoption gate.

## Why S rather than H

H requires both lexical and semantic provider calls, then fusion. Under the frozen experiment H improved L but was materially inferior to S on the mandatory H-vs-S non-inferiority gate for both raters.

Choosing H would therefore add provider calls, fusion complexity, and operational surface area while selecting a retrieval output that the independently verified fresh evaluation found worse than S.

## Why S rather than L

For the current top-10 output contract, S produced a large and rater-robust relevance improvement over L on the fresh holdout, including positive domain and key-slice diagnostics. The separate seen harm slice showed the same aggregate direction.

L remains useful as an operational fallback because it is already integrated and does not share the semantic-search-specific pacing dependency.

## Proposed production architecture

### Primary path

For an eligible research query:

1. Send the existing user intent to OpenAlex semantic retrieval using the same query text; no LLM rewrite, phrase injection, or result-dependent transformation.
2. Request up to the provider-supported semantic candidate depth (`<=50`).
3. Apply the existing normalization/deduplication projection.
4. Return the first 10 unique normalized semantic results under the existing user-facing evidence contract.

No lexical+semantic RRF fusion is used.

### Availability fallback

Retain L as a **transport/provider-availability fallback only**.

Fallback from S to L is allowed only on an objective semantic-path availability condition, such as:

- timeout/network failure;
- HTTP 429 after the permitted operational handling policy;
- provider 5xx;
- semantic endpoint unavailable/disabled;
- an explicitly detected provider operational condition that prevents a valid semantic response.

Fallback MUST NOT depend on candidate content, candidate count once a valid response is returned, apparent relevance, expected answer quality, topic, discipline, or whether lexical results look preferable.

A successful valid S response is not silently supplemented or replaced by L. This prevents production from recreating an untested result-dependent hybrid policy.

### No H

The frozen RRF hybrid is not a production fallback or secondary reranking stage. H is experimentally rejected under the preregistered matrix.

### No Vectorize

Do not add a separate vector database/retrieval layer now. P0.5 found strong relevance gains from the provider's corpus-level semantic endpoint. Vectorize remains a future option only if new evidence shows the provider semantic path is insufficient for product requirements.

## Operational constraints that remain real

### Semantic pacing / capacity

The current canonical provider record treats semantic search as a `<=1 request/second` dependency. Production S therefore requires explicit concurrency control/queueing or another compliant request-shaping mechanism at the application boundary.

If expected production demand cannot be served within this constraint without unacceptable latency, that is an operational deployment blocker to resolve; it is not a reason to silently change the evidence conclusion or reintroduce H.

### Candidate depth

S is provider-constrained to at most 50 candidates versus L top-100. The experiment establishes superiority for the current top-10 relevance contract, not superiority for deep pagination, exhaustive recall, or arbitrary candidate-pool depth.

Therefore this proposal applies only to the current top-10 retrieval contract. Any future product requirement for deep result pagination/exhaustive recall requires separate evidence.

### Pricing

Observed authenticated P0.5 telemetry charged `$0.001` per successful S call. A semantic-only primary path uses one provider retrieval call per normal query, whereas the tested H path requires both L and S calls. D-013 remains subject to its existing reopen trigger if authenticated charged-cost telemetry materially changes.

### Provider dependency

S increases dependence on the semantic endpoint's availability and rate policy. L remains available as an objective availability fallback and rollback path.

## Rollout boundary

If this proposal is accepted and D-016 becomes LOCKED:

- implement S-primary behind a controlled staging/feature-flag path first;
- preserve L as the immediate operational rollback/fallback path;
- keep the external research-result contract unchanged;
- verify request pacing, latency, error handling, telemetry, privacy invariants, and evidence-level rendering before broad production enablement;
- do not retune relevance behavior against the seen P0.5 holdouts during rollout.

These are implementation/operational checks, not a new post-hoc relevance gate.

## Monitoring invariants

Production monitoring may record aggregate operational fields needed for availability, latency, rate/cost and failure monitoring, but must not add stored user query text, topic labels, or research-interest content.

Monitor at minimum:

- semantic request success/failure counts;
- objective fallback-to-L count/rate;
- latency distribution;
- 429/5xx/network-failure rates;
- charged-cost/credit telemetry for D-013 reopen detection.

A rising fallback rate or materially changed provider cost/rate behavior triggers operational review. It does not authorize content-dependent switching between S and L.

## Alternatives considered

### Adopt H

`REJECTED BY EXPERIMENTAL EVIDENCE` — Gate B failed for both primary fresh raters and H adds complexity/calls relative to S.

### Retain L as primary

Operationally simplest, but inconsistent with the large, independently verified top-10 relevance advantage of S on the fresh holdout and seen diagnostic.

### Adopt S with no fallback

Not preferred. It would create unnecessary availability risk while an already integrated lexical path exists.

### Add Vectorize now

Not supported by current evidence. It adds infrastructure before the existing provider semantic endpoint has been shown insufficient.

## Proposed D-016 disposition

If independent architecture review accepts this proposal, update D-016:

- Status: `LOCKED`.
- Decision: `Use S as the primary retrieval architecture for the existing top-10 research-result contract; retain L only as objective availability fallback; reject H; do not add Vectorize without new evidence.`

Until that transition occurs, current production behavior remains unchanged.

## Review questions

The independent reviewer should specifically challenge:

1. whether the fresh and harm evidence is sufficient to prefer S for the existing top-10 contract;
2. whether the 40/40 frozen coverage-regression caveat limits the proposed scope appropriately;
3. whether objective L fallback avoids recreating an untested hybrid/result-dependent policy;
4. whether the <=1 request/second semantic constraint creates an unresolved production blocker;
5. whether measured cost, complexity and rollback considerations favor S over H;
6. whether any additional pre-adoption operational condition is required without turning rollout checks into a post-hoc relevance gate;
7. whether D-016 should be LOCKED as proposed, modified, or rejected.

Last updated: 2026-09-10
