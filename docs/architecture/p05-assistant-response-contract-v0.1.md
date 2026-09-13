# P0.5 Assistant response contract v0.1

Status: DRAFT FOR REVIEW

## Purpose

Define the minimum frontend-facing success payload required by the Research Assistant UI without weakening the existing EvidencePack minimization or grounding boundaries.

## Current gap

`orchestrateResearchAnswer()` currently returns, on success:

```json
{
  "ok": true,
  "code": "OK",
  "claims": [/* grounded claims */],
  "evidence_pack_id": "..."
}
```

This is sufficient to prove grounded orchestration, but insufficient for the UI's `Sources & Evidence` panel because no evidence records are returned to the authenticated caller.

The frontend must not reconstruct sources from claim text, invent bibliographic metadata, or reuse fixture sources for a live answer.

## Proposed success shape

```json
{
  "ok": true,
  "code": "OK",
  "claims": [
    {
      "text": "...",
      "evidence_ids": ["<pack-id>:e1"]
    }
  ],
  "evidence_pack_id": "<pack-id>",
  "evidence": [
    {
      "evidence_id": "<pack-id>:e1",
      "work_id": "...",
      "title": "...",
      "authors": [{ "name": "...", "orcid": null }],
      "publicationDate": "...",
      "publicationYear": 2026,
      "doi": "...",
      "venue": { "name": "...", "publisher": "..." },
      "abstract": "...",
      "evidence": { "level": "...", "sources": [] },
      "urls": {},
      "flags": {},
      "provenance": []
    }
  ]
}
```

## Evidence source

The `evidence` array must be derived directly from the immutable `EvidencePack.evidence` snapshots already created by `backend/src/research/evidence-pack.js`.

No new source-object shape is introduced by this contract.

## Data-minimization invariant

The frontend response must not add any of the following:

- raw query beyond what the browser already submitted;
- user identity;
- email;
- institution;
- session/cookie/token material;
- quota/rate-limit state;
- search history;
- provider request/response metadata;
- model prompt/system prompt;
- hidden semantic-support diagnostics.

The evidence objects remain limited to the existing EvidencePack snapshot fields.

## Grounding invariant

The `evidence` array may be returned only when the outward response is `ok: true` and all outward claims have passed `validateGroundedClaims()`.

A claim's `evidence_ids` must resolve against the returned `evidence` array.

No partially grounded claim set becomes render-ready.

## Failure responses

Existing failure response shapes remain unchanged in v0.1. In particular, this draft does not authorize returning evidence records for:

- `PROVIDER_PRIVACY_GATE_REQUIRED`
- `MODEL_ADAPTER_REQUIRED`
- `MODEL_ADAPTER_FAILED`
- `MODEL_OUTPUT_INVALID`
- `GROUNDING_REJECTED`
- `GROUNDING_VALIDATION_FAILED`
- `DISCOVER_FAILED`
- `EVIDENCE_PACK_FAILED`

Those paths may continue to expose `evidence_pack_id` where they already do, but not the evidence array under this version of the contract.

## UI behavior

A live `OK` response without an `evidence` array is incomplete for the real source panel and must fail closed in the frontend rather than display fixture or fabricated sources.

The UI may:

- render each grounded claim;
- map each claim's `evidence_ids` to source cards;
- highlight claim/source relationships;
- show all returned EvidencePack sources in pack order.

## Non-goals

This contract does not authorize:

- provider/model integration;
- Provider Privacy Gate PASS;
- prompt caching changes;
- new retrieval behavior;
- D-016 changes;
- production rollout;
- persistence of Assistant questions or answers;
- workspace/save/export features.

## Decision boundary

Approval of this document authorizes only the response-contract shape for a later implementation PR. No backend code changes are authorized by this document alone.
