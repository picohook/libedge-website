# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Fresh retrieval COMPLETE / mechanically ACCEPTED; both primary blind-rater label sets FINAL / LOCKED; pre-mapping agreement diagnostic COMPLETE; mapping legitimately OPENED; seed commitment VERIFIED; fresh-gate result computed as RATER-ROBUST and PENDING INDEPENDENT REVIEW before the harm-regression slice.

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
- Fresh blind evaluator bundle construction — CLOSED / FROZEN 2026-09-10 before any relevance labels. Public bundle SHA-256 `a39f172b249dd8fd1b1b97598257fb936a81e3da40e77bc21af9609373330624`; private mapping was sealed until both primary raters locked. Canonical freeze record: `docs/experiments/p05-hybrid-semantic-evaluator-bundle.md`.
- Evaluator-bundle structural review — CLOSED / ACCEPTED. Reviewer found no blocker to delivering the existing frozen bundle to the two independent blind raters. Sequencing defect was prospectively closed by D-017.
- Primary Blind Rater 1 — CLOSED / FINAL / LOCKED; 1,200/1,200 labels completed under the frozen public bundle.
- Primary Blind Rater 2 — CLOSED / FINAL / LOCKED; 1,200/1,200 labels completed under the same frozen public bundle.
- Pre-mapping inter-rater agreement plan — LOCKED before agreement computation. Canonical: `docs/experiments/p05-rater-agreement.md`.
- Pre-mapping inter-rater agreement diagnostic — CLOSED / independently reproduced: exact agreement `747/1200 = 62.25%`; adjacent disagreement `446/1200 = 37.17%`; extreme R<->N disagreement `7/1200 = 0.58%`. Diagnostic only; no protocol action triggered.
- Private mapping opening — CLOSED / legitimate after both primary label sets were locked.
- Randomization seed commitment verification — CLOSED / MATCH. Revealed seed SHA-256 equals precommit `388813fddbb0d2519baafa62cbc28af7e82f3a0cd665314c61ed4c1ddf801bd1`.
- Fresh Gate A/B computation — COMPUTED / RATER-ROBUST: both raters Gate A PASS and Gate B FAIL. Third-rater trigger NOT TRIGGERED. Canonical evaluation record: `docs/experiments/p05-hybrid-semantic-evaluation.md`.

## ACTIVE

- Frozen holdout remains exactly 40 unseen intents: 10 Materials/Energy, 10 Biomedical, 10 Social Science, 10 Humanities; slices remain conjunctive 17, lexical ambiguity 15, technical/jargon 16.
- Candidate architecture under test remains:
  - L: OpenAlex lexical top-100 baseline.
  - S: OpenAlex semantic top-50 retrieval.
  - H: L/S union -> canonical deduplication -> RRF `k=60` -> deterministic tie-break -> top 10.
- Fresh retrieval raw artifact remains frozen at run `34498804224`, artifact `10161068719`, SHA-256 `79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8`.
- Frozen public evaluator bundle: run `34499706628`, artifact `10161315961`, bundle SHA-256 `a39f172b249dd8fd1b1b97598257fb936a81e3da40e77bc21af9609373330624`.
- Mapping artifact `10161316449`, mapping-file SHA-256 `defd6b39361dff452a826966769b680254d2bc43924143a52cfe2af7ed0b6b0c`, is now legitimately OPEN. Revealed seed: `41cd61e3f6fd6cef1a58422e95585f1e1493f692d2308b7fc3d31169680dc34d`; commitment verification MATCH.
- Rater 1 Gate A H-v-L: PASS; mean `+16.25pp`, non-worse `40/40`, strong `16/40`, all domain/single-query/slice/coverage components pass.
- Rater 2 Gate A H-v-L: PASS; mean `+17.75pp`, non-worse `34/40`, strong `25/40`, all domain/single-query/slice/coverage components pass.
- Rater 1 Gate B H-v-S: FAIL; mean `-10.50pp`, non-worse `14/40`, with multiple domain, single-query and slice failures; coverage component passes.
- Rater 2 Gate B H-v-S: FAIL; mean `-7.50pp`, non-worse `16/40`, with multiple domain, single-query and slice failures; coverage component passes.
- Binary gate outcome is RATER-ROBUST: `Gate A PASS / Gate B FAIL`; no third rater is permitted/required.
- Predeclared matrix therefore yields `H REJECTED`: H improves L but is inferior to simpler S. This does not automatically adopt S.
- S-v-L diagnostic is strongly positive on relevance for both raters: Rater 1 mean `+26.75pp`; Rater 2 mean `+25.25pp`. Frozen-rule coverage regression remains `40/40`, structurally induced by L=100 / S<=50 depth asymmetry and must always be reported with that caveat.
- Fresh-gate mapping/seed/component calculations are `PENDING INDEPENDENT REVIEW` under D-017 before starting the next irreversible derived stage.
- Reviewer OOS-01 remains `ACKNOWLEDGED / DEFERRED`: DOI/title dedup fallback branches were not exercised by this OpenAlex-native artifact.
- Reviewer OOS-02 remains `ACKNOWLEDGED / DEFERRED`: S-vs-L coverage regression `40/40` is structurally induced by the frozen depth asymmetry and is not a standalone relevance conclusion.
- Bundle-review overlap limitation remains `ACKNOWLEDGED / DEFERRED` for future experiment design.
- P0.5 economic assumption remains `$0.001 / provider call`; fresh retrieval consumed `$0.080`. Later 5-query harm slice still requires 10 base provider calls. Global cap remains 120 charged calls / `$0.120`.
- Passive charged-cost/credit monitoring remains ACTIVE for the later harm slice.
- Production semantic/hybrid retrieval remains NOT ADOPTED. D-016 remains PROPOSED pending completion of the frozen experiment and a separate production-architecture decision.

