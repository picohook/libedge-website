# Reviewer packet — Sonnet 4.6 privacy evidence

Status: `READY FOR REVIEW`

Scope: review new account-specific Sonnet 4.6 Bedrock privacy evidence and the proposed narrowing of the Opus 4.8 blocker.

Canonical parent: `docs/architecture/p05-provider-privacy-gate.md`
Evidence record in this PR: `docs/architecture/p05-provider-privacy-gate-sonnet46-live-evidence.md`

Reviewer tasks:

1. Verify AWS official sources support the inference that a successful Sonnet 4.6 invocation under account `none` is strong evidence that the exact route does not require retention.
2. Verify the evidence record does not overclaim final PASS; residency/profile confirmation remains pending.
3. Verify third-party Requesty claims are not used as authoritative evidence.
4. Verify Opus 4.8 is more accurately blocked by account/model access (`status: unavailable`, AWS Sales direction) than characterized as a demonstrated retention failure.
5. Verify Decision Boundary remains intact.

Decision Boundary: no provider/model selection, no implementation authorization, no permission to send LibEdge research queries, no D-016/Track A-B change, no reopening 0047/0049, no production work.

Fallback rule: if PR metadata is rate-limited, review this packet and the branch diff directly. Do not infer another PR.