# Assistant response evidence payload — reviewer packet

## Scope

Stacked on docs PR #59. Implements only the proposed success-response evidence payload using the already-reviewed immutable EvidencePack snapshots.

## Exact changes relative to #59

- `backend/src/research/assistant-orchestrator.js`: on fully grounded `ok:true / code:OK`, add `evidence: evidencePack.evidence`.
- `test/backend/assistant-orchestrator.test.js`: verify evidence appears only on grounded success, keeps minimized fields, and never includes the raw query.
- this reviewer packet.

## Safety properties

- Failure paths remain unchanged and do not expose `evidence`.
- Provider Privacy Gate behavior is unchanged.
- No provider/model/adapter is added.
- No retrieval/D-016/Track A/production config/0047/0049 change.
- Evidence objects are not rebuilt or expanded; they are the existing immutable snapshots from `createEvidencePack()`.
- The success test confirms omitted `openAccess`/`citations` ResearchWork fields remain omitted and the raw query is absent from serialized evidence.

## Reviewer checks

1. `evidence` is added only after all grounding gates pass.
2. Gate-blocked, malformed-output, missing-support and grounding-rejected paths expose no evidence array.
3. Returned evidence IDs match claim `evidence_ids` and the pack ID.
4. No query/user/session/quota/history/provider metadata is added.
5. Existing adapter input remains exactly `{ task, evidencePack }`.

## Decision Boundary

Approval authorizes only the safe evidence payload on fully grounded success. It does not authorize provider/model integration, Provider Privacy Gate PASS, production rollout, or changes to failure response behavior.
