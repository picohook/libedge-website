# P0.5 — Provider Privacy Gate

Status: `PROPOSED / EVIDENCE REVIEW`

Checked: 2026-09-13

## Purpose

This record evaluates candidate AI inference routes against the locked LibEdge research-interest privacy invariant before any model/provider selection.

Gate order is mandatory:

`privacy eligibility -> PASS candidate pool -> capability/cost/latency evaluation -> model selection`

A preferred model must not be selected first and then used to weaken the privacy gate.

## Gate unit

The unit of evaluation is **model + endpoint + hosting route**, not provider brand.

A provider-wide privacy statement is insufficient where model, endpoint, feature, or hosting-route behavior differs.

## Verdict vocabulary

- `PASS` — the exact route is verified to satisfy the LibEdge privacy invariant for the intended configuration.
- `FAIL` — verified behavior conflicts with the invariant.
- `UNVERIFIED / BLOCKED` — public evidence suggests the route may be eligible, but required account-, contract-, model-, endpoint-, region-, or configuration-level verification is still missing or internally inconsistent. It must not enter the model-selection pool.

Public documentation alone does not prove that the LibEdge account/project has an approved ZDR configuration. Account/project verification is therefore required before a candidate can receive `PASS` where the control is approval- or configuration-dependent.

## Gate criteria

For every candidate, verify:

1. retention of prompts/outputs;
2. training/model-improvement use;
3. human-access policy;
4. subprocessors / hosting boundary;
5. region and data-residency behavior;
6. exact model/endpoint eligibility for ZDR or an equivalent contractual control.

The gate fails closed: ambiguity, conflicting live evidence, or missing required evidence is `UNVERIFIED / BLOCKED`, not PASS.

## Candidate matrix

| Candidate | Retention | Training use | Human access | Hosting / subprocessors | Region / residency | Exact ZDR status | Verdict |
|---|---|---|---|---|---|---|---|
| OpenAI `gpt-5.6-sol` + `/v1/responses` + first-party OpenAI API | Default API abuse-monitoring may retain customer content up to 30 days. Approved ZDR excludes customer content from abuse-monitoring logs; for Responses, `store` is forced false under ZDR. | API data is not used to train/improve OpenAI models by default unless the customer explicitly opts in. | Under OpenAI ZDR, customer content is stated not to be available to OpenAI personnel for review. | First-party OpenAI API; third-party tools/MCP would create separate data paths and are outside this route. Exact current subprocessor list must be checked during contractual/account verification. | Data residency is project-configured; non-US regions have additional approval/ZDR-amendment requirements. | `/v1/responses` is ZDR-eligible, and `gpt-5.6-sol` supports Responses. Actual LibEdge org/project ZDR approval is not yet verified. | `UNVERIFIED / BLOCKED` |
| Anthropic `claude-opus-5` + first-party Anthropic API / Messages | Standard Anthropic API inputs/outputs are deleted within 30 days, subject to policy/legal exceptions. Some approved enterprise API customers may obtain ZDR arrangements. | Anthropic states commercial-customer data is not used to train generative models. | ZDR documentation still preserves limited safety/legal exceptions; the exact LibEdge agreement and operational access terms must be verified. | First-party Anthropic API; Anthropic uses multiple cloud service providers documented in its subprocessor list. | By default processing may occur across multiple geographic regions; storage is US-only unless otherwise agreed. US-only processing can be contractually requested. | ZDR applies only to the Anthropic API / products using the commercial organization API key, not beta products, Workbench, Claude for Work, or other products unless explicitly agreed. Actual LibEdge ZDR agreement is not verified. | `UNVERIFIED / BLOCKED` |
| AWS Bedrock `anthropic.claude-opus-4-8` + Bedrock inference route | AWS documents that this model permits `none`. Live Bedrock control-plane evidence for the intended `us-east-1` account shows account mode `none`; however, the same bearer-token session against Mantle returns account mode `inherit` and the model's effective mode as `default` from `model_default`. | AWS states Bedrock customer inputs/outputs are not used to train or improve base foundation models. | Under verified `none`, request/response data would not be retained or reviewed. The current Mantle route has not demonstrated that effective mode. | Bedrock inference remains within AWS-operated infrastructure; AWS states third-party model providers do not receive prompts/completions under current Bedrock handling. | Intended region is `us-east-1`; cross-region behavior remains to be pinned before any PASS. | Live model metadata confirms `allowed_modes` contains `none`, but the same live Mantle surface reports `status: unavailable`, `mode: default`, `source: model_default`. This conflicts with the control-plane account `none` reading and must be reconciled before PASS. | `UNVERIFIED / BLOCKED` |
| AWS Bedrock `anthropic.claude-fable-5.1` + Bedrock inference route | Current AWS documentation requires `aws_review`; prompts/completions may be retained within the AWS boundary for up to 30 days. | AWS states Bedrock inputs/outputs are not used to train base foundation models. | `aws_review` permits AWS human review where required by the model provider's access condition. | Under the current mechanism, content remains within the AWS boundary and is not shared with Anthropic. | If cross-region inference is enabled, retained inputs/outputs are stored in destination regions. | Current public docs list Fable 5.1 as requiring human review with `allowed_modes: ["aws_review", "provider_data_share"]`; `none` is not part of the standard route. | `FAIL` for the standard route |

