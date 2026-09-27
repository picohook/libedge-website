# Assistant activation and rollback runbook

Status: PRE-ACTIVATION / FAIL-CLOSED
Scope: product operations only. This document does not authorize D-022 H2 authorship, checker acceptance, provider activation, staging activation, or production deployment.

## Current safe baseline

- Assistant UI is live-API wired and fail-closed.
- The exact AWS Bedrock Claude Sonnet 4.6 `us.` inference-profile route has a current Provider Privacy Gate `PASS`; no broader provider/model PASS is implied.
- Semantic-primary remains disabled.
- The Assistant router does not currently inject a semantic `supportCheck`.
- The grounding validator rejects generated claims when a `supportCheck` is absent.
- The current fail-closed staging baseline has not yet recorded the authenticated end-to-end live-answer smoke required after checker integration.

## Preconditions before semantic activation

The Fresh-Checker qualification/freeze line is closed, but the separately preregistered 1,080-claim / 180-scenario H2 statistical holdout is not shown as executed or complete. The activation contract therefore distinguishes checker qualification from H2 production validation:

1. **COMPLETE — FRESH-CHECKER QUALIFICATION/FREEZE:** the exact candidate semantic `supportCheck` engine/rule line has a recorded qualification/freeze closure.
2. **OPEN — H2 STATISTICAL HOLDOUT GATE:** the canonical authorship/freeze gate for the separately preregistered 1,080-claim / 180-scenario H2 holdout is not established here as completed.
3. **OPEN — H2 FALSE-POSITIVE VALIDATION:** the 1,080-claim H2 holdout is not shown as authored, rated, frozen, executed, or independently accepted. The historical Fresh-Checker final-audit verdict does not substitute for this statistical holdout.
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

The 2026-09-28 scope reconciliation establishes that this Fresh-Checker result is not evidence that the separately preregistered 1,080-claim / 180-scenario H2 statistical holdout was completed. Production semantic activation therefore remains blocked on the open H2 false-positive-validation gate unless a future prospective independently reviewed decision explicitly replaces that requirement.

This does not assert that the checker is already wired into the Assistant router, that an authenticated staging live-answer smoke has passed, or that staging/production activation is authorized.

Canonical records: `docs/d022-h2-final-status-2026-09-27.md` (historical Fresh-Checker closure) and `docs/d022-h2-holdout-scope-reconciliation-2026-09-28.md` (current scope correction).
