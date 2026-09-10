# P0.5 Harm-Regression Retrieval Execution

Status: `HISTORICAL — RETRIEVAL EXECUTED / INDEPENDENTLY ACCEPTED`

## Scope

This record covers the preregistered seen harm-regression retrieval slice for cases A1, A2, A5, A6, A7 only. It is diagnostic and does not create an adoption gate.

The run uses the same parameterized retrieval/fusion implementation as the fresh 40-query experiment (`scripts/p05-hybrid-retrieval.mjs`) and mechanically selects the historical P0.5-A cases from `scripts/research-query-conditional.mjs`.

## Execution provenance

- Workflow: `.github/workflows/p05-harm-regression-retrieval.yml`
- GitHub Actions run: `34520257298`
- Run head: `e8d7e323800d8e5de47aad64c4af7d5b73df7cff`
- Raw artifact ID: `10169351909`
- Raw artifact ZIP SHA-256: `5d22038d5e0f215cde98d0d948168bfc028c6e84b851789c3ac4dd9666e8b933`
- Artifact contents: `summary.json` plus complete `A1.json`, `A2.json`, `A5.json`, `A6.json`, `A7.json` raw execution records.

## Frozen inputs actually executed

The executor selected the unchanged historical cases by ID and preserved both evaluator-facing intent and provider-facing historical query text:

| ID | Historical intent | Provider retrieval text |
|---|---|---|
| A1 | Research on remote learning and student engagement. | `remote learning student engagement` |
| A2 | Research on the digital divide in rural education. | `digital divide rural education` |
| A5 | Research on social capital and neighborhood health outcomes. | `social capital neighborhood health` |
| A6 | Research on policy incentives for green hydrogen. | `green hydrogen policy incentives` |
| A7 | Research on public acceptance of the energy transition. | `energy transition public acceptance` |

These rows are descriptive transcriptions only; the historical source file and raw artifact are authoritative.

## Mechanical execution audit

Implementer mechanical audit only; no relevance judgement was performed.

- Selected IDs: exactly `A1,A2,A5,A6,A7`.
- Provider attempts: exactly `10` = 5 L + 5 S.
- Retries: `0`.
- Successes: L `5/5`, S `5/5`, H mechanically available `5/5`.
- Retrieval failures: none.
- Current-run charged responses: `10`.
- Current-run observed cost: `$0.010`.
- Prior experiment usage carried forward: `80` calls / `$0.080`.
- Cumulative experiment usage after this run: `90` charged responses / `$0.090`.
- Frozen global call cap: `120`.
- Local attempt cap for this run: `40`.
- Pricing anomalies: none.
- Every recorded provider call reported request cost `$0.001`, body/header cost evidence agreed, and request credits `10`.
- Minimum observed spacing between semantic request starts: `2.640 s`; compliant with the frozen <=1 semantic request/second limit.
- L unique pools: 100 for all five cases.
- S unique pools by case: A1=49, A2=50, A5=49, A6=13, A7=45.
- H union sizes by case: A1=145, A2=150, A5=135, A6=111, A7=144.
- Independent implementer recomputation found no H union, RRF (`k=60`), rank-field, deterministic tie-break, or H-order mismatch in any of the five raw records.

## Independent review

Canonical review: `docs/reviews/2026-09-10-p05-harm-retrieval-execution-review.md`.

Classification: `ACCEPTED`.

The reviewer freshly inspected the complete raw artifact, verified the query/source identity and telemetry, and independently reconstructed all five H top-10 lists with zero mismatch. No execution correction was required.

## Interpretation boundary

This audit establishes only mechanical execution integrity. It does not assess relevance, harm, system superiority, or production suitability.

Under D-017, this upstream artifact is accepted. A derived evaluator bundle may be built and reviewed, but no provisional bundle may be delivered to blind raters until the exact reviewed bundle is promoted to FROZEN.

## Trigger cleanup follow-up

The trigger-only pre-execution reviewer identified an OUT-OF-SCOPE operational risk: path-scoped `push` triggers could fire again if provider-call workflow files were edited later.

Triage: `OPEN -> RESOLVED BY OPERATIONAL CLEANUP`.

After the accepted harm retrieval artifact was secured, automatic path-scoped `push` triggers were removed from both provider-call retrieval workflows:

- `.github/workflows/p05-harm-regression-retrieval.yml` — cleanup commit `2f56e4d523302fbb86ad5c1e305d8e1507202f32`
- `.github/workflows/p05-hybrid-retrieval.yml` — cleanup commit `63cdbdce28c57d96bb4b95825350389668fe0560`

Both now retain only `workflow_dispatch`, preventing future file edits from silently issuing provider calls. This cleanup did not modify the accepted retrieval artifact.

Last updated: 2026-09-10