## Evidence record

### OpenAI first-party API

Claims supported by official OpenAI sources:

- API data is not used for model training by default unless explicitly opted in.
- Default abuse-monitoring logs may contain prompts/responses and are retained for up to 30 days.
- Eligible customers may receive Zero Data Retention; `/v1/responses` is ZDR eligible and forces `store=false` under ZDR.
- OpenAI's 2026 ZDR statement says prompts/responses are not retained after processing and customer content is not available to OpenAI personnel for review under ZDR.
- `gpt-5.6-sol` is an active API model supporting `/v1/responses`.

Sources:

- https://platform.openai.com/docs/models/default-usage-policies-by-endpoint
- https://openai.com/index/offering-zero-data-retention-for-frontier-models/
- https://developers.openai.com/api/docs/models/gpt-5.6-sol

Reconciliation trigger before PASS:

- verify the LibEdge API organization/project is actually approved and configured for ZDR;
- verify the exact intended endpoint/features remain ZDR eligible at implementation time;
- record the current subprocessor and selected region/residency configuration.

### Anthropic first-party API

Claims supported by official Anthropic sources:

- Standard Anthropic API retention is up to 30 days, subject to policy/legal exceptions.
- Some approved enterprise API customers can have ZDR arrangements.
- Anthropic ZDR applies to the Anthropic API / commercial organization API-key products, and does not automatically apply to beta products, Workbench, Claude for Work, or other products.
- Commercial-customer data is not used to train generative models.
- Anthropic processes through multiple cloud service providers; geographic processing can span the US, Europe, Asia, and Australia, while storage is US-only unless otherwise agreed.
- `claude-opus-5` is active on the first-party Claude API.

Sources:

- https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- https://privacy.anthropic.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to
- https://privacy.anthropic.com/en/articles/9267385-does-anthropic-act-as-a-data-processor-or-controller
- https://privacy.anthropic.com/en/articles/7996890-where-are-your-servers-located-do-you-host-your-models-on-eu-servers
- https://docs.anthropic.com/en/docs/about-claude/model-deprecations

Reconciliation trigger before PASS:

- obtain/verify the exact LibEdge Anthropic API ZDR agreement and covered first-party API route;
- verify any intended feature (for example files, prompt caching, web/search/tooling, or beta functionality) is covered rather than assuming base-API ZDR extends to it;
- verify current subprocessor and region terms.

### AWS Bedrock

Claims supported by current official AWS sources:

- Bedrock supports explicit data-retention modes, including `none` for zero data retention where the model permits it.
- Effective mode is documented as the first non-`inherit` value in `project -> account -> model default` order.
- A model's `allowed_modes` determines whether `none` is available; the control is model-specific.
- AWS documentation gives Claude Opus 4.8 as an example that permits `none`.
- Claude Fable 5 and Claude Fable 5.1 currently require human review and list `allowed_modes: ["aws_review", "provider_data_share"]`.
- Under `aws_review`, inputs/outputs may be retained within AWS for up to 30 days and may be reviewed by AWS; content is not shared with the model provider.
- `provider_data_share` is now documented as a legacy mode. Current AWS documentation explicitly says Bedrock does not share content with model providers today; for Fable 5/5.1 it results in the same practical handling as `aws_review`.
- Bedrock customer prompts/completions are not used to train/improve base models.

Sources:

- https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
- https://aws.amazon.com/blogs/security/enforce-zero-data-retention-on-amazon-bedrock-with-bedrock-projects-and-service-control-policies/
- https://aws.amazon.com/blogs/aws/anthropic-claude-fable-5-on-aws-mythos-class-capabilities-with-built-in-safeguards-now-available/
- https://aws.amazon.com/blogs/aws/aws-weekly-roundup-claude-fable-5-1-on-aws-amazon-linux-2027-preview-aws-certified-ai-business-strategist-and-more-september-7-2026/

#### Provider-data-share timeline reconciliation

The reviewer and implementer had apparently conflicting readings because the official AWS source set itself contains a **time-dependent policy change**.

