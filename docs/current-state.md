# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Fresh retrieval COMPLETE / mechanically ACCEPTED; both primary blind-rater label sets FINAL / LOCKED; pre-mapping inter-rater agreement diagnostic LOCKED; private mapping remains SEALED.

## CLOSED

- P0 Academic Metadata Gateway — CLOSED.
- P0 metadata/plumbing validation — CLOSED; plumbing GREEN, lexical relevance YELLOW.
- Global selective-phrase rewrite A/B — CLOSED / REJECTED.
- P0.5-A conditional lexical feasibility — CLOSED / FAIL.
- P0.5-A rater reconciliation — CLOSED; rater-definition robust A2 FAIL / B FAIL.
- Lexical top-100 depth diagnostic — CLOSED.
- Semantic-vs-lexical gap diagnostic — CLOSED; material retrieval-level recall gap found.
- Governance red-team review 2026-09-10 — CLOSED; findings triaged and control-plane corrections applied.
- P0.5 hybrid preregistration methodology review — CLOSED; reviewer reports no remaining methodological FREEZE blocker.
- D-013 semantic pricing reconciliation — CLOSED / LOCKED at observed `$0.001/call` (`$1/1,000`) for P0.5 planning.
- P0.5 Hybrid Semantic Retrieval preregistration — FROZEN 2026-09-10 before fresh gate holdout generation.
- Pre-holdout economic amendment — CLOSED before holdout generation/results: total provider budget corrected to include both L and S calls.
- Fresh 40-query holdout construction/tagging — CLOSED / FROZEN before retrieval. Canonical holdout: `docs/experiments/p05-hybrid-semantic-holdout.md`.
- Pre-retrieval governance cleanup — CLOSED: D-007 now LOCKED for experiment execution only; production adoption separated into D-016 PROPOSED.
- Pre-retrieval retry/failure clarification — CLOSED before any fresh L/S result: one initial request + at most two objective transport/provider retries per query/arm; persistent failure is recorded and mechanically excluded for affected pairwise aggregate relevance metrics.
- Fresh 40-query L/S retrieval — CLOSED / EXECUTED 2026-09-10. Exactly 80 provider attempts = 40 L + 40 S; no retries, no retrieval failures; H mechanically available for 40/40 queries. Observed charge `$0.080`; no D-013 pricing anomaly. Canonical execution record: `docs/experiments/p05-hybrid-semantic-retrieval.md`.
- Retrieval mechanical audit — CLOSED: all 40 H top-10 lists independently recomputed under frozen RRF/tie-break with exact agreement; semantic pacing compliant; no low-corpus pairs. Frozen coverage rule reports H-v-L 0/40 regressions, H-v-S 0/40, S-v-L 40/40; the latter is reported without rule reinterpretation.
- Independent P0.5 retrieval-execution review — CLOSED / ACCEPTED. Reviewer freshly inspected the complete raw artifact and relevant diffs, independently recomputed all 40 H top-10 lists with 400/400 positional agreement, and found no execution correction required. Canonical review: `docs/reviews/2026-09-10-p05-retrieval-execution-review.md`.
- Fresh blind evaluator bundle construction — CLOSED / FROZEN 2026-09-10 before any relevance labels. Public bundle SHA-256 `a39f172b249dd8fd1b1b97598257fb936a81e3da40e77bc21af9609373330624`; private mapping sealed. Canonical freeze record: `docs/experiments/p05-hybrid-semantic-evaluator-bundle.md`.
- Evaluator-bundle structural review — CLOSED / ACCEPTED. Reviewer found no blocker to delivering the existing frozen bundle to the two independent blind raters. A sequencing defect was identified: the bundle had been promoted to FROZEN before upstream retrieval review acceptance. This caused no retrospective invalidity because retrieval was subsequently ACCEPTED without correction; prospective control D-017 is now LOCKED.
- Primary Blind Rater 1 — CLOSED / FINAL / LOCKED; 1,200/1,200 labels completed under the frozen public bundle.
- Primary Blind Rater 2 — CLOSED / FINAL / LOCKED; 1,200/1,200 labels completed under the same frozen public bundle.
- Pre-mapping inter-rater agreement analysis plan — LOCKED before agreement computation. Canonical plan: `docs/experiments/p05-rater-agreement.md`.

