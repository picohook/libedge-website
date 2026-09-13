# P05 Assistant Orchestration Boundary — Reviewer Packet

Date: 2026-09-13
Branch: `feat/assistant-orchestration-boundary`
Base: `staging`

## Scope

Provider-independent orchestration only:

`Discover(query) -> ResearchWork[] -> EvidencePack -> model-adapter contract -> Structured Claims -> Grounding Validator`

No concrete LLM provider, endpoint, SDK, prompt template, or user-facing AI endpoint is introduced.

## Files

- `backend/src/research/assistant-orchestrator.js`
- `test/backend/assistant-orchestrator.test.js`
- this packet

## Invariants under review

1. Retrieval remains behind `Discover()`; orchestration does not call retrieval providers directly.
2. Raw research task cannot cross the model-adapter boundary unless `providerGate.status === "PASS"`.
3. Adapter receives only `{ task, evidencePack }` from this layer — no env, user, session, quota, or search-history context.
4. Adapter output must be structured claims, not unconstrained prose.
5. Grounding validation remains fail-closed; missing semantic support checking cannot produce an accepted result.
6. Partial grounding is not render-ready: if any claim is rejected, outward `claims` is `[]`.
7. Existing DISCOVER, EvidencePack, Grounding Validator, D-016/Track A-B, and privacy-closed 0047/0049 behavior is unchanged.

## Expected failure behavior

- Missing/blank task -> `ASSISTANT_QUERY_REQUIRED`
- DISCOVER exception -> `DISCOVER_FAILED`
- EvidencePack construction exception -> `EVIDENCE_PACK_FAILED`
- Provider Privacy Gate not PASS -> `PROVIDER_PRIVACY_GATE_REQUIRED`
- Missing model-adapter contract -> `MODEL_ADAPTER_REQUIRED`
- Adapter exception -> `MODEL_ADAPTER_FAILED`
- Non-structured adapter output -> `MODEL_OUTPUT_INVALID`
- Grounding validator exception -> `GROUNDING_VALIDATION_FAILED`
- Any rejected claim -> `GROUNDING_REJECTED` and outward `claims: []`

## Decision Boundary — not authorized

- No provider/model selection or integration.
- No Provider Privacy Gate relaxation or final Sonnet 4.6 PASS.
- No Bedrock/OpenAI/Anthropic SDK use.
- No concrete prompt construction/template.
- No user-facing AI response route.
- No logging of raw query/model payloads.
- No retrieval-policy, cache, fallback, telemetry, D-016/Track A-B change.
- No reopening 0047/0049.
- No production/go-live work.

## Reviewer task

Verify the orchestration contract preserves both P0 invariants at the code boundary: provider privacy before any model crossing, and evidence grounding before any render-ready claim. Confirm the adapter interface is genuinely provider-neutral, no hidden context crosses it, and partial grounding cannot leak accepted claims as render-ready output.
