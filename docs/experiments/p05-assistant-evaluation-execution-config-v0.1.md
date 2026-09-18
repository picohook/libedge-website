# P0.5 Assistant evaluation execution configuration v0.1

Status: `FROZEN CANDIDATE / SELF-REVIEW + CI REQUIRED BEFORE EXECUTION`

Frozen against staging base: `c0679e0b430c9f2e3efa96c66317bf70fd93c056`

Freeze date: 2026-09-18

## Admitted route

- provider/host: AWS Bedrock
- model: `anthropic.claude-sonnet-4-6`
- inference profile: `us.anthropic.claude-sonnet-4-6`
- client region / control-plane origin: `us-east-1`
- operation: `bedrock-runtime / InvokeModel`
- service tier: Standard / `default`
- effective retention: `none`
- prompt caching: baseline implicit caching; no explicit cache controls
- optional provider-side paths: disabled

The `us-east-1` client region matches the account-specific live-route evidence already recorded for this PASS route. The `us.` inference profile is geographic cross-region inference; this field does not assert a single physical destination region.

Execution must stop if the effective route/configuration differs from the reviewed PASS scope.

## Model instruction

Use only the supplied question and EvidencePack. Do not use or claim outside knowledge. Return JSON only in the frozen evaluation response shape. Every factual claim must cite one or more pack-local evidence IDs. If evidence is insufficient or materially conflicting, say so rather than resolving the gap by inference.

## Frozen inference controls

- AWS region: `us-east-1`
- `anthropic_version`: `bedrock-2023-05-31`
- max output tokens: `1024`
- temperature: `0`
- `top_p`: omitted
- `top_k`: omitted
- streaming: `false`; use `InvokeModel`, not `InvokeModelWithResponseStream`
- per-request client timeout: `60,000 ms`
- SDK/client: `@aws-sdk/client-bedrock-runtime@3.1135.0`
- request command: `InvokeModelCommand`
- tools: disabled / `tools` omitted
- measured retries: none at evaluation-harness level; SDK automatic retry behavior MUST be disabled by setting `maxAttempts: 1`
- explicit cache controls: none; no `cache_control` blocks
- concurrency: serial
- warm-up: 1 unscored request before measured sequence
- measured repetitions: 3 per case
- measured cases: 24
- reasoning/thinking beta: not enabled
- other Anthropic beta headers: none
- stop sequences: omitted

Rationale for `max_tokens=1024`: benchmark answers are intentionally short structured claim sets; this leaves substantial headroom while preventing unconstrained long output. AWS documents Sonnet 4.6 as supporting up to 64K output tokens, so this is an evaluation choice, not a model limit.

Rationale for `temperature=0`: reduce sampling variance while retaining the preregistered three measured repetitions. Only temperature is set; `top_p` and `top_k` are not co-tuned.

## Measurement record

For every measured request retain a machine-readable record containing:
- protocol git SHA
- execution timestamp
- case_id and opaque arm label
- repetition
- exact model/profile/region/operation
- configuration fingerprint
- success/failure
- end-to-end latency milliseconds
- provider request ID when available and privacy-safe
- input tokens
- output tokens
- cache-read/cache-write token fields when exposed
- calculated request cost
- pricing source identifier and checked date

A failed measured request remains a failure. It is not silently replaced. Because `maxAttempts: 1` is frozen, a measured request cannot be hidden by SDK retries.

Do not write question text, EvidencePack text, model output, user identifiers, or research-interest-bearing content to application telemetry. Evaluation artifacts containing synthetic benchmark prompts/outputs must remain outside application telemetry and be handled as experiment artifacts.

## Pricing source lock

Official pricing source:
- Amazon Bedrock Pricing: `https://aws.amazon.com/bedrock/pricing/`
- source checked: 2026-09-18
- currency/unit: USD per 1 million tokens
- inference class: Standard tier, US geographic cross-region inference for the frozen `us.` profile
- cache treatment: cost calculation must separately account for ordinary input, output, cache-write, and cache-read token fields when returned.

Sonnet 4.6 is an AWS Marketplace-billed third-party model. The model card directs pricing checks to the Amazon Bedrock Pricing page. Because AWS pricing is mutable, the harness must snapshot the exact applicable unit-price row immediately before the first measured request and store that snapshot identifier with the run. If the applicable pricing row cannot be unambiguously established for the frozen `us.` profile, cost metric C7 is marked `UNAVAILABLE` and execution may proceed for C1-C6; no inferred or neighboring-model price may be substituted.

The pricing snapshot is measurement provenance, not a configuration degree of freedom: it may not change route, tier, caching mode, or any inference control.

## Official technical evidence checked at freeze

AWS Sonnet 4.6 model card confirms:
- model ID `anthropic.claude-sonnet-4-6`;
- US geo inference ID `us.anthropic.claude-sonnet-4-6`;
- `bedrock-runtime` programmatic access;
- 64K maximum output;
- implicit and explicit prompt-caching support.

AWS Anthropic Messages request documentation confirms:
- `anthropic_version=bedrock-2023-05-31`;
- `max_tokens` is required;
- temperature range includes 0;
- `InvokeModel` is a supported operation.

AWS prompt-caching documentation confirms that caching can expose cache-read/cache-write usage and that cache behavior must be measured rather than assumed from eligibility alone.

## Execution authorization boundary

This candidate contains no `TO_FREEZE` values. That makes it reviewable as an exact execution configuration; it does **not** by itself authorize measured model calls.

Because the original independent reviewer is unavailable, the review record for this PR must explicitly state `IMPLEMENTER SELF-REVIEW + OBJECTIVE CI VERIFICATION`, not `independent review`.

Execution requires:
1. this exact freeze candidate to be merged after explicit user authorization;
2. CI success on the exact PR head;
3. a separate preflight that verifies account retention remains `none` and exact-route invocation remains available without recording benchmark content;
4. the execution harness to match every frozen field above.

Any change to a case, EvidencePack, expected boundary, rubric, model/profile, region, sampling control, retry behavior, caching mode, or measured-run count closes this round and requires a documented amended round.
