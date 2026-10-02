# Assistant activation and rollback runbook

Status: PRE-ACTIVATION / FAIL-CLOSED
Scope: product operations only. This document does not authorize D-022 H2 authorship, checker acceptance, provider activation, staging activation, or production deployment.

## Current safe baseline

- Assistant UI is live-API wired and fail-closed.
- The exact AWS Bedrock Claude Sonnet 4.6 `us.` inference-profile route has a current Provider Privacy Gate `PASS`; no broader provider/model PASS is implied.
- Semantic-primary remains disabled.
- The Assistant router is wired to the accepted Fresh-Checker through the reviewed SageMaker supportCheck transport in staging and preserves fail-closed behavior.
- The grounding validator rejects generated claims when a `supportCheck` is absent or does not support the claim.
- Staging has accumulated authenticated/synthetic E2E, operational-pause, bounded latency/reliability and checker-invocation evidence during the R2 readiness work. Production authorization must still bind those results to one exact current release candidate or refresh them when the candidate/runtime materially differs.

## Preconditions before semantic activation

The Fresh-Checker qualification/freeze line is closed, but the separately preregistered 1,080-claim / 180-scenario H2 statistical holdout is not shown as executed or complete. The activation contract therefore distinguishes checker qualification from H2 production validation:

1. **COMPLETE — FRESH-CHECKER QUALIFICATION/FREEZE:** the exact candidate semantic `supportCheck` engine/rule line has a recorded qualification/freeze closure.
2. **DEFERRED BY D-023 — H2 STATISTICAL HOLDOUT:** the separately preregistered 1,080-claim / 180-scenario H2 holdout is not completed. D-023 explicitly defers it under monitored trigger conditions; it must not be represented as passed or waived.
3. **ADOPTED / EVIDENCED FOR THE CURRENT STAGING LINE — D-023 ACTIVATION ITEMS:** fail-closed checker error/timeout/invalid-result behavior, the operational pause mechanism, the English-only language boundary, and the prospective Trigger-B drift rule have been implemented/adopted through the reviewed staging work. Production authorization must still verify the applicable evidence against the exact candidate/runtime being authorized. A D-023 trigger can require the deferred holdout (or a separately preregistered independently reviewed successor protocol) later.
4. A separate production/deployment authorization explicitly approves the exact candidate checker/version to activate.
5. The exact provider route intended for deployment has a current PASS privacy-gate record applicable to that route.
6. Staging configuration and secrets required for authenticated smoke are available without placing credentials in source control.

Fresh-Checker qualification alone is neither H2 statistical-validation completion nor deployment authorization.

## Controlled staging activation sequence

Do not combine these into an unreviewed one-step production change.

1. Pin the exact authorized checker artifact/version and record its identity.
2. Wire that exact checker into the Assistant router as `supportCheck`.
3. Keep production unchanged.
4. Activate the approved provider route in staging only.
5. Run CI, integration tests, and an authenticated staging smoke.
6. For a successful live-answer smoke, require:
   - HTTP success from the Assistant endpoint;
   - `ok: true` and `code: OK`;
   - non-empty evidence payload where the query yields evidence;
   - every outward claim has valid evidence references;
   - no rejected/unsupported claim is rendered to the user;
   - fixture content remains hidden;
   - source/finding counts come from the live payload;
   - unavailable conflict/research-gap metrics remain hidden.
7. Exercise fail-closed cases in staging: provider gate blocked, missing adapter, invalid query, retrieval/evidence failure, malformed model output, missing support check, semantic rejection, and unexpected error.
8. Record the exact staging commit/config/checker/provider route and smoke result.
9. Only then consider a separately authorized production activation.

## Production activation

Production activation requires an explicit authorization tied to the exact reviewed commit, checker artifact/version, provider route, and configuration. Apply the smallest configuration/code change necessary. Immediately run the production-safe smoke/health checks defined for that authorization.

Do not infer production approval from a green CI run, H2 acceptance, staging success, or provider privacy PASS alone.

## Rollback triggers

Rollback/fail closed immediately if any of these occurs:

- semantic checker is missing, errors, or returns an invalid result;
- claims appear without valid evidence references;
- unsupported/rejected claims reach the UI;
- provider privacy status is not PASS for the exact active route;
- model output violates the expected contract;
- staging/production behavior differs materially from the authorized artifact/configuration;
- authenticated smoke fails after activation.

## Rollback target

Return to the known fail-closed baseline:

- provider gate not active for generation;
- semantic-primary disabled unless separately authorized;
- no unvalidated semantic checker accepted;
- Assistant returns a bounded non-success state with no outward claims;
- UI clears live/fixture result content and does not fabricate unavailable metrics.

After rollback, preserve privacy-safe diagnostic metadata only; do not log query text, claims, evidence content, credentials, user/session identifiers, or provider payloads.

## Evidence to retain for an activation decision

Retain the exact commit SHA, checker artifact/version/hash, provider route/model identifier, applicable privacy-gate record, CI run, authenticated smoke result, configuration diff, authorization record, and rollback result if exercised. Distinguish a skipped smoke from a passed smoke.


## 2026-09-27 Fresh-Checker closure and 2026-09-28 scope correction

The exact Fresh-Checker qualification/freeze line recorded on 2026-09-27 remains closed for its stated scope. The accepted engine is `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` at exact revision `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`. Qualification passed 11/12 with 3/3 deterministic complete runs; Stage B passed 11/12 semantic primary and 16/16 structural/fault checks; the historical final audit returned `ACCEPT_H2_CLOSURE` with no blocking defects within that Fresh-Checker line.

The 2026-09-28 scope reconciliation establishes that this Fresh-Checker result is not evidence that the separately preregistered 1,080-claim / 180-scenario H2 statistical holdout was completed. D-023, subsequently adopted on 2026-09-28, is the explicit human-authorized Path-B decision that defers that holdout under monitored trigger conditions. Production semantic activation is therefore not blocked merely because the deferred 1,080-claim holdout is unexecuted; it remains blocked until the still-open D-023 readiness items and separate production authorization are satisfied.

This historical closure did not, by itself, assert router wiring, authenticated staging live-answer success, or deployment authorization. Subsequent reviewed staging work has since wired the accepted checker and recorded authenticated/synthetic staging evidence as summarized in the current safe baseline above. Neither the historical closure nor that later staging evidence authorizes production activation.

Canonical records: `docs/d022-h2-final-status-2026-09-27.md` (historical Fresh-Checker closure) and `docs/d022-h2-holdout-scope-reconciliation-2026-09-28.md` (current scope correction).
