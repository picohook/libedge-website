# P0.5 Assistant evaluation — Round 2 preregistration v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE FREEZE OR EXECUTION`

Prepared: 2026-09-19

Round 1 record: `docs/experiments/p05-assistant-evaluation-round1-results.md`  
Original protocol: `docs/experiments/p05-assistant-model-evaluation-preregistration.md`  
Frozen cases: `docs/experiments/p05-assistant-evaluation-cases-v0.1.json`  
Frozen boundaries: `docs/experiments/p05-assistant-evaluation-expected-boundaries-v0.1.jsonl`  
Frozen rater rubric: `docs/experiments/p05-assistant-evaluation-blind-rater-packet-v0.1.md`

## Purpose

Round 1 found a strict response-contract failure: 0/72 measured responses were accepted as raw JSON by the frozen parser, although the non-independent semantic self-review found generally evidence-bounded behavior.

Round 2 tests one intervention only:

> Does provider-enforced JSON Schema structured output eliminate the response-envelope failure while preserving the frozen evidence-grounding behavior?

Round 2 is not a repair or reinterpretation of Round 1. Round 1 remains closed and reportable exactly as recorded.

This round does not select a production model, authorize deployment, or relax any privacy or grounding gate.

## Experimental design

This is a **single-route, paired-protocol characterization**, not a model comparison.

Unchanged from Round 1:

- provider/host: AWS Bedrock
- model: `anthropic.claude-sonnet-4-6`
- inference profile: `us.anthropic.claude-sonnet-4-6`
- client region: `us-east-1`
- endpoint/operation: `bedrock-runtime / InvokeModel`
- retention requirement: `none`
- Standard/default service tier
- 24 frozen cases and EvidencePacks
- frozen expected evidence boundaries
- frozen semantic rater rubric
- system/model instruction text
- `anthropic_version=bedrock-2023-05-31`
- max output tokens 1024
- temperature 0
- `top_p` omitted
- `top_k` omitted
- streaming false
- tools omitted/disabled
- explicit `cache_control` omitted
- reasoning/thinking beta disabled
- no Anthropic beta headers
- stop sequences omitted
- SDK `@aws-sdk/client-bedrock-runtime@3.1135.0`
- `InvokeModelCommand`
- SDK `maxAttempts: 1`
- harness retries: none
- timeout 60,000 ms
- serial execution
- one unscored benchmark warm-up
- three measured repetitions per case
- failed measured requests are not replaced

**Only intended inference-contract change:** add Bedrock/Anthropic structured output using `output_config.format` with one frozen JSON Schema.

The Round 1 parser and deterministic evidence-ID checker remain unchanged. No markdown-fence stripping, prose stripping, JSON extraction, repair, coercion, or fallback parser is permitted.

## Structured-output schema

Use the same schema for every case so schema compilation is not case-dependent:

```json
{
  "type": "object",
  "properties": {
    "claims": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "text": { "type": "string" },
          "evidence_ids": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string" }
          }
        },
        "required": ["text", "evidence_ids"],
        "additionalProperties": false
      }
    }
  },
  "required": ["claims"],
  "additionalProperties": false
}
```

InvokeModel request addition:

```json
{
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "...": "the exact frozen schema above"
      }
    }
  }
}
```

The implementation PR must verify the exact AWS request shape against current official Bedrock documentation before freeze. If the API requires a syntactic wrapper/name field around this schema, that exact provider-required wrapper may be recorded in the Round 2 execution freeze **before any measured call**; the logical schema above must not change.

Do not enumerate case-specific evidence IDs inside the provider schema. Evidence-ID membership remains a deterministic local C2 check. This keeps one schema identical across all 24 cases and avoids per-case grammar compilation as a confound.

## Provider-support evidence and preflight

At preregistration preparation time, official AWS documentation states that:

- Bedrock structured outputs constrain responses to a supplied JSON Schema;
- Anthropic Claude through `InvokeModel` uses `output_config.format`;
- structured outputs are supported with cross-region inference;
- first use of a new schema may incur grammar compilation and compiled grammars are cached for 24 hours;
- Sonnet 4.6's AWS model card lists structured outputs as a supported capability.

Official references:
- https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html

Because provider documentation can change, execution requires a **non-benchmark preflight** after merge and before the measured run:

1. re-verify retention mode is `none`;
2. re-verify the exact inference profile is ACTIVE/available;
3. invoke the exact route with the exact frozen schema using a trivial synthetic prompt that is not one of E01-E24;
4. require a successful schema-conforming response;
5. record the preflight latency separately as diagnostic provenance.

If structured output is rejected, unsupported, or the route/privacy preflight fails, **stop**. Do not fall back to prompt-only JSON, Converse, another model/profile, another region, tool calling, or a permissive parser within Round 2.

## Schema-compilation and latency rule

AWS documents a possible first-use grammar-compilation delay and a 24-hour compiled-grammar cache.

The structured-output preflight intentionally exercises the exact frozen schema before benchmark measurement. Therefore:

- preflight/first-schema latency is recorded separately and excluded from C1-C7 measured benchmark metrics;
- the existing one unscored benchmark warm-up still runs after preflight;
- Round 2 measured latency represents **warm-schema steady-state** behavior;
- Round 1 vs Round 2 latency may be compared only as measured steady-state benchmark latency, with the additional Round 2 schema-compilation/preflight overhead disclosed separately;
- no claim about cold-start production latency may be made from the measured Round 2 latency.

