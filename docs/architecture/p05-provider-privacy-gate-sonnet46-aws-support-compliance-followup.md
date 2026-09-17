# P0.5 — Claude Sonnet 4.6 AWS Support compliance-reference follow-up

Status: `SUPPLEMENTAL EVIDENCE — PASS UNCHANGED`

Recorded: 2026-09-17

Parent canonical gate: `docs/architecture/p05-provider-privacy-gate.md`  
Prior final evidence: `docs/architecture/p05-provider-privacy-gate-sonnet46-aws-caching-final-evidence.md`

## Scope

This supplemental record captures a follow-up AWS Support correspondence received after the reviewed Claude Sonnet 4.6 route had already reached `PASS` in the canonical privacy gate. It does **not** reopen, broaden, or independently grant that verdict. It strengthens the provenance of the existing evidence and records an additional fail-closed property of Amazon Bedrock's data-retention control.

The existing `PASS` remains limited to the previously reviewed route:

- model: `anthropic.claude-sonnet-4-6`;
- route: Amazon Bedrock `bedrock-runtime` / `InvokeModel`;
- inference profile: `us.anthropic.claude-sonnet-4-6`;
- effective data-retention mode: `none`.

## 1. AWS Support case correspondence as compliance-review evidence

In the follow-up, AWS Support explicitly stated that the correspondence for **Case ID 178936641500762** serves as an official AWS Support communication and may be referenced in internal compliance and privacy review documentation. AWS further stated that the case correspondence, together with the referenced public AWS documentation, should be sufficient for the stated compliance-review purpose, while offering to explore a more formal statement or specific compliance attestation if the organization requires one.

### Evidence classification update

The prior record classified the source as AWS Support case correspondence prepared after Bedrock SME consultation and deliberately did not represent it as a formal legal opinion, contractual amendment, or standalone compliance attestation. That boundary remains correct.

The new correspondence adds a narrower but important provenance fact: **AWS itself confirms that this case correspondence is an official AWS Support communication that may be used as a reference in internal compliance/privacy review documentation.**

This does not convert the correspondence into a legal opinion, certification, contractual amendment, or organization-specific compliance determination.

## 2. Fail-closed retention-policy behavior

AWS Support also stated that the customer's data-retention configuration remains customer-controlled and that, when an account in a specific Region or project is configured for zero data retention (`data_retention_mode: none`), an invocation of a model that requires retention is blocked and returns an error rather than silently proceeding under a more permissive retention policy.

This is independently reflected in AWS's current public Bedrock data-retention documentation, which states that:

- `none` means zero data retention: request/response data is not written to durable storage by AWS or shared with the model provider;
- if effective mode is below a model's retention requirement, that model is unavailable and requests are blocked;
- account/project retention configuration determines the effective mode according to AWS's documented precedence rules.

This fail-closed behavior is useful evidence for the Provider Privacy Gate because a retention-policy incompatibility is documented to fail as an unavailable/errored invocation rather than silently weakening the configured retention boundary.

## 3. Public AWS references supplied in the follow-up

AWS Support pointed to the following public AWS materials for the compliance review:

- Amazon Bedrock data retention: https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html
- Amazon Bedrock prompt caching: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
- Amazon Bedrock security and compliance: https://aws.amazon.com/bedrock/security-compliance/

The current public data-retention documentation directly corroborates the fail-closed retention-policy behavior described above. The prompt-caching documentation continues to corroborate the Sonnet 4.6 caching mechanics recorded in the prior evidence file, including a 1,024-token minimum for Sonnet 4.6 cache checkpoints and a 5-minute supported TTL.

## 4. Compliance-claim boundary

The AWS follow-up also references AWS service-level compliance programs and eligibility. Those statements are **not** promoted here into a claim that LibEdge, its application, or the reviewed commercial `us.` Bedrock route is itself certified or compliant with any particular framework.

In particular:

- service eligibility or AWS certification does not by itself establish application-level compliance;
- organization-specific GDPR, HIPAA, SOC, ISO, or other compliance conclusions remain separate governance/legal determinations;
- any FedRAMP statement tied to AWS GovCloud must not be generalized to the reviewed commercial `us.` inference-profile route.

## 5. Effect on the canonical gate

**No verdict change is required.** The canonical route is already `PASS` after independent reviewer approval and reconciliation of the prior AWS caching evidence.

This follow-up strengthens two parts of the evidence package without expanding scope:

1. **provenance:** AWS confirms that Case ID 178936641500762 is official AWS Support correspondence usable as a reference for internal compliance/privacy review; and
2. **control behavior:** AWS confirms a fail-closed property for `data_retention_mode: none` when a requested model requires a more permissive retention mode.

The existing boundaries remain unchanged: `PASS` is not model selection, not deployment authorization, and not a blanket approval of AWS, Anthropic, other Bedrock models, optional Bedrock storage/orchestration features, or different provider/model/route/retention configurations.

## Evidence summary

`SUPPLEMENTAL EVIDENCE — PASS UNCHANGED`

The follow-up AWS Support correspondence materially strengthens the evidence provenance and documents fail-closed enforcement of the configured retention boundary. It does not require reopening or broadening the existing Sonnet 4.6 route-specific `PASS` verdict.
