# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current workstream priority

- `ACTIVE`: **AI Assistant staging development and evidence-first UI**.
- `ACTIVE`: **AI Assistant PASS-route capability/cost/latency evaluation preparation**. Evaluation is downstream of the Provider Privacy Gate and is not model selection or deployment authorization.
- `ACTIVE / SEPARATE`: **Semantic-primary Track A production observation window (D-016)**. The 168-hour observation window is running under the reviewed minimized-logging configuration. Semantic-primary itself remains OFF.
- `PAUSED`: **Production/go-live execution**, including the accepted G0-G9 go-live checklist and production D1 migration reconciliation. This remains paused except for the separately authorized Track A observability work already executed.

## AI Assistant architecture

The AI Assistant architecture is implemented at the reviewed staging boundary: evidence-pack/orchestration layers, response-contract work, fail-closed UI state mapping, and evidence-first fixture UI are present in the staging codebase.

Two P0 invariants remain governing:

1. **Evidence grounding** — no unsupported claim is rendered as grounded output; grounding remains all-or-nothing for the current live contract.
2. **Research-interest privacy** — no provider/model route may receive research-interest-bearing content unless the Provider Privacy Gate has passed for the exact model + endpoint + hosting route.

Canonical records:

- `docs/architecture/p05-ai-assistant-architecture-v0.1.md`
- `docs/architecture/p05-assistant-response-contract-v0.1.md`
- `docs/architecture/p05-assistant-research-gaps-ui-boundary.md`
- `docs/architecture/p05-provider-privacy-gate.md`

### Current live-provider state

No provider/model has received final model-selection or production authorization.

The exact reviewed AWS Bedrock Claude Sonnet 4.6 route has passed the Provider Privacy Gate:

`PASS`

PASS scope is limited to:

- model: AWS Bedrock `anthropic.claude-sonnet-4-6`;
- inference profile: `us.anthropic.claude-sonnet-4-6`;
- route: `bedrock-runtime` / `InvokeModel`;
- effective data-retention mode: `none`;
- baseline implicit prompt caching with no explicit cache controls supplied.

The former implicit prompt-cache/KV ZDR blocker is closed. AWS Support / Bedrock-SME evidence dated 2026-09-16 confirms that, for this exact route under effective retention mode `none`, implicit prompt-cache state is ephemeral, memory-only, account-isolated, TTL-based, and does not count as retained Customer Data under the reviewed ZDR boundary. Supplemental AWS Support correspondence also records fail-closed retention enforcement: if the effective retention configuration is incompatible with a model requirement, Bedrock blocks the request rather than silently relaxing the retention mode.

This PASS is not provider-wide, does not apply to other Bedrock models/endpoints/inference profiles or optional features, and does not constitute model selection, production deployment authorization, or a general GDPR/HIPAA/FedRAMP claim.

Canonical evidence:

- `docs/architecture/p05-provider-privacy-gate.md`
- `docs/architecture/p05-provider-privacy-gate-sonnet46-aws-caching-final-evidence.md`
- `docs/architecture/p05-provider-privacy-gate-sonnet46-aws-support-compliance-followup.md`

The mandatory sequence is now at the next stage:

`privacy eligibility -> PASS candidate pool -> capability/cost/latency evaluation -> model selection`

Only exact routes with `PASS` may enter the evaluation pool.

## Assistant UI / product state

The staging UI remains an **evidence-first prototype**. Fixture content is explicitly labeled as fixture/prototype data and must not be confused with live provider output.

Current UI boundaries:

- `PROVIDER_PRIVACY_GATE_REQUIRED`, `MODEL_ADAPTER_REQUIRED`, and `EVIDENCE_PAYLOAD_REQUIRED` remain valid fail-closed states for routes/configurations where those conditions apply.
- A live `OK` response without an `evidence` array is fail-closed.
- `Research Gaps` remains fixture/conceptual only. No `rejected_claims` or partial-grounding API exposure is authorized.
- The current grounding contract remains all-or-nothing.
- Passing the privacy gate does not by itself authorize live provider transport or model selection.

Current active UI work is fixture-only evidence interaction, source-panel behavior, loading/error polish, and accessibility.

## Frontend translation architecture note

