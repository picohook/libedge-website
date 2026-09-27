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

D-022 items 1-3 below are now complete under the final locked H2 record. They remain listed to preserve the activation contract. All remaining activation conditions must still be satisfied before changing the current fail-closed baseline:

1. **COMPLETE — D-022 H2 FINAL / LOCKED:** candidate semantic `supportCheck` implementation is isolated from H2 holdout authorship and rating.
2. **COMPLETE — D-022 H2 FINAL / LOCKED:** D-022 H2 prerequisites and canonical authorship gate are complete.
3. **COMPLETE — D-022 H2 FINAL / LOCKED:** frozen H2 evaluation and required independent validation are complete under the frozen rules; final independent audit verdict is `ACCEPT_H2_CLOSURE` with no blocking defects.
4. A separate production/deployment authorization explicitly approves the exact candidate checker/version to activate.
5. The exact provider route intended for deployment has a current PASS privacy-gate record applicable to that route.
6. Staging configuration and secrets required for authenticated smoke are available without placing credentials in source control.

H2 success alone is not deployment authorization.

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


## 2026-09-27 control-plane reconciliation

D-022 H2 is now `CLOSED / PASS / FINAL / LOCKED`. The accepted engine is `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` at exact revision `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`. Qualification passed 11/12 with 3/3 deterministic complete runs; Stage B passed 11/12 semantic primary and 16/16 structural/fault checks; the final independent audit returned `ACCEPT_H2_CLOSURE` with no blocking defects.

This reconciliation changes prerequisite status only. It does not assert that the checker is already wired into the Assistant router, that an authenticated staging live-answer smoke has passed, or that staging/production activation is authorized. The controlled staging sequence above remains governing.

Canonical closure record: `docs/d022-h2-final-status-2026-09-27.md`.
