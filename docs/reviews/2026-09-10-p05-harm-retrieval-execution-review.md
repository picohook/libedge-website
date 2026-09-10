# P0.5 Harm-Regression Retrieval Execution Review — 2026-09-10

Status: `HISTORICAL`

## Scope

Independent mechanical review of the preregistered A1/A2/A5/A6/A7 harm-regression retrieval execution. This review does not assess relevance and does not create an adoption gate.

## Reviewed execution

- GitHub Actions run: `34520257298`
- Execution head: `e8d7e323800d8e5de47aad64c4af7d5b73df7cff`
- Raw artifact ID: `10169351909`
- Raw artifact ZIP SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- Canonical execution record: `docs/experiments/p05-harm-regression-retrieval.md`

## Reviewer verification level

`fresh contents/diff inspected`

The reviewer reported downloading and opening the complete six-file raw artifact, checking the artifact hash, comparing all five historical intent/retrieval-text pairs, inspecting all attempt records and telemetry, and independently reconstructing H top-10 for all five cases from the raw L/S pools under frozen RRF `k=60` plus deterministic tie-break.

## Independently verified findings

- ZIP SHA-256 matched exactly.
- Artifact contained exactly `summary.json` plus `A1.json`, `A2.json`, `A5.json`, `A6.json`, `A7.json`.
- Historical source/query identity matched for all five cases.
- Exactly 10 attempts = 5 L + 5 S; zero retries.
- L success 5/5, S success 5/5, H available 5/5; no retrieval failure.
- L pool depth 100 for all five; S pool depth 13–50, with A6=13 still above the frozen low-corpus threshold.
- No duplicate canonical identity inside the arm pools; provider ranks were sequential.
- Full independent H reconstruction produced zero mismatch across 5 cases × top-10 = 50 H results, including RRF, source ranks and order.
- Minimum semantic request-start spacing `2.640s`; pacing compliant.
- All 10 calls reported body/header cost `$0.001`, credits `10`, and no cost conflict.
- Cumulative experiment accounting correctly carried `80` prior calls / `$0.080` into this run and ended at `90` calls / `$0.090`, under global cap `120`.
- `pricingAnomalies` was empty.
- No evidence of relevance-driven intervention or rerun was found.

## OUT-OF-SCOPE findings

No new material OUT-OF-SCOPE finding was reported in this review.

The previously opened automatic-trigger cleanup follow-up remains separate and valid.

## Classification

`ACCEPTED`

Under D-017, the harm retrieval execution is accepted as a valid upstream artifact. A derived harm evaluator bundle may now be constructed provisionally and reviewed; no bundle may be delivered to blind raters until the exact reviewed bundle is promoted to FROZEN.

Last updated: 2026-09-10