LibEdge currently has more than one translation mechanism. The site-wide attribute-based translation path remains the default, while `profile.html` has a page-local dictionary/walker because it must preserve user-owned values across repeated language toggles.

`announcements.html` is a recorded page-specific exception. Its announcement cards and modal content are rendered by the inline `AnnouncementManager`, and engagement/newsletter UI is created or replaced dynamically after API responses. For that dynamic surface, `assets/js/announcements-i18n.js` extends the existing manager at runtime rather than introducing translation into user-owned comment/name fields or rewriting the working manager implementation. The extension is loaded only on `announcements.html`; its exact-match Turkish source strings are guarded by `test/frontend/announcements-i18n-source-contract.test.js` so source-copy changes fail CI instead of silently losing English localization.

This exception is not a new site-wide translation standard. New pages should continue to use the established site-wide mechanism unless a page-specific dynamic-content constraint is documented and reviewed.

## Recently closed staging evidence

Two unrelated staging reliability items are closed with real execution evidence:

- **Profile translation protection (#102):** user-owned profile name and link labels are protected from UI translation while fallback labels remain translatable. Real Chromium and mobile-Chromium Playwright behavior tests passed on the PR's final content.
- **Pages deployment pipeline (#107 + #108):** Node 22 plus npm `11.6.0` alignment resolved the deployment workflow failure. On exact staging SHA `687750fe4b553e22e2e45332995ce157f7ed8ef1`, both `Quality gate` and `Deploy Pages to staging` completed successfully.

These closures do not alter the AI privacy/evidence invariants.

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

Track A remains in its **168-hour production observation window** under the reviewed minimized-logging configuration.

Locked broad-enablement condition:

`peak eligible research-query rate <= 0.5 requests/second`.

Verified application payload fields are limited to:

- `event`;
- `timestamp_bucket`;
- `path_class`;
- `status_class`;
- `duration_ms`.

Independent read-only inspection established:

`PASS WITH RESIDUAL PLATFORM METADATA — ACCEPTED`.

Residual Cloudflare platform metadata includes fixed-route request method/path/redacted URL plus operational IDs such as request/ray/trace/span identifiers. This acceptance is **endpoint-specific** to the fixed `/api/research/search` route and must not be generalized to parameterized/user-content-bearing paths. Operational IDs carry a low, non-zero correlation risk if joined with richer logs elsewhere.

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

1. Provider Privacy Gate precedes capability/cost/latency comparison and model selection; only exact PASS routes enter that pool.
2. A Provider Privacy Gate PASS is eligibility only; it is not model selection or deployment authorization.
3. Research-interest privacy and evidence grounding remain P0 invariants.
4. Semantic-primary remains OFF until separately reviewed rollout authorization.
5. Broad semantic enablement remains blocked without accepted `<=0.5 req/s` production evidence.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. Production D1 migration and semantic-primary enablement remain separate decisions.
9. Research Gaps live data exposure requires a separate minimized contract review; fixture UI is not authorization to expose rejected claims.
10. Production observability metadata acceptance is endpoint-specific and reversible.
11. No active Track A logging/config change is allowed during the 168-hour window without explicit review.
12. Zero-hallucination commitment — see D-022; any production `supportCheck` selection requires a documented, measurable false-positive criterion before authorization.

## NEXT

1. Preregister the AI Assistant capability/cost/latency evaluation before observing comparative results. Admit only exact Provider Privacy Gate PASS routes; keep evaluation separate from model selection and deployment authorization.
2. Preserve the active 168-hour Track A observation window; review anomalies immediately and otherwise evaluate the complete window at closure.
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
- Sonnet 4.6 final caching evidence: `docs/architecture/p05-provider-privacy-gate-sonnet46-aws-caching-final-evidence.md`
- Sonnet 4.6 AWS Support compliance follow-up: `docs/architecture/p05-provider-privacy-gate-sonnet46-aws-support-compliance-followup.md`
- Locked retrieval architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production observability metadata minimization: `docs/architecture/p05-production-observability-metadata-minimization.md`
- Production capacity evidence: `docs/architecture/p05-production-capacity-evidence-discovery.md`
- Production D1 migration preparation: `docs/architecture/p05-production-d1-migration-preparation.md`
- Production pending-migration audit: `docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-17