## ACTIVE

- Frozen holdout contains exactly 40 unseen intents: 10 Materials/Energy, 10 Biomedical, 10 Social Science, 10 Humanities.
- Frozen slices: conjunctive 17, lexical ambiguity 15, technical/jargon 16; overlap permitted.
- Candidate architecture under test remains unchanged:
  - L: OpenAlex lexical top-100 baseline.
  - S: OpenAlex semantic top-50 retrieval.
  - H: L/S union -> canonical deduplication -> RRF `k=60` -> deterministic tie-break -> top 10; no additional provider call.
- Fresh retrieval raw artifact is frozen at workflow run `34498804224`, artifact ID `10161068719`, SHA-256 `79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8`.
- Frozen public evaluator bundle artifact: run `34499706628`, artifact ID `10161315961`, bundle-file SHA-256 `a39f172b249dd8fd1b1b97598257fb936a81e3da40e77bc21af9609373330624`.
- Private evaluator mapping artifact ID `10161316449`, mapping-file SHA-256 `defd6b39361dff452a826966769b680254d2bc43924143a52cfe2af7ed0b6b0c`; seed commitment `388813fddbb0d2519baafa62cbc28af7e82f3a0cd665314c61ed4c1ddf801bd1`. Mapping remains SEALED until the pre-mapping agreement diagnostic is completed; both primary rater label sets are already locked, so mapping may be opened immediately afterward under the frozen parent protocol.
- Pre-mapping agreement diagnostic is descriptive only. Primary statistic: exact R/M/N agreement over 1,200 fixed result positions; secondary diagnostics: adjacent R/M or M/N disagreement and extreme R↔N disagreement; full 3×3 confusion matrix and per-query counts are allowed. No agreement result can exclude/reweight/relabel a query/result, reinterpret the rubric, trigger a third rater, alter gate computation, or influence production adoption.
- Slice-stratified or arm-specific agreement is not permitted before mapping opens because slice/arm identities are not evaluator-visible. After legitimate mapping-open it may be reported only as a descriptive diagnostic with no gate consequence.
- Reviewer OOS-01 is `ACKNOWLEDGED / DEFERRED`: DOI/title dedup fallback branches were not exercised by this OpenAlex-native artifact. Revisit before an OpenAlex-external or ID-less ingestion path depends on fallback identity behavior.
- Reviewer OOS-02 is `ACKNOWLEDGED / DEFERRED`: S-vs-L coverage regression `40/40` is structurally induced by frozen depth asymmetry (L=100, S<=50). Any final evaluation/architecture summary must keep this caveat adjacent to the statistic and must not present it as a standalone relevance conclusion.
- Bundle-review OOS sequencing finding is `OPEN -> RESOLVED BY PROCESS CONTROL`: D-017 now requires upstream reviewer acceptance before a derived experimental artifact enters an irreversible/frozen stage; provisional parallel construction remains allowed.
- Bundle-review note is `ACKNOWLEDGED / DEFERRED`: the randomization seed must be revealed and verified against commitment `388813f...` after both primary label sets are locked and the mapping is legitimately opened. Revisit at mapping-open/final-report stage.
- Bundle-review limitation is `ACKNOWLEDGED / DEFERRED`: anonymous H may be structurally inferable from cross-list overlap because it is derived from L/S union+rerank. No change is made to the already-frozen bundle; record as an evaluation-design limitation and revisit before a future experiment if stronger arm-independence masking is needed.
- No Gate A/B result, S-vs-L relevance conclusion, or production architecture decision exists yet.
- P0.5 frozen economic assumption remains measured `$0.001 / provider call`. Fresh retrieval consumed 80 of the base experiment's 90 planned calls; later 5-query harm slice still requires 10 base calls. Global experiment cap remains 120 charged provider calls / `$0.120`.
- Passive charged-cost/credit monitoring remains ACTIVE for the later 5-query harm slice. Cost monitoring stores no query/topic/user research-interest content.
- Production semantic/hybrid retrieval remains NOT ADOPTED; D-016 is PROPOSED pending fresh-holdout evidence and a later architecture decision.

## NEXT

