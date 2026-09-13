# Assistant UI contract states — reviewer packet

## Scope

This stacked PR sits on top of `feat/assistant-ui-prototype` / PR #56 and adds only provider-independent UI state handling. It does not connect the live Assistant API.

## Files changed relative to PR #56

- `assets/js/assistant-ui-state.js` — pure mapping from the existing Assistant `{ ok, code, claims, evidence_pack_id }` contract into user-facing UI states.
- `assets/js/assistant-ui.js` — fixture-only lifecycle now previews three loading stages and renders mapped status messages; still no network call.
- `test/frontend/assistant-ui-state.test.js` — verifies success, gate-blocked, adapter-missing, retrieval/evidence/model/grounding failures, unknown-code fail-closed behavior, and loading stages.
- this reviewer packet.

## Contract evidence

The mapper mirrors the codes currently emitted by `backend/src/assistant/router.js` and `backend/src/research/assistant-orchestrator.js`:

- `ASSISTANT_QUERY_INVALID`
- `ASSISTANT_QUERY_REQUIRED`
- `DISCOVER_FAILED`
- `EVIDENCE_PACK_FAILED`
- `PROVIDER_PRIVACY_GATE_REQUIRED`
- `MODEL_ADAPTER_REQUIRED`
- `MODEL_ADAPTER_FAILED`
- `MODEL_OUTPUT_INVALID`
- `GROUNDING_VALIDATION_FAILED`
- `GROUNDING_REJECTED`
- `OK`

Unknown codes map to a generic non-success state with an empty claims array.

## Safety boundary

- No `fetch()` / XHR.
- No `/api/assistant/ask` call.
- No Discover/OpenAlex/Crossref call.
- No provider/model/adapter connection.
- No provider-gate status change.
- No backend, Worker, Wrangler, production, D-016, Track A, 0047/0049, auth, or existing navigation change.
- Loading stages are presentation-only simulation; they do not claim that a real backend request occurred.

## Reviewer checks

1. Every currently emitted backend assistant code is represented or safely falls through to generic fail-closed behavior.
2. Any non-success backend result yields `claims: []` in the UI mapper.
3. Gate-blocked and adapter-missing states do not imply an outage; wording explains intentional unavailability.
4. Unknown future codes do not render fixture/model claims.
5. No network call was introduced.
6. Existing citation/source interaction from PR #56 remains unchanged.

## Decision Boundary

Approval authorizes only the frontend state/contract layer on top of the fixture prototype. It does not authorize live Assistant API wiring, provider selection, provider-gate PASS, or production rollout.
