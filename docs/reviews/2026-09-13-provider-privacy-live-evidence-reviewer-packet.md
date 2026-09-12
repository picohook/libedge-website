# Reviewer Packet — Provider Privacy Gate Live Evidence

Status: `READY FOR REVIEW`

## Scope

Record the first live account/model verification evidence for AWS Bedrock without changing the Provider Privacy Gate methodology or granting PASS.

## Canonical record

- `docs/architecture/p05-provider-privacy-gate.md`
- Parent architecture: `docs/architecture/p05-ai-assistant-architecture-v0.1.md`

## What this PR does

- records live `us-east-1` Bedrock control-plane evidence showing account retention `none`;
- records live Opus 4.8 authorization/availability and model ACTIVE state;
- records live Mantle evidence showing `allowed_modes` includes `none` but effective `default/model_default` and `status: unavailable`;
- records that the same bearer token sees control-plane account `none` while Mantle account endpoint reports `inherit`;
- classifies this as an unresolved provider-surface inconsistency and keeps the route `UNVERIFIED / BLOCKED`.

## Decision Boundary — not authorized by this PR

This PR does **not**:

- grant PASS to any candidate;
- select an LLM provider or model;
- authorize AI Assistant implementation code;
- authorize sending LibEdge research queries to an LLM;
- change the two P0 invariants;
- alter D-016 or Semantic-primary Track A/B;
- reopen 0047/0049;
- authorize production deployment or migration work.

## Reviewer task

Verify independently that:

1. the live evidence is represented accurately and without storing credentials/account secrets;
2. AWS's documented precedence rule implies that account `none` should override project `inherit` before model default;
3. the Mantle `inherit/default/model_default/unavailable` observation is genuinely inconsistent with the control-plane `none` observation for the intended route;
4. keeping Opus 4.8 `UNVERIFIED / BLOCKED` rather than PASS is the correct fail-closed outcome;
5. the reconciliation trigger is sufficient and does not smuggle in implementation/model-selection authorization.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `P05-PROVIDER-LIVE-EVIDENCE-01`
Branch/ref: `docs/provider-privacy-gate-live-evidence`
Base: `staging`
Head: use the current PR head at review time.

RAW MATERIALS
[x] PR diff — accessible in this PR — current intended version
[x] `docs/architecture/p05-provider-privacy-gate.md` — full changed canonical file
[x] Governing parent architecture on `staging`
[x] Official AWS data-retention documentation linked in the canonical file

CONSISTENCY
[x] Implementer summary is separated from raw material.
[x] Raw material is authoritative over the summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.
[x] Decision Boundary identifies what is not authorized.
[x] No credentials, bearer tokens, or AWS account identifiers are recorded.

RESULT: COMPLETE

## Access fallback

If PR metadata is unavailable because of GitHub API/rate-limit failure, this file is the authoritative reviewer-packet framing. The reviewer must still inspect the exact branch diff and raw canonical files from git.
