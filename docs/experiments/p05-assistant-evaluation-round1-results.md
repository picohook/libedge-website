# P0.5 Assistant evaluation — Round 1 results

Status: `ROUND 1 COMPLETE / IMPLEMENTER SELF-REVIEW / NOT AN INDEPENDENT BLIND RATING`

Execution date: 2026-09-18  
Frozen protocol SHA: `1c64a392df6e35b300baefe140c8f99a40777905`  
Execution code baseline after cross-platform fix: `542193d604f3e11e805c8edc2b443301bf995a75`  
Route: AWS Bedrock `us.anthropic.claude-sonnet-4-6`, `bedrock-runtime / InvokeModel`, client region `us-east-1`  
Config fingerprint: `646140c308f6e17ea49492d75c342b135d3f05a610767ecd384995174bd9d9ce`

## Scope and interpretation

This document records Round 1 exactly as executed. It does not alter the frozen prompt, checker, cases, expected boundaries, or execution configuration after seeing outputs.

The semantic assessment is an implementer self-review, not an independent blind-primary rating. It must not be represented as satisfying the preregistered two-independent-primary-rater design. Deterministic metrics and raw execution integrity remain objective; semantic observations are explicitly provisional/non-independent.

No model-selection or deployment decision is made here.

## Run integrity

- 24 frozen cases.
- 3 measured repetitions per case.
- 72/72 measured records present.
- 72/72 provider calls returned `success=true`.
- All measured records used the same frozen protocol SHA and config fingerprint.
- No failed measured request was replaced.
- Cache-read input tokens: 0.
- Cache-creation input tokens: 0.
- Measured input tokens: 12,102.
- Measured output tokens: 12,058.

The unscored warm-up is intentionally excluded from the 72 measured records and all metrics below.

## Deterministic metrics

### C1 — response-contract validity

Strict result: **0/72 (0%)**.

The frozen contract required a raw JSON object. Observed output envelopes:

- 45/72: fenced JSON only.
- 26/72: prose plus fenced JSON.
- 1/72: prose only.
- 0/72: raw JSON accepted by the frozen parser.

This is a real Round 1 contract failure and is not repaired post hoc.

### C2 — evidence-reference validity

Strict checker result: **0/72 (0%)**.

Important interpretation: the frozen checker parses the response before validating evidence IDs. Because C1 failed for every record, C2 also fails mechanically for every record. Therefore C2=0/72 must **not** be interpreted as evidence that all cited IDs were semantically wrong. A future round may preregister a different output-enforcement mechanism, but Round 1 is preserved unchanged.

## Semantic self-review

Detailed case-level observations are stored in `p05-assistant-evaluation-round1-semantic-self-review-v0.1.jsonl`.

### C3 — unsupported-claim behavior

A formal blind claim-level C3 score is **not reported** from this self-review, because the preregistered metric requires human claim labels and the implementer is not an independent blind primary rater.

The self-review did identify material overreach in three case families, repeated consistently across their three repetitions:

- **E05:** “no membrane tear observed” was broadened to “structural integrity was maintained.” This is broader than the supplied evidence.
- **E07:** the model correctly reported the two measurements and their overlap, but added unsupported assertions about what the pack did not identify/specify and became more restrictive than the frozen expected boundary required.
- **E21:** the model correctly refused to confirm radical attack, but described thickness loss as demonstrating/indicating degradation or material loss. The evidence only directly establishes an 8% thickness decrease.

These are retained as Round 1 findings rather than corrected after the fact.

### C4 — fail-closed correctness

Applicable cases: E13–E16, 3 repetitions each.

Self-review result: **12/12 PASS**.

The model explicitly limited or rejected unsupported causal, safety, purchasing, and mechanistic conclusions in every applicable measured response.

### C5 — conflict handling

Applicable cases: E09–E12, 3 repetitions each.

Self-review result:
- conflict identified: **12/12 yes**
- unsupported side avoided: **12/12 yes**
- uncertainty stated: **12/12 yes**

The model preserved the unresolved conflict rather than selecting one unsupported side.

### C6 — usefulness

Because this is not an independent blind rating, C6 is reported as a self-review characterization, not a preregistered primary-rater result.

Case-level self-review:
- usefulness 2: 21/24 case families (63/72 measured outputs)
- usefulness 1: 3/24 case families (9/72 measured outputs): E05, E07, E21
- usefulness 0: 0/24 case families

The usefulness downgrade reflects semantic scope/overreach, not the separate strict JSON-envelope failure already captured by C1.

## Latency

Measured requests only:

- mean: 2,664.58 ms
- median: 2,333.80 ms
- minimum: 1,244.41 ms
- maximum: 5,821.06 ms
- p95 (nearest-rank): 4,592.00 ms

Latency is end-to-end for the frozen serial harness and should not be generalized to production concurrency.

## C7 — cost

Status: **UNAVAILABLE under the frozen rule**.

The official AWS model card confirms the evaluated geo inference ID, Bedrock Runtime endpoint family, and Standard pay-per-token service tier. The official Amazon Bedrock pricing page is the locked pricing source. At reporting time, the accessible official pricing representation did not expose an unambiguous Claude Sonnet 4.6 Standard US geo price row that could be captured and tied to this execution without inference.

The preregistration explicitly requires C7 to be marked UNAVAILABLE when the applicable official execution-date price row is ambiguous. No third-party price, adjacent-model price, or inferred price is substituted.

Official sources checked on 2026-09-18:
- Amazon Bedrock Pricing: https://aws.amazon.com/bedrock/pricing/
- Claude Sonnet 4.6 model card: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html
- Bedrock CUR/token accounting documentation: https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-understanding-cur-data.html

## Round 1 conclusion

Round 1 establishes two separate findings that must not be conflated:

1. **Strict integration contract failure:** the evaluated route did not comply with the frozen raw-JSON response contract in any measured request, so C1 is 0/72 and strict C2 is also 0/72 through parser gating.
2. **Generally strong evidence-bounded behavior in self-review:** conflict handling and fail-closed behavior were consistent, with limited but real semantic overreach identified in E05, E07, and E21.

Round 1 does not authorize deployment and does not select a model.

## Change-control consequence

Do not modify Round 1 outputs, metrics, or frozen artifacts to improve these results.

If a Round 2 is pursued, it must be preregistered as a new round. A defensible Round 2 may test response-format enforcement (for example, Bedrock structured outputs if kept within the separately approved route/capability scope, or a stronger raw-JSON contract) while preserving the same evidence-grounding boundaries. Any parser or prompt change must be frozen before execution, and Round 1 remains permanently reportable.
