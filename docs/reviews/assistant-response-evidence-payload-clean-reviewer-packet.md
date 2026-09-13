# Assistant safe evidence payload — clean rebase reviewer packet

This PR supersedes PR #60 only because #60 was 24 commits behind current `staging` after the stacked chain was merged.

## Semantic changes

- `backend/src/research/assistant-orchestrator.js`: add `evidence: evidencePack.evidence` only to the final fully grounded `ok:true / code:OK` response.
- `test/backend/assistant-orchestrator.test.js`: preserve the existing orchestration safety tests and add assertions that:
  - failure paths do not expose `evidence`;
  - success exposes only minimized EvidencePack snapshots;
  - `openAccess` and `citations` do not leak;
  - the raw query string does not appear in the evidence payload.

## Safety boundary

- No provider/model/adapter added.
- Provider Privacy Gate unchanged.
- No retrieval/D-016/production/Track A/0047/0049 changes.
- No new evidence fields are invented.
- This is the already-reviewed PR #60 semantic change reapplied on current `staging` without old-branch formatting/deletion noise.
