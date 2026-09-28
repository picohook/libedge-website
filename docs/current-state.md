# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current workstream priority

- `ACTIVE`: **AI Assistant staging development and evidence-first UI**.
- `ACTIVE`: **AI Assistant PASS-route capability/cost/latency evaluation preparation**. Evaluation is downstream of the Provider Privacy Gate and is not model selection or deployment authorization.
- `ENDED / INSUFFICIENT EVIDENCE`: **Semantic-primary Track A production observation attempt (D-016)**. The authorized 168-hour window ran, but the required full-window evidence was not durably retained; broad semantic enablement therefore remains blocked. A rerun is deferred until go-live planning approaches and must use durable evidence capture configured before the window starts. Semantic-primary remains OFF.
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

The authorized Track A observation attempt is **ENDED / INSUFFICIENT EVIDENCE**. The window was validly authorized and started, but the evidence required for a valid capacity conclusion was written only to native Cloudflare Workers Logs and was not preserved in a durable full-window export. The historical attempt therefore cannot be classified PASS/CLOSED.

Disposition: **INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED**. A future rerun is deferred until semantic-primary go-live planning approaches; before any rerun starts, durable evidence capture/export must be separately reviewed and configured.

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

A future observation rerun requires explicit authorization. It must not rely on ephemeral native-log retention as the sole full-window evidence store.

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
11. Track A is not currently running. Any future rerun requires explicit review/authorization and durable full-window evidence capture configured before start.
12. Zero-hallucination commitment — the exact frozen Fresh-Checker qualification/freeze line is CLOSED / PASS / FINAL / LOCKED, but the separately preregistered 1,080-claim / 180-scenario H2 statistical holdout is not shown as executed or complete. Production semantic activation may not treat Fresh-Checker qualification alone as completion of the D-022 false-positive validation gate.

## D-023 / Assistant readiness progress

D-023 Path B is **ADOPTED**, but production activation remains unauthorized.

Verified implementation progress:

- PR #200 added real-chain fail-closed CI/integration coverage for supportCheck HTTP error, invalid result, timeout, and kill-switch behavior.
- The staging operational-pause exercise required by D-023 open item #1 remains outstanding and must be exercised only when checker runtime/privacy prerequisites and staging authorization are satisfied.
- PR #202 removed outward `rejected_claims` exposure from the current all-or-nothing failure response. This is a D-020/current-contract compliance fix, not closure of D-023 open item #1.
- D-023 open item #2 language scope is now defined and independently accepted as **English-only** for the validated supportCheck path; Turkish and other non-English languages remain outside authorized checker scope until separately validated.
- D-023 open item #3 prospective Trigger-B drift rule is now defined and independently accepted; aggregate drift alone remains an investigation signal and requires the adopted confirmation/escalation path.
- The supportCheck runtime/privacy candidate architecture and AI Assistant Product Readiness Gate are independently accepted and merged. Checker-specific privacy qualification, exact runtime implementation, staging operational-pause exercise, authenticated staging E2E, and release-candidate evidence remain downstream before any production activation.

## Product version baseline

LibEdge product baseline `0.9.0` is adopted. Canonical machine-readable version source: `VERSION`. Product-version governance: `VERSION.md`; release ledger: `CHANGELOG.md`. This baseline does not authorize production deployment or go-live.

## NEXT

1. Qualify the exact supportCheck runtime/hosting route against the checker-specific privacy checklist; do not set the privacy gate to PASS from generic provider documentation alone.
2. Implement the exact accepted runtime route only after its route/configuration boundary is reviewable, preserving the frozen checker identity and fail-closed defaults.
3. Exercise the D-023 operational-pause mechanism in staging when runtime/privacy prerequisites are satisfied, then complete authenticated staging E2E.
4. Collect the Product Readiness release-candidate evidence: safe rejection UX, latency/reliability/cost, rollback behavior, and rollout scope.
5. Keep the adopted English-only checker boundary enforced; non-English expansion requires separate prospective validation.
6. Keep Track A broad semantic enablement blocked; defer its rerun until go-live planning approaches, then require durable evidence capture before start.
7. Keep `Research Gaps` fixture-only unless a separate minimized rejection-summary contract is reviewed and accepted.
8. Keep semantic-primary OFF and production D1 migrations paused until their separate authorization chains complete.
9. Keep this file and `docs/decisions.md` synchronized whenever a material project-state decision changes.

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

## D-022 Fresh-Checker qualification vs. H2 statistical holdout

The exact Fresh-Checker qualification/freeze line is **CLOSED / PASS / FINAL / LOCKED** for its recorded scope. The accepted frozen architecture uses a blocking primary decision of `SUPPORT` vs `NOT_SUPPORTED`; `CONTRADICTS` vs `NOT_SUPPORTING` remains diagnostic and non-blocking.

Selected semantic engine:

- model: `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli`;
- exact revision: `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`;
- qualification: **11/12 PASS**, deterministic **3/3**;
- Stage B: **11/12 semantic primary PASS + 16/16 structural/fault PASS**;
- final independent audit: **ACCEPT_H2_CLOSURE** as historically named in the Fresh-Checker record;
- blocking defects within that qualification record: **NONE**.

Frozen Fresh-Checker limitations remain part of the record: TC11 is the sole primary semantic miss; NOT_SUPPORTING diagnostic accuracy is 0.50 against a non-blocking 0.80 reporting target; TC06 and TC12 have correct primary NOT_SUPPORTED outcomes with diagnostic subtype disagreement. No post-result semantic rule change is authorized.

**Scope correction:** the earlier H2 successor holdout preregistration merged in PR #132 defines a separate 1,080-claim / 180-scenario statistical holdout. The later Fresh-Checker A1/A2/B materials state that H2 authorship/evaluation remains CLOSED throughout those stages and may open only after the checker qualification/freeze/governance sequence. No canonical evidence currently shows that the 1,080-claim holdout was authored, rated, frozen, executed, cancelled, or superseded.

**Operational consequence:** Fresh-Checker qualification is closed, but D-022 production false-positive validation is **not complete** merely from that qualification. Production semantic activation remains blocked until the accepted H2 statistical holdout is completed and independently reviewed, or a future prospective independently reviewed decision explicitly replaces that production-validation requirement. This does not reverse the Fresh-Checker qualification result.

Canonical records:

- `docs/d022-h2-final-status-2026-09-27.md` — historical Fresh-Checker qualification closure;
- `docs/d022-h2-master-final-release-2026-09-27.md` — historical Fresh-Checker release summary;
- `docs/d022-h2-vnext-provenance-reconciliation-2026-09-28.md` — provenance limitations;
- `docs/d022-h2-holdout-scope-reconciliation-2026-09-28.md` — current scope reconciliation;
- `docs/experiments/d022-supportcheck-h2-preregistration-v0.1.md` — 1,080-claim H2 successor holdout preregistration;
- `docs/assistant-activation-runbook.md`.

Repository-evidence caveat: the final closure and master-release summaries are committed, but the raw external execution records named by those summaries (including the Stage-B and final-audit job outputs) are not currently committed as first-class repository artifacts. Do not represent repository provenance as complete until those raw records are imported and hash-linked. This provenance gap does not silently convert the historical v0.3 isolation gate to PASS; that gate remains a historical OPEN/NOT SATISFIED record, while the accepted successor line is the separately governed v0.4.x A1/A2/B path.

Last updated: 2026-09-28
