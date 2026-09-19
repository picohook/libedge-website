# P0.5 Assistant evaluation — Round 2 audit summary v0.1

Status: `RESULTS RECORDED / C3-C6 PENDING INDEPENDENT AI RATING`

## Scope and provenance

Round 2 is a single-route paired-protocol characterization of the same admitted AWS Bedrock route used in Round 1. The sole intended inference-contract intervention was provider-enforced JSON Schema structured output. Round 1 remains closed and unchanged.

Measured execution protocol SHA: `bbe131075e2178d223d7ec11a5afbd84ba46516d`
Round 2 config fingerprint: `6f9556ebf835fdd139a24d88a75f31bee191b6f73d6d9a7e293630344dc2c92f`
Route: `us.anthropic.claude-sonnet-4-6`
Measured design: 24 frozen cases × 3 repetitions = 72 serial measured requests; no replacement of failures.

## Preflight

Immediately before measured execution:
- account data-retention mode: `none`
- exact inference profile: `ACTIVE`
- one trivial, synthetic, non-benchmark structured-output request succeeded
- preflight wall-clock: 4.9407079 s
- preflight usage: 314 input / 27 output tokens; cache read/write 0
- preflight latency and tokens are excluded from measured C1-C7
- preflight returned a schema-valid envelope but shortened the supplied evidence ID `PF:e1` to `e1`; this did not fail the provider-schema preflight because case-local evidence membership is intentionally a separate deterministic C2 check. No normalization or repair was added.

## Run integrity and deterministic metrics

- measured records: 72/72
- cases: 24/24
- repetitions: 3/3 per case
- successful measured API requests: 72/72
- protocol SHA: consistent across all measured records
- config fingerprint: consistent across all measured records
- model/profile ID: consistent across all measured records
- C1 response-contract/schema validity: **72/72 (100%)**
- C2 evidence-reference membership validity: **72/72 (100%)**
- unknown evidence IDs: 0
- claims without evidence IDs: 0
- parser repair, markdown-fence stripping, prose stripping, JSON extraction/coercion, fallback, or retry: none

Round 1 C1 remains 0/72. Round 2 does not reinterpret, repair, or overwrite any Round 1 output.

## Latency and usage

Measured requests only:
- mean latency: 2312 ms
- median latency: 2097 ms
- p95 latency: 3777 ms
- min latency: 1222 ms
- max latency: 7041 ms
- input tokens: 31,326
- output tokens: 9,255
- cache read: 0
- cache creation: 0

## C7 measured cost

Execution-date official AWS Bedrock pricing was snapshotted immediately before measured execution:
- Standard input: USD 3.00 / 1M tokens
- Standard output: USD 15.00 / 1M tokens
- 5-minute cache write: USD 3.75 / 1M tokens
- 1-hour cache write: USD 6.00 / 1M tokens
- cache read: USD 0.30 / 1M tokens

Measured calculation:
- input: 31,326 × 3 / 1,000,000 = USD 0.093978
- output: 9,255 × 15 / 1,000,000 = USD 0.138825
- total: **USD 0.232803**
- mean measured cost/request: USD 0.003233375

Preflight is excluded.

## C3-C6 status

C3-C6 are **PENDING INDEPENDENT AI RATING**. No implementer semantic diagnostic is promoted into the formal result.

Planned primary raters:
- Primary Rater 1: isolated ChatGPT conversation
- Primary Rater 2: isolated Claude conversation

They must receive the same frozen evaluator material and anonymized outputs, must not see one another's labels before locking, and must mark their packets `FINAL / LOCKED`.

These are independent AI raters, not human raters. Model diversity is used to reduce same-model correlated-error risk, but does not make the ratings equivalent to two independent human experts.

Blinding is best-effort: provider/model identifiers, Round 1/Round 2 labels, deterministic aggregate results, and comparison outcomes are withheld from the primary raters, but stylistic identification by an AI rater cannot be fully excluded.

The PR/audit reviewer is not a semantic primary rater.

If two usable locked primary packets are not obtained, C3-C6 remain explicitly incomplete; C1/C2/latency/usage/C7 remain reportable.

## Interpretation boundary

The deterministic result supports only this Round 2 protocol characterization: under the frozen structured-output intervention, all 72 measured responses satisfied the unchanged strict local response-contract parser and all cited evidence IDs passed the unchanged case-local membership check.

It is not a model-selection, deployment, production-adoption, legal/compliance, or general provider-safety conclusion.
