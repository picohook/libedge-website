# D-022 H2 — GLM-5.3 authoritative streaming execution result — 2026-09-24

Status: MECHANICALLY COMPLETE EXECUTION / SUBSTANTIVE OUTPUT ABSENT / CANDIDATE NOT SUCCESSFUL

## Frozen route

The execution used the pre-execution route frozen by PR #187:
- provider: Novita
- model: `zai-org/glm-5.3`
- request SHA-256: `6ff03e720e2a244c6daad542585c000004666b2f399c48f66a3cc19928b76f0e`
- transport: HTTP SSE streaming
- automatic retry: disabled

## Exact captured evidence

- `D022_STREAM_RAW.sse`: 15,791,419 bytes; SHA-256 `31526d522b2f44bd2168c38851fc0d5eab88f96f79d370efd52255078d32687a`
- `D022_STREAM_HEADERS.txt`: 921 bytes; SHA-256 `c7092979403cfdf7189765eb372378404a2bea2ccf3debd8dad5f652655ff578`
- `D022_STREAM_CURL_STDERR.txt`: 75,334 bytes; SHA-256 `12760fdde1072c02415d610b40db23e8c5d8718801d42dc7cd8be04118b5567b`
- `D022_STREAM_EXIT_CODE.txt`: 1 byte; SHA-256 `5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9`; content `0`

HTTP response: `200 OK`.
Content type: `text/event-stream`.
Trace/session ID in SSE: `9d890a13c2b77aadb123e7d0a9031224`.

## Mechanical SSE parse

- non-DONE JSON chunks: 26,036
- terminal `data: [DONE]`: present exactly once
- malformed/non-SSE payload lines: 0
- returned model: `zai-org/glm-5.3`
- prompt tokens: 1,017
- completion tokens: 65,536
- total tokens: 66,553
- reasoning tokens: 65,536
- text/content tokens: 0
- concatenated assistant `content`: 0 characters
- concatenated `reasoning_content`: 276,540 characters
- terminal finish reason: `length`

## Classification

The transport completed successfully and the stream is complete, but the model exhausted the 65,536-token completion budget entirely in reasoning and emitted zero assistant content. Therefore no checker implementation/deliverables were produced and there is nothing substantive to extract or test.

Under the pre-execution stopping rule, this authoritative execution is not retried, continued, repaired, or tuned. The GLM-5.3 candidate does not fill the canonical checker slot from this execution.

This classification is mechanical. It is not an independent checker-governance review and does not authorize H2 authorship or deployment.

## Gate

Canonical checker slot remains OPEN.
H2 AUTHORSHIP remains CLOSED.
