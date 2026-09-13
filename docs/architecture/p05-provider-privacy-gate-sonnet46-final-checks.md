# P0.5 — Claude Sonnet 4.6 final privacy checks

Status: `REVIEW CANDIDATE / FINAL PASS NOT YET GRANTED`

Checked: 2026-09-13

Parent canonical gate: `docs/architecture/p05-provider-privacy-gate.md`
Prior live-route evidence: `docs/architecture/p05-provider-privacy-gate-sonnet46-live-evidence.md`

## Scope

This record closes the two follow-up checks identified after the Sonnet 4.6 live-route evidence review:

1. geographic routing / residency behavior for the exact `us.anthropic.claude-sonnet-4-6` inference profile;
2. whether optional Bedrock features create a distinct retention path that prevents final privacy-gate PASS.

It does not select a model or authorize implementation.

## 1. Geographic routing / residency

Official AWS Sonnet 4.6 model-card evidence shows that `us.anthropic.claude-sonnet-4-6` is a **US geographic cross-Region inference profile**, not a single-Region route.

For source region `us-east-1`, AWS documents the possible destination regions as:

- `us-east-1` (N. Virginia)
- `us-east-2` (Ohio)
- `us-west-2` (Oregon)

AWS separately documents that geographic cross-Region profiles remain within the named geography and are intended for data-residency requirements. A `us.` profile therefore may route among the documented US destination regions, but not to EU/APAC regions. This is materially different from a `global.` inference profile, which may route across commercial AWS regions worldwide.

Official sources:

- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html

### Residency conclusion

`RESOLVED FOR THE REVIEWED ROUTE` — the reviewed route is US-geo, not single-region. The architecture/gate record must describe residency as **US-only cross-Region processing across AWS-documented destination regions**, not as `us-east-1`-only processing.

Any later change from `us.anthropic.claude-sonnet-4-6` to `global.anthropic.claude-sonnet-4-6`, an EU/AU/JP profile, or a different inference profile is a new route and requires separate privacy-gate reconciliation.

## 2. Optional feature inventory for the baseline LibEdge route

The current AI Assistant architecture does not authorize Bedrock Agents, Knowledge Bases, Prompt Management, Computer Use, server-side tools, web search, or other optional Bedrock orchestration/storage features. The reviewed baseline route is therefore limited to direct `bedrock-runtime` inference through the Sonnet 4.6 US geo profile.

For privacy-gate purposes, optional features are treated as **out of baseline scope unless separately approved and gated**. In particular:

- Prompt Management: not part of baseline route.
- Agents / Knowledge Bases / Flows: not part of baseline route.
- Computer Use / server-side tools / web-search-like provider features: not part of baseline route.
- Explicit prompt caching (`cache_control` / cache checkpoints): not authorized for baseline route.

This scope boundary is not a permanent product prohibition. It prevents an optional feature from silently inheriting the base-model privacy verdict without its own data-handling review.

## 3. Prompt-caching finding

A remaining issue exists even with explicit cache controls excluded.

AWS currently documents that:

- Sonnet 4.6 supports prompt caching on `bedrock-runtime`;
- Anthropic models that support prompt caching support **implicit** as well as explicit prompt caching;
- implicit prompt caching may automatically reuse eligible prompt prefixes without cache controls in the request;
- prompt-cache entries can preserve context for a cache TTL (commonly 5 minutes; Sonnet 4.6 also supports a 1-hour explicit TTL);
- account/project retention mode `none` is documented as zero data retention: request/response data is not written to durable storage and models whose `allowed_modes` include `none` are not persisted for retention/review.

Official sources:

- https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html

### Why this still blocks final PASS

The current AWS documentation establishes both ZDR `none` semantics and automatic implicit prompt caching for Anthropic models, but the reviewed source set does **not explicitly state how implicit prompt-cache storage is treated when account/project data-retention mode is `none`**.

The gate must not infer that an ephemeral/cache implementation is automatically outside the privacy invariant merely because AWS distinguishes it from "durable storage." Conversely, the existence of prompt caching does not prove a privacy violation. The interaction is simply not explicit enough in the current official source set.

Therefore the exact Sonnet 4.6 route remains:

`PASS CANDIDATE — STRONGEST EVIDENCE / FINAL CONFIRMATION PENDING`

not final `PASS`.

## Final confirmation trigger

Promote this route to final `PASS` only after one of the following is obtained from AWS official/provider-specific evidence:

1. an explicit statement that implicit prompt caching under Bedrock data-retention mode `none` is compatible with ZDR and does not retain research-interest-bearing content beyond the permitted ZDR boundary; or
2. an account/model configuration or API control that demonstrably disables implicit prompt caching for the exact Sonnet 4.6 `bedrock-runtime` route, followed by a live verification of that configuration.

The evidence should be dated because AWS retention/caching behavior has changed during this project.

## Proposed parent-gate update

The parent gate should update the Sonnet 4.6 residency field to:

> `us.anthropic.claude-sonnet-4-6` is a US geographic cross-Region profile. From `us-east-1`, AWS may process requests in `us-east-1`, `us-east-2`, or `us-west-2`; the profile does not route to EU/APAC regions.

The candidate verdict remains:

`PASS CANDIDATE — STRONGEST EVIDENCE / FINAL CONFIRMATION PENDING`

with the remaining blocker narrowed to the documented implicit-prompt-caching/ZDR interaction.

## Decision boundary

This record does **not**:

- select Sonnet 4.6 or any provider/model;
- grant final privacy-gate PASS;
- authorize AI Assistant implementation;
- authorize sending LibEdge research queries to an LLM;
- authorize prompt caching, Prompt Management, Agents, Knowledge Bases, Computer Use, or other optional Bedrock features;
- alter either P0 invariant;
- alter D-016 / Track A-B;
- reopen 0047/0049;
- authorize production deployment or migration work.

Capability/cost/latency comparison remains blocked until the parent canonical gate records at least one final `PASS`.