# P0.5 — Claude Sonnet 4.6 AWS implicit-caching final evidence

Status: `REVIEW EVIDENCE / FINAL PASS NOT YET GRANTED`

Recorded: 2026-09-16

Parent canonical gate: `docs/architecture/p05-provider-privacy-gate.md`  
Prior final-check record: `docs/architecture/p05-provider-privacy-gate-sonnet46-final-checks.md`

## Scope

This record captures the written AWS Support response received after the escalation documented in the prior final-check record. It addresses the sole remaining final-confirmation question for the reviewed Claude Sonnet 4.6 route: the interaction between Bedrock implicit prompt caching and effective data-retention mode `none`.

This record is intentionally evidence-first. It does **not** itself promote the route to final `PASS`, select a model, or authorize implementation. Final gate classification remains a separate reviewer action after this evidence is reviewed and reconciled into the canonical gate.

Reviewed route:

- model: `anthropic.claude-sonnet-4-6`;
- route: Amazon Bedrock `bedrock-runtime` / `InvokeModel`;
- inference profile: `us.anthropic.claude-sonnet-4-6`;
- effective data-retention mode: `none`;
- implicit prompt caching, with no explicit cache controls supplied.

## 1. AWS Support escalation response — 2026-09-16

AWS Support stated that the response was prepared after consultation with Bedrock subject-matter experts and answered the four questions raised in the prior escalation.

The response states, in substance:

1. **Post-request cache lifetime:** implicit prompt-cache/KV state may remain available after completion of an inference request, but only on a TTL basis. AWS states a 5-minute default TTL for Claude models and states that the TTL resets on a cache hit before expiring.
2. **Relationship to prompt content:** the cache stores computed KV state derived from the cached prompt prefix and therefore represents customer prompt content, while not being the raw prompt text itself.
3. **ZDR classification:** AWS states that this ephemeral, in-memory cache does **not** count as retained Customer Data under its interpretation of the Zero Data Retention guarantee. AWS describes ZDR `none` as preventing request/response data from being written to durable storage or shared with the model provider, and describes the cache as an ephemeral infrastructure optimization rather than persistent retention.
4. **Isolation:** AWS states that the cache remains within the customer's AWS account boundary, is isolated from other customers, and is not shared with Anthropic. The response further states that Anthropic does not receive Bedrock inference inputs or outputs.

AWS's summary was that Claude Sonnet 4.6 under Bedrock data-retention mode `none` remains compatible with ZDR while implicit prompt caching operates as temporary, account-isolated, in-memory state that is not written to durable storage.

### Evidence classification

This is **AWS Support case correspondence after Bedrock SME consultation**. It is stronger and more route-specific than the previously reviewed public documentation because it directly answers the four questions posed for the exact unresolved cache/ZDR interaction.

It is **not** represented here as a formal legal opinion, contractual amendment, or standalone compliance attestation. The record preserves that distinction explicitly.

## 2. Public-document corroboration

### 2.1 AWS Bedrock prompt-caching documentation

The current AWS Bedrock prompt-caching documentation independently corroborates the technical caching mechanics relevant to the support response:

- Bedrock supports both implicit and explicit prompt caching for supported Anthropic models.
- Implicit caching can reuse eligible prompt prefixes without cache controls in the request.
- Cache TTL resets on successful cache hits.
- Claude Sonnet 4.6 is listed with 5-minute and 1-hour supported TTLs for explicit caching, and AWS documents 5 minutes as the default behavior when no TTL is specified for the relevant Claude caching flow.

Source:

- https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html

### 2.2 Anthropic prompt-caching documentation

Anthropic's current prompt-caching documentation independently corroborates the general implementation/privacy characteristics of Claude prompt caching:

- prompt caching is described as ZDR eligible;
- raw prompt text and responses are not stored for prompt caching;
- KV cache representations and cryptographic hashes are held in memory and not stored at rest;
- standard cached entries have a minimum lifetime of 5 minutes before expiration/deletion behavior applies.

Source:

- https://platform.claude.com/docs/en/build-with-claude/prompt-caching

### Corroboration boundary

Anthropic's public documentation is used here as **technical corroboration**, not as the authority for the Bedrock account-boundary or Bedrock contractual interpretation. The prior support-channel clarification established that AWS is the relevant processor/authority for the Bedrock deployment path. The Bedrock-specific conclusions about effective mode `none`, account isolation, and provider access therefore rest on the AWS Support/Bedrock-SME response, with public documentation serving as independent consistency evidence.

## 3. Reconciliation against the prior blocker

The prior final-check record narrowed the sole remaining question to whether, under effective Bedrock retention mode `none`, implicit prompt-cache state for the exact Sonnet 4.6 `bedrock-runtime` route is covered by the ZDR guarantee / otherwise remains within the permitted privacy boundary.

The 2026-09-16 AWS response directly addresses that question rather than requiring an inference from the words "ephemeral" or "durable storage":

- cache state may exist briefly after a request;
- it represents prompt-derived content;
- AWS nevertheless states that it is not retained Customer Data for purposes of the ZDR guarantee;
- it is in-memory, non-durable, account-isolated, and not shared with Anthropic.

This is the exact type of provider-specific written clarification required by the prior `Final confirmation trigger`.

## 4. Reviewer decision point

On the evidence now recorded, the previously open caching/ZDR factual question has a direct AWS answer and the evidence package supports **review for promotion from `PASS CANDIDATE` to final `PASS`** for the exact reviewed route.

No promotion is performed by this evidence record itself. The reviewer should independently verify:

1. that the AWS correspondence is accurately represented here;
2. that the route/account assumptions remain unchanged from the prior live-evidence and final-check records;
3. that the canonical parent gate is updated consistently if final `PASS` is granted;
4. that any later provider/model/route/retention-mode change re-triggers the privacy gate.

## 5. Scope that remains unchanged

Even if the reviewer grants final `PASS`, that verdict would apply only to the reviewed baseline route and would not silently authorize optional Bedrock features previously excluded from scope, including Agents, Knowledge Bases, Prompt Management, Computer Use, server-side tools, or other storage/orchestration features. Explicit prompt caching also remains outside the baseline architecture unless separately authorized; the present evidence resolves the unavoidable **implicit** caching question for the reviewed route.

## Evidence summary

`NEW EVIDENCE — REVIEW REQUIRED`

The 2026-09-16 AWS Support / Bedrock-SME response supplies the authoritative written clarification requested by the prior gate record. Public AWS and Anthropic documentation independently corroborate the principal technical cache properties. The evidence supports a reviewer decision on final `PASS`; it does not self-grant that decision.
