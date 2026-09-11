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

No production semantic enablement or production D1 migration is authorized.

## Track A — production traffic / capacity evidence

Locked broad-enablement condition:

`peak eligible research-query rate <= 0.5 requests/second`.

Accepted evidence standard:

- per-request timestamps; or privacy-safe time buckets no coarser than `2 seconds`;
- complete/unsampled capture sufficient to avoid understating the peak;
- for Cloudflare Workers Logs, effective `head_sampling_rate = 1.0`, unless equivalent complete capture is independently demonstrated;
- source must isolate eligible research requests;
- no query text, user identity, research topic, result content, DOI/title, or raw request body may be exposed or persisted for this purpose.

Human account-state inspection established that **Workers Observability is disabled** for the production Worker. Therefore no existing Workers Logs history can currently provide the required per-request / <=2-second unsampled production traffic evidence.

Current Track A result:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

This is not a relevance failure; it is an operational capacity-evidence blocker.

Canonical preparation record:

`docs/architecture/p05-production-rollout-stage-preparation.md`

Evidence-source discovery:

`docs/architecture/p05-production-capacity-evidence-discovery.md`

Reviewer follow-up:

`docs/reviews/2026-09-11-d016-next-rollout-stage-preparation-followup.md`

## Track B — production D1 telemetry migration preparation

Intended D-016 migration:

`migrations/0048_research_telemetry_counters.sql`

A read-only production inspection was completed against:

- binding: `DB`
- database_name: `libedge-db-production`
- database_id: `64e57edf-8163-4495-8874-fec00485b2ff`

Inspection run:

`34583816393`

Only `wrangler d1 migrations list DB --env production --remote` was executed. No migration apply command ran.

The production pending list is:

1. `0042_tunnel_alert_tracking.sql`
2. `0043_products_ra_cookie_mode.sql`
3. `0044_wiley_stable_host.sql`
4. `0045_add_clinicalkey_uptodate.sql`
5. `0046_add_ai_product_cards.sql`
6. `0047_user_deletion_integrity.sql`
7. `0048_research_telemetry_counters.sql`

This triggered the locked hard-STOP rule because `0042`-`0047` are unrelated earlier migrations that were not part of the D-016 telemetry migration proposal.

Current Track B result:

`STOP — DO NOT APPLY PRODUCTION D1 MIGRATIONS`.

The backlog has been separated into its own audit rather than being folded into D-016:

`docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`

Preliminary audit classification:

- `0042`: additive tunnel-alert schema; feature-state review required;
- `0043`: additive proxy cookie-mode schema; feature-state review required;
- `0044`: direct Wiley delivery-mode data/behavior change; separate production review required;
- `0045`: ClinicalKey/UpToDate product + RA/access configuration change; separate production review required;
- `0046`: user-visible AI product catalog change; separate product-scope production review required;
- `0047`: high-risk privacy/integrity deletion trigger touching many tables; dedicated privacy/integrity review required.

No assumption is made that these migrations are invalid. They are blocked from bulk application because their production context has not been independently established in this workstream.

The one-shot read-only inspection workflow was removed after successful use so it cannot be accidentally rerun as an operational control surface.

## 0047 dedicated privacy/integrity review

Read-only schema/code analysis found `0047-PRIVACY-01`: the admin user-deletion endpoint inserted a PII-bearing `admin_action_logs` deletion snapshot after `DELETE FROM users`, so the 0047 `BEFORE DELETE` trigger could not redact that newly-created row.

Status:

`FIX PREPARED / CODE REVIEW PENDING / NO LIVE DELETION AUTHORIZED`.

Draft PR:

`#37 — fix/0047-admin-delete-audit-order -> staging`

Base/head:

- base: `96880256f8c6e10db3e7c1106998fa14be660fff`
- head: `824b40a0224886e106a4697b9deeb0abc080d312`

The narrow fix only reorders the existing admin deletion batch so the deletion audit row is inserted before `DELETE FROM users`; migration 0047 itself is unchanged. A static regression guard was added.

PR CI run `34590565540` completed successfully:

- syntax/lint: PASS;
- unit tests: `23 files / 99 tests PASS`;
- `user-deletion-migration.test.js`: `3 tests PASS`;
- staging Wrangler dry-run: PASS;
- build: PASS.

One-time bot commit `bcc7ab518c7fe65144259ce34690ef7b38dcf181` is expected provenance from the controlled path-scoped patch workflow; the workflow removed itself and is absent from the final PR diff.

Canonical code-review packet:

`docs/reviews/2026-09-11-0047-privacy-01-code-review-request.md`

No PR merge, disposable staging account creation, live staging deletion, 0047 migration apply, production migration, or D-016 Track B resumption is authorized yet.

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

## Finding status

### CLOSED

1. `OOS-D016-CODE-01` — grant-time vs provider-fetch timing / account-wide rate-limit interaction.
2. `OOS-D016-TELEMETRY-01` — previous KV telemetry lost-update race.

### ACKNOWLEDGED / DEFERRED

3. `OOS-D016-CODE-02` — pre-existing non-atomic cache read/write stampede risk.
4. Shared-core-D1 telemetry failure-domain coupling — revisit before broad enablement if measured write QPS/latency/contention suggests material impact.
5. Wrangler declarative `exports` migration path — revisit only during a deliberate toolchain upgrade.

### OPEN / OUTSIDE D-016

6. Production D1 migration backlog `0042`-`0047` — separate audit required before D-016 Track B can resume.
7. `0047-PRIVACY-01` — source-order privacy defect; narrow fix prepared in PR #37 and awaiting independent code-review disposition before merge.

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

1. Obtain independent code-review disposition for PR #37 using `docs/reviews/2026-09-11-0047-privacy-01-code-review-request.md`.
2. Do not merge PR #37 until that review is accepted.
3. If accepted, merge only the narrow source/test/doc fix into `staging`; this still does not authorize a live deletion test.
4. Prepare a separate controlled staging deletion packet with production-equivalent schema confirmation, explicit synthetic fixtures, privacy post-state assertions, R2 queue checks, and predeclared performance/lock thresholds.
5. Keep D-016 Track B paused; do not bulk-apply `0042`-`0048`.
6. Track A remains blocked by insufficient production peak-rate evidence unless separately reviewed instrumentation/evidence is introduced.
7. Do not enable semantic-primary, apply production migrations, perform another semantic retry, retune relevance, adopt H/RRF, or introduce Vectorize without separate authorization.

## Canonical records

- Decisions: `docs/decisions.md`
- Locked architecture: `docs/architecture/p05-production-retrieval-decision.md`
- Production rollout-stage preparation: `docs/architecture/p05-production-rollout-stage-preparation.md`
- Capacity evidence-source discovery: `docs/architecture/p05-production-capacity-evidence-discovery.md`
- Production D1 telemetry migration preparation: `docs/architecture/p05-production-d1-migration-preparation.md`
- Production pending-migration audit: `docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`
- 0047 dedicated production review: `docs/reviews/2026-09-11-0047-user-deletion-integrity-production-review.md`
- 0047 read-only schema/code analysis: `docs/reviews/2026-09-11-0047-read-only-schema-code-analysis.md`
- 0047 narrow fix code-review packet: `docs/reviews/2026-09-11-0047-privacy-01-code-review-request.md`
- Controlled semantic retry PASS: `docs/reviews/2026-09-11-d016-controlled-semantic-retry-pass.md`
- Controlled semantic retry closure acceptance: `docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`
- Reviewer packet checklist: `docs/reviewer-packet-checklist.md`
- Research privacy: `docs/privacy/research-privacy.md`

Last updated: 2026-09-11
