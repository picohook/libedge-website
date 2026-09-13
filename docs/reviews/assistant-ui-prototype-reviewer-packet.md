# Assistant UI Prototype — Reviewer Packet

## Scope

Add a fixture-only Research Assistant interface prototype without connecting the live Assistant API, retrieval, provider, or model adapter.

## Changed files

- `assistant.html` — new Research Assistant page with question box, mode tabs, evidence-grounded answer layout, inline citation chips, source/evidence panel, insight cards, and prototype-only action controls.
- `assets/css/assistant.css` — page-scoped responsive styles.
- `assets/js/assistant-ui.js` — presentation-only interactions: citation-to-source highlighting, mobile evidence drawer, mode/filter/action prototype notices.
- `test/frontend/assistant-ui-prototype.test.js` — locks fixture-only boundary and citation/source integrity.
- `docs/reviews/assistant-ui-prototype-reviewer-packet.md` — this packet.

## What to verify

1. No `/api/assistant/ask` call exists in the page or page JS.
2. No `fetch()` / XHR exists in `assistant-ui.js`; the only network-capable behavior on the page is existing shared header/auth infrastructure already used elsewhere in the site.
3. Fixture sources are explicitly labelled as prototype data and do not claim bibliographic accuracy.
4. Citation chips link to existing source cards and visually highlight the selected evidence.
5. Desktop layout presents answer + Sources & Evidence side-by-side; mobile layout converts Sources & Evidence into a dismissible drawer.
6. Existing backend/router/provider/privacy-gate code is untouched.
7. No existing site navigation is changed in this PR; the prototype is intentionally reachable only as `assistant.html` until the UX is accepted.

## Decision Boundary

- This PR does **not** connect `/api/assistant/ask`.
- This PR does **not** call Discover/OpenAlex/Crossref.
- This PR does **not** connect a model/provider/adapter.
- This PR does **not** change Provider Privacy Gate status.
- This PR does **not** alter D-016, Track A observability, production config, 0047/0049, authentication behavior, or existing site navigation.
- Fixture article metadata is demonstrative UI content only, not validated literature evidence.
- Approval of this PR means only: the first Research Assistant UI/interaction direction is acceptable as a prototype foundation.

## Next step after acceptance

A separate PR may connect the accepted UI states to the existing `/api/assistant/ask` response contract while preserving the current provider-gated behavior. A real provider/model remains independently blocked by the Provider Privacy Gate.