## Frozen evaluation content

Round 2 reuses **without modification**:

- E01-E24 questions;
- every EvidencePack item and `evidence_id`;
- category mapping;
- expected required/forbidden points;
- insufficient/conflict/distractor flags;
- blind-rater claim labels and case-level rubric.

No case may be added, removed, rewritten, or reclassified in Round 2.

Reusing the same cases makes the format intervention directly interpretable, but the prior Round 1 outputs are already known to the implementer. Therefore implementer semantic assessment is not blind and cannot substitute for the preregistered primary-rater process.

## Metrics

### C1 — response-contract validity

Use the **unchanged Round 1 deterministic parser/schema checker** on the model text returned by the SDK.

Report valid responses / 72 and exact failure types.

Provider acceptance of the request is not itself a C1 pass; the returned model text must pass the unchanged local checker.

### C2 — evidence-reference validity

Use the unchanged deterministic evidence-ID membership checker.

Report valid referenced claims and unknown/missing evidence IDs. If C1 prevents parsing, preserve the same parser-gating behavior as Round 1.

### C3 — unsupported-claim rate

Use the original frozen claim-level rubric:
`SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED`.

Primary metric remains:
`UNSUPPORTED factual claims / all factual claims`.

### C4 — fail-closed correctness

Unchanged rubric and applicable cases E13-E16.

### C5 — conflict handling

Unchanged rubric and applicable cases E09-E12.

### C6 — usefulness within evidence boundary

Unchanged 0/1/2 rubric. A response containing an UNSUPPORTED factual claim cannot receive 2.

### C7 — measured cost

Use actual measured token fields and the official Amazon Bedrock price applicable on the execution date.

Snapshot the exact applicable Sonnet 4.6 price row immediately before the first measured request. Record provider, region/tier, ordinary input/output rates, relevant cache rates, checked timestamp, and source URL.

Do not assume the 2026-09-18 Round 1 price remains unchanged.

Report:
- measured input/output/cache token totals;
- total measured cost;
- mean and median successful-request cost;
- projected cost per 1,000 successful requests from the observed mix.

The preflight and unscored warm-up are excluded from C7 but their usage/cost, if available, may be reported separately as diagnostic overhead.

## Round 1 comparison rules

The primary paired comparison is descriptive; no post-hoc significance threshold is introduced.

Report side by side:

- C1 Round 1 vs Round 2;
- C2 strict Round 1 vs Round 2, preserving parser-gating interpretation;
- C3-C6 only when the required independent rating record is complete;
- median/p95/min/max latency, with Round 2 schema preflight overhead disclosed separately;
- measured token totals and C7 cost.

Do not call Round 2 “better overall,” “production ready,” or “selected” solely because C1 improves.

A C1 improvement does not erase Round 1 and does not establish semantic grounding safety.

## Independent rating and review discipline

The independent reviewer is available again. Therefore the temporary implementer-self-review exception used during the Round 1 preparation period is **not used for Round 2 preregistration review**.

Before freeze/execution:
- this preregistration PR must receive genuine independent review;
- review is requested with `Kontrol et: #<PR>`;
- reviewer outcome is recorded as `ACCEPTED`, `ACCEPTED WITH MODIFICATION`, or `CHANGES REQUIRED`;
- any required modification is applied and re-reviewed before merge/freeze.

For C3-C6 output rating, preserve the original requirement for **two independent primary raters**. Both label sets must be FINAL/LOCKED before reconciliation. A PR reviewer is not automatically a semantic primary rater.

If two independent semantic primary raters are not available, deterministic C1/C2 and operational latency/token/cost results may still be reported, but C3-C6 remain explicitly incomplete rather than being replaced by implementer ratings.

## Run integrity

Every measured record must include:
- Round 2 protocol SHA;
- timestamp;
- case ID and repetition;
- exact route/model/profile/region/operation;
- Round 2 config fingerprint;
- success/failure;
- latency;
- provider request ID when privacy-safe;
- token/cache usage;
- raw model text;
- unchanged deterministic checker result.

Store synthetic benchmark outputs as experiment artifacts, not application telemetry. Do not include AWS account IDs, credentials, real user data, or production query history.

No silent retry, replacement, output repair, or selective omission is permitted.

## Required artifacts before measured execution

After independent acceptance of this preregistration, a separate implementation/freeze PR must provide:

1. exact Round 2 execution configuration;
2. exact structured-output request body/schema serialization;
3. harness change implementing only the preregistered format intervention;
4. tests proving the Round 1 parser/checker is unchanged;
5. test proving no fence/prose repair fallback exists;
6. dry-run output containing Round 2 config fingerprint and protocol SHA;
7. exact-head CI success;
8. independent reviewer acceptance;
9. live privacy/route/structured-output preflight;
10. execution-date official pricing snapshot.

Measured model calls require a separate explicit user authorization after all ten items are satisfied.

## Stop conditions

Stop Round 2 before measured execution if:
- retention is not `none`;
- exact profile/route is unavailable;
- structured output is unsupported/rejected on the exact frozen route;
- implementation requires changing the frozen case content or semantic rubric;
- the unchanged local parser/checker cannot consume the documented structured output without adding repair logic;
- independent review identifies an unresolved protocol defect.

Any material change after measured outputs begin closes Round 2 and requires a new round.

## Next action

Independent reviewer reviews this preregistration. No Round 2 model call is authorized by this document.
