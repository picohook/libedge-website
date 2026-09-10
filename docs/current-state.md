# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads may propose changes, but they do not modify project state directly.

## Current phase

P0.5 — Fresh gate CLOSED / independently ACCEPTED; harm retrieval CLOSED / independently ACCEPTED; exact harm evaluator artifact pair independently structurally ACCEPTED and governance-promoted to `FROZEN`; ready for two new primary blind-rater lineages. Private harm mapping/seed remain SEALED.

## CLOSED

- P0 Academic Metadata Gateway — CLOSED.
- P0 metadata/plumbing validation — CLOSED; plumbing GREEN, lexical relevance YELLOW.
- Global selective-phrase rewrite A/B — CLOSED / REJECTED.
- P0.5-A conditional lexical feasibility — CLOSED / FAIL.
- P0.5-A rater reconciliation — CLOSED; rater-definition robust A2 FAIL / B FAIL.
- Lexical top-100 depth diagnostic — CLOSED.
- Semantic-vs-lexical gap diagnostic — CLOSED; material retrieval-level recall gap found.
- Governance red-team review 2026-09-10 — CLOSED; findings triaged and control-plane corrections applied.
- P0.5 Hybrid Semantic Retrieval preregistration — FROZEN before fresh gate holdout generation.
- Fresh 40-query holdout — FROZEN before retrieval.
- Fresh 40-query L/S retrieval — CLOSED / EXECUTED: 80 calls, no retries/failures, `$0.080`; H mechanically available 40/40.
- Fresh retrieval mechanical audit — CLOSED / independently ACCEPTED. Canonical review: `docs/reviews/2026-09-10-p05-retrieval-execution-review.md`.
- Fresh public evaluator bundle — FROZEN; two independent primary blind-rater label sets FINAL / LOCKED.
- Pre-mapping agreement diagnostic — CLOSED: exact `747/1200 = 62.25%`, adjacent `446/1200 = 37.17%`, extreme R<->N `7/1200 = 0.58%`; diagnostic only.
- Fresh mapping opening and seed commitment verification — CLOSED / MATCH.
- Fresh Gate A/B calculation — CLOSED / independently ACCEPTED: both raters Gate A PASS, Gate B FAIL; third-rater trigger NOT TRIGGERED; predeclared matrix yields `H REJECTED`. Canonical review: `docs/reviews/2026-09-10-p05-fresh-gate-review.md`.
- Harm retrieval pre-execution code/workflow review — CLOSED / ACCEPTED.
- Harm retrieval trigger-only pre-execution review — CLOSED / ACCEPTED.
- A1/A2/A5/A6/A7 harm retrieval — CLOSED / EXECUTED: run `34520257298`, 10 calls = 5 L + 5 S, zero retries/failures, `$0.010`; cumulative experiment usage `90/120` calls / `$0.090`.
- Harm retrieval mechanical review — CLOSED / ACCEPTED. Reviewer freshly inspected the complete six-file artifact and independently reconstructed all 5 H top-10 lists with zero mismatch. Canonical review: `docs/reviews/2026-09-10-p05-harm-retrieval-execution-review.md`.
- Harm evaluator bundle provisional construction — CLOSED: run `34521366508`, exact public/private artifact pair produced without blind-rater delivery.
- Harm evaluator bundle structural/leakage review — CLOSED / ACCEPTED. Reviewer independently verified hashes, retrieval provenance, 5×3×10 structure, mapping bijection/permutations, frozen field set, all 150 mapped projections, historical intents, and absence of structural retrieval metadata leakage. Canonical review: `docs/reviews/2026-09-10-p05-harm-evaluator-bundle-review.md`.
- Harm evaluator bundle freeze promotion — CLOSED: governance-only promotion of the exact reviewed artifact bytes; no rebuild/rerandomization/seed regeneration occurred. Canonical: `docs/experiments/p05-harm-evaluator-bundle.md`.
- Automatic provider-call trigger cleanup — CLOSED. Temporary path-scoped `push` triggers were removed from both provider-call retrieval workflows; both now retain only `workflow_dispatch`.

## ACTIVE

### Fresh-gate result

- Rater 1 Gate A H-v-L: PASS; mean `+16.25pp`.
- Rater 2 Gate A H-v-L: PASS; mean `+17.75pp`.
- Rater 1 Gate B H-v-S: FAIL; mean `-10.50pp`.
- Rater 2 Gate B H-v-S: FAIL; mean `-7.50pp`.
- Binary outcome is RATER-ROBUST: `Gate A PASS / Gate B FAIL`; H is rejected by the predeclared matrix.
- S-v-L relevance diagnostic is positive for both raters (`+26.75pp`, `+25.25pp`) but frozen-rule coverage regression remains `40/40` because L=100 / S<=50 depth asymmetry; this statistic must never be presented without that caveat.
- No production architecture is adopted automatically; D-016 remains PROPOSED pending full experiment completion and a separate architecture decision.

### Harm retrieval artifact

- Run: `34520257298`
- Artifact ID: `10169351909`
- Artifact ZIP SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- Cases: exactly A1, A2, A5, A6, A7.
- L success 5/5, S success 5/5, H available 5/5; no retries/failures.
- Cost: `$0.010`; cumulative experiment total `$0.090`, 90/120 charged calls.
- Canonical execution record: `docs/experiments/p05-harm-regression-retrieval.md`.

### Harm evaluator bundle — FROZEN

