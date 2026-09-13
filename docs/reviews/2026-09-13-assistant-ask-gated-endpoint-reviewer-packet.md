# Reviewer packet — provider-gated `/api/assistant/ask`

Date: 2026-09-13
Branch: `feat/assistant-ask-gated-endpoint`
Base: `staging`

## Scope

Add the authenticated HTTP entry point for the AI Assistant while keeping it fail-closed and provider-free.

## Intended behavior

- `POST /api/assistant/ask`
- body: `{ "query": string }`
- same query-length rule as research search: normalized length 2–300
- authentication required via the existing `requireAuth()` middleware pattern
- orchestration delegated to `orchestrateResearchAnswer()`
- orchestration result returned as JSON with HTTP 200 for expected fail-closed states
- auth/validation errors remain 401/400

## Provider gate

New env variable: `RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS`.

- only exact value `PASS` maps to `{ status: 'PASS' }`
- missing, empty, or any other value maps to `{ status: 'UNVERIFIED' }`
- local, staging, and production Wrangler vars are explicitly set to `UNVERIFIED`

No model adapter is wired. Even if the env variable is manually set to `PASS`, the endpoint must stop at `MODEL_ADAPTER_REQUIRED`.

## Files changed

- `backend/src/assistant/router.js`
- `backend/src/worker.js`
- `wrangler.toml`
- `test/backend/assistant-router.test.js`
- `scripts/assistant-smoke.mjs`
- `package.json`
- `.github/workflows/staging-smoke.yml`
- this reviewer packet

## Tests / checks

Unit coverage proves:

1. unauthenticated request -> 401;
2. empty and >300-character queries -> 400;
3. default/UNVERIFIED gate -> HTTP 200 + `PROVIDER_PRIVACY_GATE_REQUIRED` + empty claims;
4. exact `PASS` flag with no adapter -> HTTP 200 + `MODEL_ADAPTER_REQUIRED` + empty claims.

The staging smoke authenticates against real staging and asserts that `/api/assistant/ask` returns `PROVIDER_PRIVACY_GATE_REQUIRED` with no claims while the configured staging gate remains `UNVERIFIED`.

## Decision Boundary

- Gerçek model/provider bağlanmıyor.
- Provider Privacy Gate durumu değişmiyor, hâlâ hiçbir aday PASS değil.
- D-016/production/0047/0049'a dokunulmuyor.
- Bu PR yalnız: "AI Assistant'a giden HTTP kapısı var, ama şu an hiçbir şeye açılmıyor" gerçeğini kod+test ile kanıtlıyor.

## Reviewer focus

Please verify especially:

- exact-`PASS` parsing is fail-closed;
- no adapter/provider is imported or injected;
- worker routing uses the same private/no-store response boundary as research search;
- expected orchestration limitations stay HTTP 200;
- staging smoke cannot pass if the provider gate is accidentally opened.
