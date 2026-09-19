# P0.5 Assistant evaluation — Round 2 execution configuration v0.1

Status: `FROZEN CANDIDATE / INDEPENDENT REVIEW REQUIRED BEFORE EXECUTION`

Preregistration base: staging `eb4f6b8164b85c32fa0e5c06fb522fd1c4e30613` (PR #119 accepted and merged)  
Prepared: 2026-09-20

## Route and controls

All Round 1 controls remain fixed:
- AWS Bedrock
- `anthropic.claude-sonnet-4-6`
- inference profile `us.anthropic.claude-sonnet-4-6`
- client region `us-east-1`
- `bedrock-runtime / InvokeModel`
- retention must remain `none`
- Standard/default tier
- `anthropic_version=bedrock-2023-05-31`
- max output tokens 1024
- temperature 0; top_p/top_k omitted
- streaming false
- timeout 60,000 ms
- SDK `@aws-sdk/client-bedrock-runtime@3.1135.0`
- `InvokeModelCommand`
- tools disabled
- SDK `maxAttempts:1`; no harness retry
- no explicit cache controls
- serial execution
- one unscored benchmark warm-up
- 24 cases × 3 measured repetitions
- reasoning/thinking beta disabled; no Anthropic beta headers
- stop sequences omitted

## Sole intervention

Add the preregistered provider structured-output request field:
```json
"output_config": {
  "format": {
    "type": "json_schema",
    "schema": {
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
  }
}
```

No parser repair, markdown stripping, prose stripping, JSON extraction, coercion, fallback, or retry is allowed.

## Preflight

Before measured execution, after this candidate is merged:
1. verify account retention `none`;
2. verify exact inference profile ACTIVE/available;
3. invoke the exact route with this exact schema and a trivial synthetic non-benchmark prompt;
4. require a schema-conforming response;
5. record preflight latency separately.

If any item fails, stop. Do not fall back.

## Measurement

The existing Round 1 local `validateOutput` checker is unchanged. Each measured record retains protocol SHA, timestamp, case/repetition, exact route/config fingerprint, success, latency, request ID, token/cache usage, checker fields, and raw synthetic output.

The preflight and one benchmark warm-up are excluded from measured C1-C7. Preflight usage/cost may be reported separately.

Execution-date pricing must be snapshotted from the official Amazon Bedrock Pricing page immediately before the measured sequence. Do not assume Round 1 prices remain current.

## Authorization boundary

This freeze candidate authorizes no live request by itself. Measured execution requires:
- exact-head CI success;
- independent reviewer acceptance of this implementation/freeze PR;
- merge after explicit user approval;
- live preflight PASS;
- separate explicit user authorization for the measured run.

Any material change closes this candidate and requires amendment/re-review.