## NEXT

1. Independent reviewer must verify the opened mapping artifact, mapping-file hash, revealed seed commitment, and all per-rater Gate A / Gate B / S-vs-L component vectors in `docs/experiments/p05-hybrid-semantic-evaluation.md` from the locked rater outputs and frozen holdout/protocol.
2. Reviewer must classify the evaluation calculation using canonical reviewer categories and return any material OUT-OF-SCOPE findings for explicit triage.
3. If the mapping/seed/gate computation is ACCEPTED or ACCEPTED WITH MODIFICATION without invalidating the frozen inputs, record the review outcome.
4. Only then, under D-017, execute the preregistered A1/A2/A5/A6/A7 harm-regression slice using its own two-rater blind protocol and passive cost monitoring.
5. After harm diagnostic completion, record final experiment outcome and make a separate production-architecture decision; no production adoption is automatic.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as semantic gate set.
- Reranking-only architecture restricted to lexical candidates.
- Vectorize before evidence shows OpenAlex semantic/hybrid retrieval is insufficient.
- D-013 pricing unless materially different authenticated charged-cost telemetry appears.
- Frozen P0.5 retrieval/fusion/gate parameters in response to observed holdout results.
- Frozen holdout wording/domain/slice tags after retrieval began.
- Frozen evaluator-visible field set or randomized public bundle in response to labels/results.
- Locked primary-rater labels in response to agreement or gate results.
- Locked agreement diagnostic definitions in response to observed agreement values.

## Evaluation invariants

- Conjunctive-intent rule: R only if available evaluation evidence directly covers all essential explicitly stated components; one essential component only is M; indirect/topic-adjacent is N.
- Seen diagnostic data and fresh gate data remain physically/procedurally separated.
- Reviewer receives summary plus raw materials and may challenge implementer framing.
- Blind evaluator receives only the frozen public evaluation bundle/rubric; no mapping, prior labels, gate metrics, provider identity, or discussion history.
- Primary rater outputs are immutable once FINAL / LOCKED.
- Gate A, Gate B and S-v-L component vectors remain per-rater; labels are never averaged or reconciled.
- A third rater is triggered only by disagreement in binary Gate A or Gate B disposition. No such disagreement occurred here.
- Inter-rater agreement diagnostics are descriptive only and created no exclusion/relabel/third-rater action.
- Under D-017, the harm-regression stage may not begin until the current mapping/seed/gate computation receives required upstream reviewer acceptance.

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
- P0.5 rater agreement plan/results: `docs/experiments/p05-rater-agreement.md`
- P0.5 fresh-gate mapping/evaluation: `docs/experiments/p05-hybrid-semantic-evaluation.md`
- P0.5 retrieval execution review: `docs/reviews/2026-09-10-p05-retrieval-execution-review.md`
- D-013 live reconciliation: `docs/reviews/2026-09-10-d013-pricing-reconciliation.md`
- Research privacy/evidence invariants: `docs/privacy/research-privacy.md`
- Reviewer packet completeness control: `docs/reviewer-packet-checklist.md`
- Governance red-team review: `docs/reviews/2026-09-10-governance-red-team.md`
- P0.5-A experiment history: `docs/experiments/p05a-lexical.md`

Last updated: 2026-09-10
