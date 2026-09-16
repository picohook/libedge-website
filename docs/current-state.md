# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current workstream priority

- `ACTIVE`: **AI Assistant staging development and evidence-first UI**.
- `ACTIVE / SEPARATE`: **Semantic-primary Track A production observation window (D-016)**. The 168-hour observation window is currently running under the reviewed minimized-logging configuration. Semantic-primary itself remains OFF.
- `PAUSED`: **Production/go-live execution**, including the accepted G0-G9 go-live checklist and production D1 migration reconciliation. This remains paused except for the separately authorized Track A observability work already executed.

## AI Assistant architecture

The AI Assistant architecture is no longer pre-implementation only. The staging codebase now contains the reviewed evidence-grounding/orchestration layers, response-contract work, fail-closed UI state mapping, and evidence-first fixture UI.

Two P0 invariants remain governing:

1. **Evidence grounding** — no unsupported claim is rendered as grounded output; grounding remains all-or-nothing for the current live contract.
2. **Research-interest privacy** — no provider/model route may receive research-interest-bearing content until the Provider Privacy Gate passes for the exact model + endpoint + hosting route.

Canonical records:

- `docs/architecture/p05-ai-assistant-architecture-v0.1.md`
- `docs/architecture/p05-assistant-response-contract-v0.1.md`
- `docs/architecture/p05-assistant-research-gaps-ui-boundary.md`
- `docs/architecture/p05-provider-privacy-gate.md`

### Current live-provider state

No provider/model has received final production authorization.

The strongest candidate remains AWS Bedrock Claude Sonnet 4.6, but its gate is still fail-closed:

`PASS CANDIDATE — STRONGEST EVIDENCE / FINAL CONFIRMATION PENDING`

Open blocker:

`Sonnet 4.6 implicit prompt-cache/KV state under effective data_retention_mode: none — ZDR scope remains OPEN / UNVERIFIED.`

AWS Support has confirmed that no documented account/project-level opt-out exists for implicit caching. A written escalation asking whether the transient cache state is retained Customer Data and how it is isolated remains the final confirmation path. Anthropic support has stated that Bedrock-side retention/caching is AWS-controlled; Anthropic is not a separate authority for that Bedrock configuration.

Until the gate passes, live `/api/assistant/ask` behavior must remain fail-closed. UI work may continue only without silently bypassing that boundary.

## Assistant UI / product state

The staging UI is an **evidence-first prototype**. Fixture content is explicitly labeled as fixture/prototype data and must not be confused with live provider output.

Current UI boundaries:

- `PROVIDER_PRIVACY_GATE_REQUIRED`, `MODEL_ADAPTER_REQUIRED`, and `EVIDENCE_PAYLOAD_REQUIRED` remain explicit non-success states.
- A live `OK` response without an `evidence` array is fail-closed.
- `Research Gaps` remains fixture/conceptual only. No `rejected_claims` or partial-grounding API exposure is authorized.
- The current grounding contract remains all-or-nothing.
- Live transport is not to be silently recreated merely to support fixture UX.

Current active UI work is fixture-only evidence interaction, source-panel behavior, loading/error polish, and accessibility.

## D-016 semantic-primary status

P0.5 is closed and D-016 remains `LOCKED` for the existing top-10 research-result contract:

- semantic S primary;
- lexical L only as objective availability fallback/rollback;
- valid empty/short semantic results do not trigger lexical fallback;
- H is not adopted;
- semantic-primary remains OFF until separately authorized.

Current flags:

- staging semantic-primary: `OFF`;
- production semantic-primary: `OFF`.

No production D1 migration is authorized by the current Track A work.

## Track A — production traffic / capacity evidence

Track A is currently in its **168-hour production observation window**.

Locked broad-enablement condition:

`peak eligible research-query rate <= 0.5 requests/second`.

The earlier observability design was revised after real persisted logs revealed excessive Cloudflare invocation metadata. The production configuration now uses minimized custom logging with automatic invocation logs disabled.

Verified application payload fields are limited to:

