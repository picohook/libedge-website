# Reviewer Packet — Sonnet 4.6 residency + optional-feature checks

Status: `READY FOR REVIEW`

## Scope

Review the two remaining Provider Privacy Gate checks for AWS Bedrock Claude Sonnet 4.6:

1. `us.` inference-profile residency behavior;
2. optional-feature retention paths, especially prompt caching.

## Canonical context

- Parent gate: `docs/architecture/p05-provider-privacy-gate.md`
- Prior Sonnet evidence: `docs/architecture/p05-provider-privacy-gate-sonnet46-live-evidence.md`
- New evidence record: `docs/architecture/p05-provider-privacy-gate-sonnet46-final-checks.md`

## Reviewer task

Verify independently that:

1. `us.anthropic.claude-sonnet-4-6` is US-geo cross-Region rather than `us-east-1`-only;
2. from `us-east-1`, the documented destination regions are `us-east-1`, `us-east-2`, and `us-west-2`;
3. no global/EU routing is implied by the reviewed `us.` profile;
4. baseline LibEdge scope does not silently authorize Bedrock optional services/features;
5. AWS documents implicit prompt caching for Anthropic models even without explicit cache controls;
6. the current source set does not explicitly reconcile implicit prompt-cache persistence with account/project ZDR mode `none`;
7. keeping final PASS blocked on that narrow unresolved interaction is appropriately fail-closed rather than over-conservative or unsupported.

## Decision Boundary — not authorized

This review does not select a model/provider, grant final PASS, authorize AI implementation, authorize research-query transmission, authorize prompt caching or other optional Bedrock features, alter P0 invariants, alter D-016/Track A-B, reopen 0047/0049, or authorize production work.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID: `P05-SONNET46-FINAL-CHECKS-01`
Branch/ref: `docs/sonnet46-residency-cache-gate`
Base: `staging`
Head: current PR head at review time.

RAW MATERIALS
[x] Exact PR diff
[x] New Sonnet 4.6 final-check evidence file
[x] Parent Provider Privacy Gate on staging
[x] Prior Sonnet 4.6 live-evidence record on staging
[x] Official AWS source URLs embedded in evidence file

CONSISTENCY
[x] Raw material is authoritative over summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.
[x] Decision Boundary is explicit.
[x] No credentials, tokens, account identifiers, prompts, or model outputs are recorded.

RESULT: COMPLETE

## Access fallback

If PR metadata is unavailable because of GitHub API/rate-limit failure, this git-readable packet is the authoritative reviewer framing. The exact branch diff and raw files must still be inspected.