- Canonical record: `docs/experiments/p05-harm-evaluator-bundle.md`.
- Structural review: `docs/reviews/2026-09-10-p05-harm-evaluator-bundle-review.md` — `ACCEPTED`.
- Shared builder: `scripts/p05-build-evaluator-bundle.mjs`; builder parameterization commit `14f60e4cf8c26f460ab5437ede76ea8f8fd139fd`.
- Build run/head: `34521366508` @ `2886d279f9659f9adf72ad0d39d1c25950605356`.
- FROZEN public artifact ID `10169773484`; artifact ZIP SHA-256 `63b0250c49fadb633d403cfb547f6ec2f0a92157265eebd34ca0f68dc9f706a4`; bundle-file SHA-256 `8f4fc6b73ab10eadc9f8a2710dd4708af4b41f96ddda2eed22cd568e14aea038`.
- SEALED private mapping artifact ID `10169774220`; artifact ZIP SHA-256 `26a76e571492326a893a9cf7606e596579e2b63c8fa8ff0c31ea872f4cd34e40`; mapping-file SHA-256 `b631edb52b79ba2f48a4a8199521a5db2f9f412be9f9a03b84264f00058f3a14`.
- Seed commitment SHA-256 `3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`; seed remains sealed with private mapping.
- Bundle version `p05-harm-evaluator-v1`; exact structure: 5 anonymous queries × 3 A/B/C lists × 10 results = 150 records.
- The artifact-internal manifest still contains its construction-time `PROVISIONAL` / `PROHIBITED UNTIL PROMOTED TO FROZEN` fields because byte-preserving promotion was required. That promotion condition is now satisfied by the accepted structural review plus the canonical governance record; the artifact itself was not rewritten.
- The same exact public bundle must be supplied to both harm primary blind raters. Private mapping/seed MUST remain sealed until both harm label sets are FINAL / LOCKED.

### Deferred/known limitations

- DOI/title dedup fallback branches remain `ACKNOWLEDGED / DEFERRED`; revisit before OpenAlex-external or ID-less ingestion depends on fallback identity behavior.
- H may be structurally inferable from cross-list overlap; remains an acknowledged evaluation-design limitation.
- Node/action deprecation warnings observed in Actions logs are operational maintenance signals, not experiment-result defects; revisit during workflow maintenance.

## NEXT

1. Deliver the exact FROZEN harm public bundle to **Primary Blind Rater 1 (harm)** in a fresh, physically separate context lineage with only the minimal role instruction plus the embedded bundle rubric/instructions.
2. Deliver the exact same FROZEN public bundle to **Primary Blind Rater 2 (harm)** in a different fresh context lineage. Neither rater receives private mapping, seed, reviewer history, fresh-gate results, previous rater labels, current-state/decisions files, or implementation discussion.
3. Collect and lock both complete harm label sets before opening the private mapping.
4. Only after both harm primary label sets are FINAL / LOCKED, open the private mapping, reveal the seed, verify SHA-256 against commitment `3b2add532142ba50eead979609f6b1620d89e5cd6d675993e9db4e3aea5e3003`, and compute the preregistered harm diagnostic separately per rater.
5. Harm is diagnostic only: no automatic adoption gate and no third-rater trigger arises from harm disagreement unless explicitly defined by the already-frozen parent protocol.
6. After harm diagnostic completion and independent mechanical review, close the full P0.5 experiment and make a separate production-architecture decision. No production adoption is automatic.

## DO NOT REOPEN WITHOUT NEW EVIDENCE

- Global phrase rewriting as a production relevance fix.
- Conditional lexical phrase heuristic as a production relevance fix.
- Existing 30-query P0.5-A benchmark as semantic fresh-gate set.
- Reranking-only architecture restricted to lexical candidates.
- Frozen P0.5 retrieval/fusion/gate parameters in response to observed results.
- Frozen fresh holdout wording/domain/slice tags.
- Locked primary-rater labels or agreement definitions.
- Exact FROZEN harm public/private artifact bytes in response to rater labels or harm results.

## Evaluation invariants

- Conjunctive-intent rule: R only if available evaluation evidence directly covers all essential explicitly stated components; one essential component only is M; indirect/topic-adjacent is N.
- Reviewer receives summary plus raw materials and may challenge implementer framing.
- Blind evaluator receives only the frozen public bundle/rubric plus minimal role instruction; no mapping, prior labels, gate metrics, provider identity, reviewer history, or implementation discussion.
- Primary rater outputs are immutable once FINAL / LOCKED.
- Fresh Gate A, Gate B and S-v-L vectors remain per-rater; labels are never averaged/reconciled.
- Harm slice is diagnostic only and creates no automatic adoption gate.
- Under D-017, derived artifacts may become FROZEN/irreversible only after required upstream review; the harm bundle followed `retrieval ACCEPTED -> PROVISIONAL build -> structural ACCEPTED -> FROZEN promotion`.

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
- Fresh retrieval: `docs/experiments/p05-hybrid-semantic-retrieval.md`
- Fresh bundle: `docs/experiments/p05-hybrid-semantic-evaluator-bundle.md`
- Fresh agreement: `docs/experiments/p05-rater-agreement.md`
- Fresh evaluation: `docs/experiments/p05-hybrid-semantic-evaluation.md`
- Fresh-gate review: `docs/reviews/2026-09-10-p05-fresh-gate-review.md`
- Harm retrieval: `docs/experiments/p05-harm-regression-retrieval.md`
- Harm retrieval review: `docs/reviews/2026-09-10-p05-harm-retrieval-execution-review.md`
- Harm evaluator bundle: `docs/experiments/p05-harm-evaluator-bundle.md`
- Harm bundle review: `docs/reviews/2026-09-10-p05-harm-evaluator-bundle-review.md`
- Reviewer packet completeness control: `docs/reviewer-packet-checklist.md`
- Research privacy/evidence invariants: `docs/privacy/research-privacy.md`

Last updated: 2026-09-10