- `event`;
- `timestamp_bucket`;
- `path_class`;
- `status_class`;
- `duration_ms`.

Independent read-only inspection established:

`PASS WITH RESIDUAL PLATFORM METADATA — ACCEPTED`.

Residual Cloudflare platform metadata includes fixed-route request method/path/redacted URL plus operational IDs such as request/ray/trace/span identifiers. This acceptance is **endpoint-specific** to the fixed `/api/research/search` route and must not be generalized to parameterized/user-content-bearing paths. Operational IDs carry a low, non-zero correlation risk if joined with richer logs elsewhere.

The decision not to move to `persist:false` + external OTEL is reversible. Reopen if policy becomes stricter, B2C becomes a concrete roadmap item, residual metadata expands, or correlation risk changes.

The observation window may be interrupted/restarted only through explicit review if production observability/logging behavior materially changes.

Canonical record:

`docs/architecture/p05-production-observability-metadata-minimization.md`

## Track B — production D1 telemetry migration preparation

Track B remains `SEPARATE` and production migration execution remains `PAUSED`.

Intended D-016 migration:

`migrations/0048_research_telemetry_counters.sql`

Production has a pending migration backlog beginning at `0042`; arbitrary pending migrations cannot be skipped through the normal D1 migration mechanism. Reconciliation therefore remains a separate gate before any eventual production migration execution.

Canonical audit:

`docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`

## 0047 / 0049 privacy and deletion-policy closure

The staging deletion-policy work remains `CLOSED — BEHAVIORAL PASS` and is not reopened without contradictory evidence.

- PR #37 fixed source-order behavior around the 0047 deletion audit path.
- PR #38 / migration 0049 added the explicit `user_notifications` deletion policy.
- Controlled staging deletion verification covered both admin and self paths.

## Locked constraints still active

1. Provider Privacy Gate precedes capability/cost/latency comparison and model selection.
2. Research-interest privacy and evidence grounding remain P0 invariants.
3. Semantic-primary remains OFF until separately reviewed rollout authorization.
4. Broad semantic enablement remains blocked without accepted `<=0.5 req/s` production evidence.
5. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
6. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
7. Production D1 migration and semantic-primary enablement remain separate decisions.
8. Research Gaps live data exposure requires a separate minimized contract review; fixture UI is not authorization to expose rejected claims.
9. Production observability metadata acceptance is endpoint-specific and reversible.
10. No active Track A logging/config change is allowed during the 168-hour window without explicit review.
11. Zero-hallucination commitment — see D-022; any production `supportCheck` selection requires a documented, measurable false-positive criterion before authorization.

## NEXT

1. Preserve the active 168-hour Track A observation window; review anomalies immediately and otherwise evaluate the complete window at closure.
2. Await the authoritative AWS response on Sonnet 4.6 implicit cache/ZDR scope; do not promote the provider gate early.
3. Continue low-risk fixture/evidence-first UI work while keeping all live fail-closed states maintained.
4. Keep `Research Gaps` fixture-only unless a separate minimized rejection-summary contract is reviewed and accepted.
5. Keep semantic-primary OFF and production D1 migrations paused until their separate authorization chains complete.
6. Keep this file and `docs/decisions.md` synchronized whenever a material project-state decision changes.

## Canonical records

- Decisions: `docs/decisions.md`
- AI Assistant architecture: `docs/architecture/p05-ai-assistant-architecture-v0.1.md`
- Assistant response contract: `docs/architecture/p05-assistant-response-contract-v0.1.md`
- Research Gaps UI boundary: `docs/architecture/p05-assistant-research-gaps-ui-boundary.md`
- Provider Privacy Gate: `docs/architecture/p05-provider-privacy-gate.md`
- Locked retrieval architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production observability metadata minimization: `docs/architecture/p05-production-observability-metadata-minimization.md`
- Production capacity evidence: `docs/architecture/p05-production-capacity-evidence-discovery.md`
- Production D1 migration preparation: `docs/architecture/p05-production-d1-migration-preparation.md`
- Production pending-migration audit: `docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-16
