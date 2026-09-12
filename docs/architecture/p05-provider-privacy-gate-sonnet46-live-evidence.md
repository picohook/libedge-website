# P0.5 — Claude Sonnet 4.6 live-route evidence

Status: `REVIEW CANDIDATE / NO MODEL SELECTION AUTHORIZED`

Checked: 2026-09-13

Parent canonical gate: `docs/architecture/p05-provider-privacy-gate.md`

## Candidate

AWS Bedrock `anthropic.claude-sonnet-4-6` via the `us.anthropic.claude-sonnet-4-6` US geo inference profile and `bedrock-runtime` InvokeModel route.

## Live account evidence

The intended Bedrock control plane in `us-east-1` was verified with account data-retention mode `none` on 2026-09-12. A live `bedrock-runtime` invocation of the Sonnet 4.6 US inference profile on 2026-09-13 then completed successfully without a retention-policy rejection.

No credentials, bearer tokens, account identifiers, prompts, or model outputs are recorded here.

## Official-source reconciliation

AWS currently documents all of the following:

- if an account/project is configured to `none` and a model requires retention, Bedrock blocks the request and returns an error;
- `none` means no request/response data is written to durable storage by AWS or shared with the model provider;
- there is no data-retention change for Claude models released before Claude Fable 5;
- the current Anthropic abuse-detection exception identifies Claude Fable 5 and Fable 5.1 as models for which all traffic is retained up to 30 days;
- the Sonnet 4.6 model card identifies `bedrock-runtime` and `us.anthropic.claude-sonnet-4-6` as supported programmatic access paths.

Official sources:

- https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html

Third-party tracker claims are not required for this conclusion and are not treated as authoritative gate evidence.

## Candidate matrix row proposed for parent gate

| Candidate | Retention | Training use | Human access | Hosting / subprocessors | Region / residency | Exact ZDR status | Verdict |
|---|---|---|---|---|---|---|---|
| AWS Bedrock `anthropic.claude-sonnet-4-6` (`us.` inference profile) + `bedrock-runtime` InvokeModel | Account control-plane `none` verified 2026-09-12. Live invocation on 2026-09-13 succeeded without a retention-policy rejection. AWS documents that a model requiring retention is blocked under effective `none`. | AWS states Bedrock customer inputs/outputs are not used to train or improve base foundation models. | Current AWS abuse-detection documentation identifies Fable 5/5.1, not Sonnet 4.6, as Anthropic models requiring retention/human-review handling. | Standard AWS Bedrock `bedrock-runtime` route. | Request originated in `us-east-1` through the `us.anthropic.claude-sonnet-4-6` US geo inference profile; exact destination-region/residency behavior still requires pinning. | Strong account-specific evidence: the exact inference route successfully executed while the account control plane was explicitly `none`, consistent with AWS's documented enforcement behavior. | `PASS CANDIDATE — STRONGEST EVIDENCE / FINAL CONFIRMATION PENDING` |

## Opus 4.8 correction proposed for parent gate

The prior Opus 4.8 record should no longer characterize the observed state primarily as a retention-policy/provider-surface failure. Live Mantle metadata returned `status: unavailable` with a `status_reason` stating that `anthropic.claude-opus-4-8` is not available for this account and directing the customer to AWS Sales. `allowed_modes` did include `none`.

Therefore the narrower current classification is:

`UNVERIFIED / BLOCKED — MODEL ACCESS UNAVAILABLE`

The observed Mantle `default/model_default` value is not treated as proof of a retention-policy failure for an invocable Opus 4.8 route, because the exact route is not currently account-access available.

## Gate interpretation

The successful Sonnet 4.6 invocation under an account control plane explicitly configured to `none` is stronger evidence than a third-party privacy tracker because it is both account-specific and route-specific, and AWS documents that retention-requiring models are blocked when effective mode is `none`.

It is not yet promoted to final `PASS`. Before promotion, the intended inference profile/residency behavior must be pinned and any optional LibEdge feature that could create a distinct retention path (for example prompt caching or another optional route feature) must be separately checked.

## Decision boundary

This record does **not** select Sonnet 4.6, authorize AI Assistant implementation, authorize sending LibEdge research queries to an LLM, alter either P0 invariant, alter D-016/Track A-B, reopen 0047/0049, or authorize production work.

Capability/cost/latency comparison remains blocked until the parent canonical gate records at least one final `PASS`.