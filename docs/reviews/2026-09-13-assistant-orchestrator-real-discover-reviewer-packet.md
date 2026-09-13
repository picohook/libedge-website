# Reviewer packet — Assistant orchestration with real Discover

## Scope

Add one isolated integration test proving that the provider-independent assistant orchestration chain works with the real `Discover()` implementation and real OpenAlex lexical retrieval.

## What changes

- Adds `test/backend/assistant-orchestrator-integration.test.js`.
- Imports and passes the real `Discover` function; it is not stubbed or mocked.
- Uses fixed query `hydrogen membrane catalysis` and lexical retrieval (`RESEARCH_SEMANTIC_PRIMARY_ENABLED=false`).
- Uses a fake in-test model adapter only after `providerGate: { status: 'PASS' }`; the adapter reads the real generated `EvidencePack` and cites `evidence[0].evidence_id`.
- Uses a simple support checker that verifies the cited evidence title is actually present in the claim text.
- Asserts orchestration returns `ok: true`, one grounded claim, and a pack-local real `evidence_id` tied to the returned `evidence_pack_id`.
- Keeps this network-dependent test out of the normal unit suite by excluding it from `npm test` and running it through a dedicated `test:assistant-integration` script.
- Adds a separate CI job, `Assistant orchestration + real Discover`, that performs the real network integration independently of the unit-test job.

## Network / credentials

The test uses the public OpenAlex lexical API. If an `OPENALEX_API_KEY` secret is configured in GitHub Actions it is passed through; otherwise the real public route is still exercised. No provider/model credentials are introduced.

## Files expected to change

- `test/backend/assistant-orchestrator-integration.test.js`
- `package.json`
- `.github/workflows/ci.yml`
- this reviewer packet

## Decision Boundary

- `backend/src/assistant/router.js` is unchanged.
- No production or staging application config changes.
- No real model/provider adapter is connected.
- `/api/assistant/ask` behavior is unchanged.
- Provider Privacy Gate verdict/state is unchanged.
- No D-016 / Track A-B / production / 0047 / 0049 changes.
- This PR answers only: can real `Discover()` output flow through `EvidencePack -> fake adapter -> grounding validator` successfully when the orchestration function is invoked directly?

## Reviewer checks

1. Confirm `Discover()` is real and not mocked/stubbed.
2. Confirm the adapter reads a real generated evidence item and cites its actual `evidence_id`.
3. Confirm `supportCheck` validates against cited real evidence rather than returning unconditional `true`.
4. Confirm the integration test is excluded from normal `npm test` and runs in a separate CI job.
5. Confirm no production source file, especially `backend/src/assistant/router.js`, changes in this PR.
