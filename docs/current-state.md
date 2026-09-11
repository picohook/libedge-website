# LibEdge — Current State

Status: `ACTIVE`

> CONTROL-PLANE INVARIANT
> This file is written only from the main engineering thread, under human gatekeeper authority.
> Reviewer and blind-evaluator threads produce findings only; their outputs must return to the main thread before any project-state change is recorded.

## Current phase

P0.5 experimental sequence is **CLOSED / independently verified**. H is rejected. D-016 is **LOCKED** for the existing top-10 research-result contract: semantic S primary, lexical L only as objective availability fallback/rollback.

The controlled staging semantic retry v2 **PASSED** and was independently **ACCEPTED**. Live pacing enforcement was observed (`semantic_pacing_wait_ms_total +1500`), no new semantic `429` occurred, D1 telemetry remained internally exact under the controlled pair, and the staging flag was immediately returned to OFF.

Current semantic-primary flags:

- staging: `OFF`;
- production: `OFF`.

The reviewer has classified next rollout-stage preparation **ACCEPTED WITH MODIFICATION**. Track A now has two explicit evidence-quality requirements:

1. temporal resolution must be per-request or no coarser than `2 seconds`;
2. the source must be complete/unsampled enough that the observed peak cannot be understated. For Cloudflare Workers Logs, effective `head_sampling_rate = 1.0` must be verified, unless equivalent complete unsampled capture is independently proven.

Any source that is coarser, sampled below 100%, has unknown sampling, or has otherwise unquantified incompleteness is insufficient for the locked `<=0.5 requests/second` broad-enablement guardrail.

The project is authorized only for two preparation/evidence tracks that do not change production behavior:

1. **Track A — production traffic/capacity evidence-source discovery and evidence collection**;
2. **Track B — production D1 migration execution planning and reviewer-packet preparation**.

No production migration or production semantic enablement is authorized.

## Independently verified controlled semantic retry — PASS / ACCEPTED

Canonical PASS record:

`docs/reviews/2026-09-11-d016-controlled-semantic-retry-pass.md`

Canonical closure acceptance:

`docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`

Observed mechanical deltas:

- `research_requests +2`;
- `semantic_attempts +2`;
- `semantic_successes +2`;
- `semantic_429 +0`;
- `semantic_pacing_wait_ms_total +1500`;
- `semantic_charged_responses +2`;
- `semantic_cost_microusd_total +2000`;
- `semantic_credits_total +20`;
- `lexical_fallback_attempts +0`;
- `lexical_fallback_successes +0`.

The single-retry boundary was respected. Staging was disabled immediately afterward. Production was never enabled.

## Finding status

### CLOSED

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction.
2. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race.

### ACKNOWLEDGED / DEFERRED

3. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk.
4. Shared-core-D1 telemetry failure-domain coupling — revisit before broad enablement if measured write QPS/latency/contention suggests material impact.
5. Wrangler declarative `exports` migration path — revisit only during a deliberate toolchain upgrade.

## Track A — production traffic / capacity evidence

Locked broad-enablement condition:

`peak eligible research-query rate <= 0.5 requests/second`.

Accepted evidence standard:

- per-request timestamps; or privacy-safe time buckets no coarser than `2 seconds`;
- complete/unsampled capture sufficient to avoid understating the peak;
- for Cloudflare Workers Logs, effective `head_sampling_rate = 1.0`, unless equivalent complete capture is independently demonstrated;
- source must isolate eligible research requests;
- no query text, user identity, research topic, result content, DOI/title, or raw request body may be exposed or persisted for this purpose.

Daily totals, daily averages, minute-level averages, other sources coarser than 2-second buckets, sampled sources below 100%, unknown sampling states, or unquantified incomplete sources do **not** support the peak-rate claim.

If no acceptable source exists, the required conclusion is:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

Canonical preparation record:

`docs/architecture/p05-production-rollout-stage-preparation.md`

Evidence-source discovery:

`docs/architecture/p05-production-capacity-evidence-discovery.md`

Reviewer follow-up:

`docs/reviews/2026-09-11-d016-next-rollout-stage-preparation-followup.md`

Current discovery result:

- existing D1 daily telemetry: `INSUFFICIENT`;
- repository-proven Analytics Engine source: none;
- Cloudflare Workers Logs/native invocation logs: candidate only; production account state, temporal resolution, endpoint isolation, and effective sampling/completeness remain to be verified.

## Track B — production D1 telemetry migration preparation

Migration under consideration:

`migrations/0048_research_telemetry_counters.sql`

No production migration has been applied.

Before any execution request, the planning packet must independently demonstrate:

1. production semantic-primary remains OFF;
2. the intended production D1 binding is confirmed;
3. migration file is byte-identical to the staging-reviewed migration;
4. pending production migrations are listed before apply;
5. any unexpected pending migration is a hard STOP;
6. no semantic enablement is bundled with migration;
7. recovery/verification expectations are documented in advance.

Successful migration alone would not authorize semantic-primary production enablement.

## Locked rollout constraints still active

1. Semantic-primary remains OFF until a separately reviewed rollout decision.
2. Valid empty/short S does not trigger L.
3. L fallback remains objective-only; no content/count/relevance/topic routing.
4. Semantic request starts remain globally paced through the dedicated pacing Durable Object at `1500 ms` minimum spacing.
5. Broad enablement remains blocked unless peak eligible research-query rate is documented `<=0.5 requests/second` using the accepted temporal-resolution and completeness standard.
6. D-013 checkpoint remains first `1,000` charged semantic responses or `7 days`, whichever occurs first.
7. Capacity/cost/availability telemetry stores no query text, topics, research interests or user IDs.
8. P0.5 holdouts/labels are not reused for rollout relevance retuning.
9. Top-10 scope only; no deep-pagination/exhaustive-recall superiority claim.
10. Production D1 migration remains a separate migration-first proposal and review sequence.
11. Production semantic enablement remains a separate later decision.

## NEXT

Proceed in parallel only with non-behavior-changing preparation:

1. **Track A:** verify whether the production Worker already has an existing operational source that provides eligible research-request timing at per-request or `<=2-second` resolution and complete/unsampled capture. For Workers Logs, verify effective `head_sampling_rate = 1.0`; do not infer dashboard-side state from repository configuration.
2. **Track A:** if a suitable existing source exists, prepare an independently reviewable capacity evidence record. If not, record `INSUFFICIENT EVIDENCE` and identify what separately reviewed instrumentation would be needed.
3. **Track B:** inspect the production D1 binding and migration state without applying changes; prepare a full reviewer packet for migration execution only.
4. Do not apply production migration, enable semantic-primary, or perform another semantic retry without separate authorization.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production rollout-stage preparation: `docs/architecture/p05-production-rollout-stage-preparation.md`
- Capacity evidence-source discovery: `docs/architecture/p05-production-capacity-evidence-discovery.md`
- Rollout-stage reviewer follow-up: `docs/reviews/2026-09-11-d016-next-rollout-stage-preparation-followup.md`
- Controlled semantic retry PASS: `docs/reviews/2026-09-11-d016-controlled-semantic-retry-pass.md`
- Controlled semantic retry closure acceptance: `docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`
- Telemetry atomicity architecture: `docs/architecture/p05-research-telemetry-atomicity-correction.md`
- Telemetry atomicity implementation: `docs/architecture/p05-research-telemetry-atomicity-implementation.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
