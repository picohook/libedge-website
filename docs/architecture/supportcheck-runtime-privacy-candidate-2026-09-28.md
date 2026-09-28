# supportCheck Runtime / Hosting and Privacy Candidate

Status: `PROPOSED / PRIVACY QUALIFICATION REQUIRED`

Date: 2026-09-28

## Purpose

Define the preferred runtime/hosting candidate for the frozen Fresh-Checker without prematurely granting the checker-specific privacy PASS required by the existing implementation gate.

## Frozen checker identity

- model: `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli`
- revision: `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`
- engine manifest SHA-256: `96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918`
- entailment threshold: `0.85`
- contradiction threshold: `0.85`
- aggregate rule: `ANY_SUPPORT_ELSE_NOT_SUPPORTED`

## Existing application boundary

The Worker-side supportCheck client already requires:

- explicit feature flag;
- checker-specific privacy status exactly `PASS`;
- HTTPS service URL;
- bearer token;
- bounded timeout;
- exact model/revision/manifest identity in the response.

Default, staging, and production configuration remain fail closed with supportCheck disabled and privacy status `UNVERIFIED`.

## Preferred candidate route

Preferred candidate for qualification:

**LibEdge-controlled Amazon SageMaker AI real-time endpoint in the LibEdge AWS account, running a container that packages the exact frozen model revision and checker implementation.**

Rationale:

1. The inference workload can remain under LibEdge-controlled AWS resources rather than sending claim/evidence payloads to a third-party managed inference API.
2. SageMaker Runtime supports VPC interface endpoints / AWS PrivateLink for private AWS-network access from clients that are themselves in the VPC.
3. AWS states that SageMaker customers retain ownership/control of their content and that AWS does not use/share customer models, training data, or algorithms.
4. The route can pin the model artifact and container image independently of mutable Hub aliases.

## Important network constraint

The current LibEdge Assistant caller is a Cloudflare Worker. A Cloudflare Worker is not automatically inside the AWS VPC and therefore cannot obtain the PrivateLink-only property merely because the SageMaker endpoint supports PrivateLink.

Before checker-specific privacy PASS, the actual invocation path must be selected and evidenced. Acceptable candidates include a reviewed authenticated AWS ingress/proxy boundary that invokes SageMaker privately, or another architecture that demonstrates equivalent network and access controls.

Do not mark the checker privacy gate PASS from SageMaker documentation alone.

## Hugging Face dedicated endpoint alternative

Current Hugging Face Inference Endpoints documentation states that payloads/tokens passed to an endpoint are not stored, while service logs are retained for 30 days; it also offers private AWS/Azure connectivity options.

Because the locked LibEdge research-interest privacy invariant is stricter than a generic security claim, this record does not grant Hugging Face Inference Endpoints PASS. Any future use requires exact clarification of what the retained logs contain for the intended account/endpoint/configuration and whether that handling satisfies the LibEdge invariant.

## Checker-specific privacy qualification checklist

The exact selected route must establish, before `RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS=PASS`:

1. **Payload retention:** claim/evidence request and checker response content are not durably retained outside explicitly approved LibEdge-controlled storage.
2. **Training/service improvement:** claim/evidence content is not used to train or improve provider/base models.
3. **Human access:** no routine provider/operator human review of claim/evidence payloads; exceptions and support-access paths must be documented.
4. **Logging:** application, platform, proxy, container, and observability logs must not contain claim/evidence text, authorization tokens, raw request/response bodies, research topics, or user IDs.
5. **Network path:** exact Cloudflare-to-AWS/checker route, TLS boundary, authentication mechanism, and any public ingress are documented.
6. **Artifact pin:** deployed model bytes/revision and checker implementation correspond to the frozen identity/manifest.
7. **Region:** exact AWS region(s) and any cross-region behavior are pinned.
8. **Access control:** least-privilege invocation and administrative access are documented.
9. **Secrets:** credentials/tokens are held outside source control and rotation/revocation is available.
10. **Failure behavior:** privacy uncertainty, route mismatch, pin mismatch, missing credential, or service failure leaves supportCheck unavailable/fail closed.

## Evidence required for PASS

A future PASS record must identify the exact endpoint/route/configuration and include evidence for the checklist above. Generic AWS or Hugging Face documentation is supporting context only; account/route-specific controls must be verified where applicable.

## Activation boundary

This proposal does not:

- create or deploy a SageMaker endpoint;
- send any LibEdge user/research content to a checker;
- change the supportCheck feature flag;
- set the checker privacy gate to PASS;
- authorize staging or production activation;
- change D-023 language or Trigger-B scope;
- change D-016/Track A/Track B.

## External documentation checked 2026-09-28

- AWS SageMaker AI FAQ: customer ownership/control and service privacy statements.
- AWS SageMaker AI VPC/PrivateLink documentation: private SageMaker Runtime connectivity within AWS VPC.
- Hugging Face Inference Endpoints Security & Compliance: payload/token storage statement, 30-day logs, TLS, and private connectivity options.
