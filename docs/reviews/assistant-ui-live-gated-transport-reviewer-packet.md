# Assistant UI live gated transport — reviewer packet

## Scope

Stacked on PR #57. Connect the Research Assistant UI to the already-existing, providerless `POST /api/assistant/ask` endpoint using the repo's established same-origin authenticated fetch pattern.

## Exact changes relative to PR #57

- `assets/js/assistant-api.js` — isolated POST transport to `/api/assistant/ask`, JSON body `{ query }`, `credentials: 'include'`, fail-closed HTTP handling.
- `assets/js/assistant-ui-state.js` — adds frontend states for auth-required, HTTP error, and evidence-payload-required.
- `assets/js/assistant-ui.js` — “Araştır / Sor” now invokes the live gated backend. Initial fixture result is hidden before the live request so demo evidence can never be mistaken for live evidence.
- `test/frontend/assistant-api.test.js` — transport contract tests.
- `test/frontend/assistant-ui-prototype.test.js` — boundary updated from offline-only to isolated gated transport.
- this reviewer packet.

## Important contract gap discovered

The current backend success shape exposes `claims` and `evidence_pack_id`, but not the evidence records required to populate the real `Sources & Evidence` panel. This PR does **not** invent or reconstruct sources client-side. If a future `OK` response arrives without an `evidence` array, the UI converts it to a frontend-only `EVIDENCE_PAYLOAD_REQUIRED` state and does not show fixture evidence.

A later separately reviewed backend/API contract change is required before real source cards can render from a live answer.

## Safety boundary

- No provider/model/adapter is added.
- `RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS` is unchanged; current environments remain `UNVERIFIED`.
- With today's backend, an authenticated live request may run DISCOVER/EvidencePack, then stops at `PROVIDER_PRIVACY_GATE_REQUIRED` before any model adapter call.
- No direct OpenAlex/Crossref/provider calls from the browser.
- No D-016, Track A observability, production config, Wrangler, 0047/0049, or backend source changes.
- Fixture sources are hidden immediately when a live request starts.
- Authentication uses the existing same-origin cookie model (`credentials: 'include'`); no token is read or stored by this UI code.

## Reviewer checks

1. Browser network access is isolated to `assistant-api.js` and only targets `/api/assistant/ask`.
2. Request body contains only `query`.
3. 401 and 400 are mapped without exposing backend error detail.
4. Provider-gate and adapter-required results remain expected HTTP-200 application states.
5. Fixture evidence disappears before the live request and is not reused for a live result.
6. A live `OK` without evidence payload fails closed into `EVIDENCE_PAYLOAD_REQUIRED` rather than fabricating source cards.
7. No provider/model endpoint or credential handling is introduced.

## Decision Boundary

Approval authorizes only browser-to-existing-gated-Assistant-endpoint wiring. It does not authorize a provider/model, provider-gate PASS, evidence response-contract expansion, production rollout, or semantic-primary changes.
