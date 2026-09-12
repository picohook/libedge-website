# Reviewer Packet — PR #39 Provider Privacy Gate

Status: `READY FOR REVIEW`

## Scope

Add the first evidence-bearing Provider Privacy Gate record for the LibEdge AI Assistant. Evaluation is at **model + endpoint + hosting route** level and precedes any model/provider selection.

## Canonical record

- `docs/architecture/p05-provider-privacy-gate.md`
- Parent architecture: `docs/architecture/p05-ai-assistant-architecture-v0.1.md`

## What this PR does

- defines PASS / FAIL / UNVERIFIED-BLOCKED gate outcomes;
- records official-source evidence for four concrete routes;
- explicitly distinguishes standard Bedrock Claude Fable 5 retention/human-review behavior from Bedrock models that can permit `none`;
- records exact account/contract/configuration reconciliation triggers before any candidate can become PASS;
- keeps model selection blocked until at least one exact route passes privacy.

## Decision Boundary — not authorized by this PR

This PR does **not**:

- select an LLM provider or model;
- authorize AI Assistant implementation code;
- authorize sending LibEdge research queries to any LLM;
- alter either P0 invariant;
- alter D-016 or Semantic-primary Track A/B;
- reopen 0047/0049;
- authorize production deployment or production migration work.

## Reviewer task

Verify independently from raw sources and diff that:

1. evaluation is actually model + endpoint + hosting-route specific rather than provider-wide;
2. PASS is not granted from public documentation when LibEdge-specific ZDR/account evidence is still missing;
3. OpenAI, Anthropic, and Bedrock retention/training/human-access/region claims are supported by the cited official sources;
4. the Fable-vs-Opus Bedrock distinction is represented accurately;
5. no model selection or implementation authorization is smuggled into this gate record.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `P05-PROVIDER-PRIVACY-GATE-01`
Branch/ref/commit: `docs/provider-privacy-gate` / `59c35addce318affb40a7f6b7b584039278288ae`
Base: `staging`

RAW MATERIALS
[x] PR diff — accessible in PR #39 — current intended version
[x] `docs/architecture/p05-provider-privacy-gate.md` — full file in PR — current intended version
[x] `docs/architecture/p05-ai-assistant-architecture-v0.1.md` — accessible on `staging` — governing parent architecture
[x] Official provider sources — direct URLs embedded in gate record

CONSISTENCY
[x] No claim such as attached/pasted/included is false.
[x] Implementer summary is separated from raw material.
[x] Raw material is authoritative over the summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.
[x] Decision Boundary explicitly identifies what is not authorized.

RESULT: COMPLETE

## Access fallback

If GitHub PR metadata or the PR description is temporarily unavailable because of API/rate-limit failure, this file is the authoritative reviewer-packet framing for PR #39. The reviewer must still inspect the exact branch diff and raw canonical files from git; this file does not substitute for the diff.
