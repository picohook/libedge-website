# Research Assistant staging integration gates

Status: INTEGRATED ON STAGING — operational integration record/checklist only.

This checklist coordinates the product changes in PRs #142, #143, and #144. It does not amend D-022, implement or tune supportCheck, change provider privacy eligibility, or authorize production enablement.

## Integration record

1. **PR #142 — UI/live API boundary — MERGED**
   - `assistant.html` sends research requests only to same-origin `POST /api/assistant/ask`.
   - live success requires structured claims plus evidence.
   - fixture synthesis is hidden when live content is rendered.
   - external direct fetches from the Assistant UI remain prohibited.
   - merged after CI #940 PASS and review checks PASS.

2. **PR #143 — privacy-gated Bedrock adapter boundary — MERGED**
   - adapter is constructed only after Provider Privacy Gate status is PASS.
   - missing credentials remain fail-closed.
   - task + minimized EvidencePack are the provider input boundary.
   - semantic supportCheck remains mandatory downstream.
   - synchronized to current staging, then merged after CI #943 PASS and review checks PASS.

3. **PR #144 — privacy-safe observability — MERGED**
   - records only bounded outcome code, duration, and environment.
   - no query, claims, evidence, EvidencePack identifiers, user/session identifiers, credentials, or provider payloads.
   - synchronized on top of #143, then merged after CI #946 PASS.

## Staging smoke gates

The three integration PRs are merged. The checks below remain the required fail-closed staging verification before any user-visible grounded AI success path is enabled.

### Gate A — closed-state UI
With `RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS=UNVERIFIED`:
- authenticated Assistant request reaches `/api/assistant/ask`;
- response remains fail-closed at the provider privacy boundary;
- fixture synthesis is not presented as a live answer;
- no direct browser call is made to Bedrock or another model provider.

### Gate B — adapter remains non-authorizing
After #143:
- staging configuration remains `UNVERIFIED` unless a separate governed change explicitly authorizes PASS;
- no AWS secret is committed to the repository;
- no model call occurs while the gate is UNVERIFIED;
- absence of runtime credentials remains fail-closed.

### Gate C — observability minimization
After #144:
- outcome telemetry contains only event name, bounded code, duration, and environment;
- logs contain no query text, evidence, claims, user/session identifiers, EvidencePack IDs, credentials, or provider payloads.

## Gates intentionally left closed

The following are not prerequisites to merge the integration plumbing, but they are prerequisites to a user-visible grounded AI success response:

- production semantic `supportCheck` implementation and its separately governed acceptance;
- legitimate Provider Privacy Gate PASS for the exact configured route;
- required runtime credentials/secrets through the deployment secret mechanism;
- end-to-end staging verification of `OK + claims + evidence` after the above gates are legitimately available.

`RESEARCH_SEMANTIC_PRIMARY_ENABLED` remains unchanged by these PRs.

## Rollback rule

If any merged step breaks staging, leaks minimized-boundary data, bypasses a fail-closed gate, or causes fixture content to appear as live output, stop the sequence and revert that step before continuing.