- **Historical Fable 5 behavior:** AWS's July 7, 2026 Security Blog describes `provider_data_share` as data being shared with the model provider and retained for up to 30 days, and uses Claude Fable 5 as the concrete example requiring that mode.
- **Current behavior:** current AWS documentation marks `provider_data_share` as legacy and states that content sharing with model providers is no longer supported. Both Claude Fable 5 and Claude Fable 5.1 now require human review through `aws_review` (or the more-permissive legacy setting), with retained content staying inside the AWS boundary.
- **Current Fable candidate:** Claude Fable 5.1 is therefore evaluated under the current `aws_review` mechanism, not by projecting the historical Fable 5 provider-sharing behavior onto the newer route.

Conflict status: `RESOLVED — documentation changed over time; historical provider sharing and current AWS-only review are both supported when dated correctly.`

The privacy verdict remains unchanged: the standard Fable 5.1 route is `FAIL` because up-to-30-day retention and possible AWS human review conflict with the locked LibEdge research-interest privacy invariant.

#### Live account/model verification — 2026-09-13

Read-only verification was performed against the intended `us-east-1` Bedrock context. No credentials or bearer tokens are recorded in this repository.

Observed control-plane evidence:

- `aws bedrock get-account-data-retention --region us-east-1` -> `mode: none`, updated at `2026-09-12T21:42:53.317Z`;
- `aws bedrock get-foundation-model-availability --model-id anthropic.claude-opus-4-8 --region us-east-1` -> `authorizationStatus: AUTHORIZED`, `entitlementAvailability: AVAILABLE`, `regionAvailability: AVAILABLE`;
- `aws bedrock get-foundation-model --model-identifier anthropic.claude-opus-4-8 --region us-east-1` -> model `ACTIVE`.

Observed Mantle evidence using a fresh short-term bearer token derived from the same CLI credential context and `us-east-1` region:

- `GET https://bedrock-mantle.us-east-1.api.aws/v1/data_retention` -> `mode: inherit`;
- `GET https://bedrock-mantle.us-east-1.api.aws/v1/models/anthropic.claude-opus-4-8` -> `allowed_modes` includes `none`, but `mode: default`, `source: model_default`, `status: unavailable`;
- the same bearer token against Bedrock control-plane `GET https://bedrock.us-east-1.amazonaws.com/data-retention` -> `mode: none` with the same account update timestamp as the CLI control-plane result.

Conflict status: `OPEN — live provider-surface inconsistency`.

Why this blocks PASS:

AWS documents `effective mode = first non-inherit value of (project -> account -> model default)`. Under that rule, an account-level `none` combined with a project-level `inherit` should resolve to `none`, not `model_default/default`. The current live Mantle result therefore does not reconcile with the control-plane account setting. Because the exact inference-facing surface does not yet demonstrate the expected effective `none` mode and reports the model unavailable, the route remains `UNVERIFIED / BLOCKED` despite `allowed_modes` containing `none`.

Reconciliation trigger before any Bedrock PASS:

- obtain an AWS explanation or provider-side correction that reconciles control-plane account `none` with Mantle account `inherit` / model `default` for the same credential/region context; or
- obtain a later live Mantle observation for the intended route showing effective `mode: none`, with the source attributable to the applicable account/project scope, and `status: available`;
- pin the exact inference region/profile and confirm no project-level override weakens the effective mode.

## Findings

1. **No candidate is PASS yet.**
2. OpenAI first-party `gpt-5.6-sol` + Responses and Anthropic first-party `claude-opus-5` remain blocked pending exact account/contract verification.
3. Bedrock `anthropic.claude-opus-4-8` has stronger live evidence than before: the account control plane is `none`, the model is authorized/available in the control plane, and live model metadata confirms `allowed_modes` includes `none`. However, Mantle currently reports account `inherit`, model effective `default/model_default`, and model `unavailable`. This unresolved provider-surface inconsistency blocks PASS.
4. Bedrock `claude-fable-5.1` remains `FAIL` on the standard route because it requires AWS retention/human review.
5. The Fable record remains time-sensitive: original Fable 5 documentation permitted `provider_data_share`, while current Fable 5/5.1 documentation uses AWS-only `aws_review`.
6. The privacy gate therefore remains open. **Capability, cost, latency, and product-quality comparison must not begin as a model-selection exercise until at least one exact route receives PASS.**

## Decision boundary

This record does **not**:

- select an LLM provider or model;
- authorize AI Assistant implementation code;
- authorize sending LibEdge research queries to any LLM;
- alter the evidence-grounding invariant;
- alter D-016 or Semantic-primary Track A/B;
- reopen 0047/0049;
- authorize production deployment or production migration work.

## Next verification step

Resolve the Bedrock control-plane/Mantle inconsistency or verify another candidate's exact account/contract configuration. Promote a candidate to `PASS` only after the exact inference route is internally consistent and verified; only PASS routes may enter the later capability/cost/latency selection stage.
