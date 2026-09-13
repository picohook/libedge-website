# Reviewer Packet — EvidencePack / Grounding Boundary

Status: READY_FOR_REVIEW
Base: `staging`
Branch: `feat/evidence-pack-grounding`

## Scope

Implement the provider-independent layer above `Discover()`:

`ResearchWork[] -> EvidencePack -> Structured Claims -> Grounding Validator`

This PR does not invoke an LLM and does not alter retrieval behavior.

## Required invariants

1. `evidence_id` is pack-local and distinct from `ResearchWork.id`.
2. Evidence Pack is an immutable, data-minimized snapshot and must not contain raw query/user/session/quota/search-history context.
3. Every factual structured claim requires one or more `evidence_id` values.
4. Citation existence alone is insufficient: semantic support must be checked.
5. Without a semantic support checker, the validator fails closed rather than inferring support.
6. Unsupported/unknown/uncited claims are rejected from the accepted claim set.

## Files

- `backend/src/research/evidence-pack.js`
- `backend/src/research/grounding-validator.js`
- `test/backend/evidence-pack-grounding.test.js`

## Reviewer task

Verify that the implementation matches the locked P0 evidence-grounding invariant in `docs/architecture/p05-ai-assistant-architecture-v0.1.md`, does not conflate bibliographic work identity with pack-local evidence identity, does not introduce user/query context into EvidencePack, and does not pretend structural citation checks establish semantic support.

Also verify existing retrieval/router behavior is untouched and CI passes.

## Decision Boundary — not authorized

No LLM/provider integration or selection; no Provider Privacy Gate relaxation; no prompt construction; no user-facing AI response endpoint; no retrieval-policy/D-016/Track A-B change; no reopening 0047/0049; no production migration/deployment.
