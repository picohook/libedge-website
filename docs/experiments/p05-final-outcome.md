# P0.5 — Final Experimental Outcome

Status: `HISTORICAL — CLOSED / INDEPENDENTLY VERIFIED`
Closed: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`
Fresh evaluation: `docs/experiments/p05-hybrid-semantic-evaluation.md`
Harm evaluation: `docs/experiments/p05-harm-regression-evaluation.md`

## Experimental question

Whether lexical retrieval (L), semantic retrieval (S), or the frozen lexical+semantic RRF hybrid (H) materially improves top-10 research-intent relevance without unacceptable regressions under the preregistered P0.5 protocol.

## Fresh-gate outcome

Both primary fresh blind raters independently produced the same binary gate result:

- Gate A — H vs L: `PASS`.
- Gate B — H vs S: `FAIL`.
- Third-rater trigger: `NOT TRIGGERED`.
- Predeclared matrix disposition: **`H REJECTED`**.

The fresh S-vs-L diagnostic was strongly positive on Relevant@10 for both raters:

- Rater 1: `+26.75pp`.
- Rater 2: `+25.25pp`.

The frozen S-vs-L coverage rule reports `40/40` regressions because the provider-constrained candidate depths are L=100 and S<=50. This structural asymmetry must always remain adjacent to the statistic and is not interpreted as a standalone relevance failure.

## Seen harm-regression outcome

The preregistered A1/A2/A5/A6/A7 diagnostic was completed under a separate frozen anonymous bundle and two new independent blind raters.

Aggregate Relevant@10:

- Harm Rater 1: L `44%`, H `72%`, S `78%`.
- Harm Rater 2: L `46%`, H `72%`, S `82%`.

Both harm raters therefore show the aggregate directional pattern `S > H > L` while unfavorable per-case evidence remains explicitly retained. This slice is diagnostic only and creates no adoption gate.

## Final experimental conclusion

1. **H is rejected.** It materially improves L but fails the frozen non-inferiority comparison against S for both fresh raters; the seen harm diagnostic is directionally consistent with that result.
2. **S is the strongest remaining architecture candidate on relevance evidence.** It substantially outperforms L on the fresh S-vs-L diagnostic for both raters and on aggregate in the seen harm slice.
3. **S is not automatically production-adopted by this experiment.** Production architecture is governed separately by D-016 and must explicitly account for operational constraints, including the provider semantic-search pacing limit, candidate-depth asymmetry, provider dependency, and rollback/fallback behavior.
4. **L remains the known operational baseline** until a separate production architecture decision is LOCKED and implemented.
5. **Vectorize remains unnecessary at this stage.** P0.5 found strong corpus-level semantic retrieval evidence within the existing provider; no evidence from this experiment requires an additional vector database layer.

## Independent verification chain

The experiment's retrieval execution, evaluator-bundle construction, seed/mapping integrity, fresh-gate calculations, harm retrieval, harm bundle, and final harm diagnostic reconstruction were independently reviewed from raw artifacts. No execution correction or label reconciliation was required.

## Architecture handoff

This file closes the experiment only. The next control-plane action is a separate D-016 production-architecture review. The evidence supports proposing S rather than H or L, but that proposal is not governing production state until D-016 transitions from `PROPOSED` to `LOCKED` after its architecture review.

Last updated: 2026-09-10
