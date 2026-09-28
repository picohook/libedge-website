# Assistant staging smoke stages

`scripts/assistant-smoke.mjs` is an authenticated fail-closed smoke test. Its expected machine state must be supplied explicitly as staging progresses.

Default remains:

`PROVIDER_PRIVACY_GATE_REQUIRED`

After the reviewed staging provider gate is deployed but before usable model credentials are present, run with the exact expected fail-closed state observed for that configuration (for example `MODEL_ADAPTER_REQUIRED`).

When the answer-provider path and checker prerequisites are intentionally enabled for an authorized staging exercise, do not weaken this smoke into “any failure is fine”. Record the exact expected code for the release-candidate configuration, then run the separate positive E2E only under its reviewed prerequisites.

The query default is non-user-derived test content. Never pass a real user's research query to a staging smoke merely for validation.