1. Mechanically verify both FINAL / LOCKED rater outputs against the frozen public bundle identifiers: 40 Q IDs, A/B/C, 10 ranks/list, exact result IDs, valid R/M/N labels, and no rater-side renumbering/reordering.
2. Compute only the locked pre-mapping diagnostic in `docs/experiments/p05-rater-agreement.md`: exact agreement, full 3×3 confusion matrix, adjacent disagreement, R↔N disagreement, and per-query counts. Do not infer arms or slices.
3. Record the agreement diagnostic as descriptive only; it cannot trigger protocol changes or a third rater.
4. Then open the frozen private mapping, reveal/verify the randomization seed commitment, and calculate Gate A, Gate B and S-vs-L component vectors separately per rater under the preregistered mechanical-validity rules.
5. If either Gate A or Gate B binary disposition differs between primary raters, obtain a third blind evaluator in a third fresh lineage and apply only the preregistered 2-of-3 gate-level majority. S-vs-L disagreement alone does not trigger a third rater.
6. Apply the predeclared A/B decision matrix; no production adoption is automatic.
7. Only after fresh-gate reconciliation run A1/A2/A5/A6/A7 two-rater harm diagnostic with the same provider-cost monitoring.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as semantic gate set.
- Reranking-only architecture restricted to lexical candidates.
- Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- D-013 pricing unless materially different authenticated charged-cost telemetry appears.
- Frozen P0.5 retrieval/fusion/gate parameters in response to observed holdout results.
- Frozen holdout wording/domain/slice tags after retrieval began.
- Frozen evaluator-visible field set, randomized anonymous bundle, or mapping in response to labels/results.
- Locked primary-rater labels in response to agreement or gate results.
- Locked agreement diagnostic definitions in response to observed agreement values.

## Evaluation invariants

- Conjunctive-intent rule: R only if available evaluation evidence directly covers all essential explicitly stated components; one essential component only is M; indirect/topic-adjacent is N.
- Seen diagnostic data and fresh gate data remain physically/procedurally separated.
- Reviewer receives summary plus raw materials and may challenge implementer framing.
- Blind evaluator receives only the frozen public evaluation bundle/rubric; no mapping, prior labels, gate metrics, provider identity, or discussion history.
- Both primary raters receive the exact same frozen public bundle but operate in physically separate fresh lineages.
- Primary rater outputs are immutable once FINAL / LOCKED.
- Numeric rater metrics remain per-rater; only preregistered binary Gate A/B dispositions may use third-rater 2-of-3 rule.
- Inter-rater agreement diagnostics are descriptive only and do not create a new third-rater or exclusion trigger.
- Under D-017, a derived experimental artifact may become FROZEN/irreversible only after required upstream reviewer acceptance; parallel work before acceptance must remain explicitly PROVISIONAL.

## Privacy invariants

1. Never claim more evidence than actually seen.
2. Never expose a user's research interests to anyone other than that user.
3. Future institutional analytics, if implemented, use aggregate counters only; no queries, topics, or user IDs.
4. Cost/rate telemetry used for passive provider-price monitoring must not add stored query text or research-interest content.

## Canonical records

- Project decisions: `docs/decisions.md`
- Current operational state: `docs/current-state.md`
- Retrieval architecture: `docs/architecture/research-retrieval.md`
- P0.5 frozen preregistration: `docs/experiments/p05-hybrid-semantic.md`
- P0.5 frozen fresh holdout: `docs/experiments/p05-hybrid-semantic-holdout.md`
- P0.5 fresh retrieval execution record: `docs/experiments/p05-hybrid-semantic-retrieval.md`
- P0.5 frozen blind evaluator bundle record: `docs/experiments/p05-hybrid-semantic-evaluator-bundle.md`
- P0.5 pre-mapping rater agreement plan: `docs/experiments/p05-rater-agreement.md`
- P0.5 retrieval execution review: `docs/reviews/2026-09-10-p05-retrieval-execution-review.md`
- D-013 live reconciliation: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`
- Research privacy/evidence invariants: `docs/privacy/research-privacy.md`
- Reviewer packet completeness control: `docs/reviewer-packet-checklist.md`
- Governance red-team review: `docs/reviews/2026-09-10-governance-red-team.md`
- P0.5-A experiment history: `docs/experiments/p05a-lexical.md`

Last updated: 2026-09-10
