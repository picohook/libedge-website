# D-016 — Controlled Staging Semantic Enablement Review

Status: `ACTIVE — ACCEPTED WITH MODIFICATION / FOLLOW-UP REQUIRED`
Date: 2026-09-11
Packet ID: `P05-D016-STAGING-SEMANTIC-ENABLEMENT-2026-09-11`

## Reviewer classification

`ACCEPTED WITH MODIFICATION`

The reviewer independently verified the two GitHub Actions runs at run level and accepted the successful flag-OFF baseline deployment/smoke evidence and the proposed controlled staging semantic-primary rollout direction.

Before the staging flag may change to true, two control details must be made explicit:

1. The live pacing proof must use two near-concurrent semantic requests, not human-speed sequential clicks. Success requires evidence that the pacing gate actually imposed measurable waiting: at least one controlled request pair must produce an aggregate `semantic_pacing_wait_ms_total` increase greater than zero (equivalently, a directly observed per-request wait >0 if such a privacy-safe observation path is used). Merely receiving two successful semantic responses is insufficient to prove pacing enforcement.
2. The controlled enablement window must not silently expose unconsenting real end-user research traffic to the experimental staging behavior. Immediately before enabling the flag, the human gatekeeper must explicitly confirm that staging research traffic during the window is restricted to controlled test traffic. If that cannot be confirmed, the flag remains false until an explicit user-traffic treatment is reviewed.

## Pacing smoke procedure — locked for follow-up review

After separate acceptance of these modifications and staging-only flag enablement:

- use a real authenticated staging session;
- issue two distinct, ordinary, non-sensitive test research requests near-concurrently (programmatically back-to-back / `Promise.all`, not manual clicks);
- do not use P0.5 frozen holdout queries and do not label/compare returned relevance;
- both requests must traverse semantic-primary rather than a pre-existing semantic cache entry; use two distinct test queries and confirm `meta.retrievalSource === "semantic"` for valid successes;
- verify the aggregate privacy-safe telemetry counter `semantic_pacing_wait_ms_total` increased by `>0` across the pair. This counter contains only numeric wait milliseconds and no query/user/topic/result content;
- if the counter does not increase, pacing enforcement is NOT considered live-verified even if requests succeed; stop and investigate rather than claiming success.

The existing unit test proving 999ms blocked / 1000ms released remains useful but does not replace this live pacing proof.

## Staging traffic isolation precondition

The repository/control plane does not itself prove who may currently access the public staging URL. Therefore this record does not make an unsupported assertion that staging has zero real-user traffic.

Instead, flag enablement has this explicit precondition:

> Immediately before `RESEARCH_SEMANTIC_PRIMARY_ENABLED=true` is deployed to staging, the human gatekeeper must confirm that the enablement window is restricted to controlled test traffic and that no ordinary real end-user research traffic is expected during the window. Without that confirmation, do not enable the flag.

This is an operational scope control, not a relevance gate.

## Remaining rollout boundaries

Acceptance after follow-up would authorize only staging flag enablement and the minimal mechanical smoke. It would not authorize production enablement, relevance retuning, H/RRF, Vectorize, pacing relaxation, content-dependent fallback, or any weakening of privacy invariants.

Broad production enablement remains separately blocked by the locked `<=0.5 requests/second` capacity guardrail and other D-016 rollout controls.
