# D-022 H2 — GLM-5.3 controlled streaming execution freeze — 2026-09-24

Status: PRE-EXECUTION MECHANICAL FREEZE / NO EXECUTION AUTHORIZATION CLAIM

## Route

- Provider: Novita
- Model: `zai-org/glm-5.3`
- Endpoint: `https://api.novita.ai/openai/v1/chat/completions`
- Transport: HTTP SSE streaming
- Automatic retry: disabled
- Tools/retrieval/repository/web/filesystem discovery supplied to model: none
- Input boundary: the same four embedded allowed checker inputs already frozen for the controlled route.

## Frozen request

- File: `FROZEN_STREAMING_REQUEST.json`
- Exact bytes: 4509
- SHA-256: `6ff03e720e2a244c6daad542585c000004666b2f399c48f66a3cc19928b76f0e`
- Material change from the verified non-streaming request: `stream` is `true`.
- Model identity remains `zai-org/glm-5.3`.

## Frozen stopping rule

- File: `STOPPING_RULE_STREAMING.txt`
- Exact bytes: 776
- SHA-256: `d273fb89a1590b78af6091e94e16829f9f006d361cf8e681e662f23d044f82d4`

Rule: execute at most once under this rule; preserve every received SSE line incrementally; do not send continuation/repair/tuning/follow-up prompts; preserve partial stream or transport error; do not automatically retry under any failure mode; any further execution requires a new explicit governance decision.

## Evidence to preserve

- exact request hash before send
- raw SSE bytes
- response headers
- curl exit code
- raw SSE SHA-256
- headers SHA-256
- exact provider/model identifiers observable in response
- later mechanical extraction/test output hashes

## Prior attempts

The two prior HTTP 499 long requests remain historical transport attempts and are not erased or reclassified by this freeze.

## Gate

Canonical checker slot remains OPEN.
H2 AUTHORSHIP remains CLOSED.
