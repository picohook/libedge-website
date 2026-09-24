# D-022 H2 — Novita GLM-5.3 transport-attempt record — 2026-09-24

Status: MECHANICAL TRANSPORT EVIDENCE / NO SUBSTANTIVE CHECKER RESULT RECOVERED

## Scope

This record preserves operator-observed Novita API usage evidence for the controlled GLM-5.3 checker execution route. It does not constitute checker semantic acceptance, H2 acceptance, production authorization, deployment authorization, or canonical freeze-manifest approval.

## Verified route preflight

- Model returned by Novita: `zai-org/glm-5.3`
- Preflight session/request ID: `90ec81dbc79c4aa93aa097e9d6285645`
- Input tokens: 22
- Output tokens: 50
- Duration: approximately 1.3 s
- HTTP status: 200
- Observed response used all 50 completion tokens as reasoning and ended with `finish_reason: length`; no substantive checker task was supplied in this preflight.

## Long checker transport attempts

1. `3e78cad941ae3f8de3bf888518456ea2`: model `zai-org/glm-5.3`; approximately 1.0K input; approximately 65.5K output; approximately 478.9 s; HTTP 499.
2. `f4590e23d2237b35fe4cb729d870c425`: model `zai-org/glm-5.3`; approximately 1.0K input; approximately 65.5K output; approximately 469.4 s; HTTP 499.

The local execution produced no `D022_RAW_RESPONSE.json` artifact for either long request. Therefore no model response bytes, deliverable bytes, or substantive checker result were recovered from these requests.

## Classification

- Preserve both as transport/execution attempts with HTTP 499 and unrecovered response bodies.
- Do not represent either as a successful checker implementation.
- Do not represent either as evidence that prohibited D-022 material was accessed.
- Do not silently omit them from later provenance.
- No semantic judgment about an unrecovered response is possible.
- Any later execution, if governance permits one, requires incremental response preservation and a stopping/retry rule fixed before execution.

## Current gate

Canonical checker slot remains OPEN.
H2 AUTHORSHIP remains CLOSED.
