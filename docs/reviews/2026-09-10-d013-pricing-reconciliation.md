# D-013 OpenAlex Semantic Pricing Reconciliation

Status: `HISTORICAL`
Qualifier: `CLOSED — LIVE TELEMETRY UNAMBIGUOUS`

## Purpose

Resolve the OpenAlex semantic-search pricing conflict recorded in D-013 using the preregistered authenticated telemetry protocol.

## Prior conflict

The official Authentication & Pricing page contained conflicting evidence: the pricing table stated `$1 / 1,000` semantic calls, while a `/rate-limit` example encoded `semantic = 0.01`, equivalent to `$10 / 1,000`.

Under D-010 the conflict remained OPEN and planning used the conservative `$10 / 1,000` assumption until live telemetry could distinguish the claims.

## Controlled measurement

Repository: `picohook/libedge-website`
Branch: `staging`
Workflow run: `34483422756`
Job: `102891595357`
Trigger commit: `67c3974e7d8aa46ea240dc79db0630f5f2848aef`
Checked: `2026-09-10`

Authentication: GitHub Actions secret `OPENALEX_API_KEY`; the key was never printed. Logs show the environment value masked as `***`.

Intent used for all calls: `digital divide rural education`.

### Semantic call 1

- UTC: `2026-09-10T13:33:56.204708+00:00`
- Redacted request: `https://api.openalex.org/works?search.semantic=digital+divide+rural+education&per-page=5&api_key=REDACTED`
- HTTP: `200`
- `meta.cost_usd`: `0.001`
- `X-RateLimit-Credits-Used`: `10`
- `X-RateLimit-Cost-USD`: `0.001`
- Remaining USD moved consistently with the observed charge.

### Semantic call 2

- UTC: `2026-09-10T13:33:59.021673+00:00`
- Same redacted semantic request shape
- HTTP: `200`
- `meta.cost_usd`: `0.001`
- `X-RateLimit-Credits-Used`: `10`
- `X-RateLimit-Cost-USD`: `0.001`

### Semantic call 3

- UTC: `2026-09-10T13:34:01.395540+00:00`
- Same redacted semantic request shape
- HTTP: `200`
- `meta.cost_usd`: `0.001`
- `X-RateLimit-Credits-Used`: `10`
- `X-RateLimit-Cost-USD`: `0.001`

### Lexical control

- UTC: `2026-09-10T13:34:03.834682+00:00`
- Redacted request: `https://api.openalex.org/works?search=digital+divide+rural+education&per-page=5&api_key=REDACTED`
- HTTP: `200`
- `meta.cost_usd`: `0.001`
- Leading Work IDs were different from the semantic result set.

Semantic first five Work IDs:
`W3215746815`, `W2088183499`, `W2911768226`, `W2731622968`, `W3156172847`.

Lexical-control first five Work IDs:
`W2991538617`, `W2040484355`, `W2168637053`, `W2343437055`, `W4252846263`.

The explicit `search.semantic` request shape plus the distinct semantic/lexical result sets confirms that the three charged observations were semantic calls rather than silent lexical fallback.

## Reconciliation

All three authenticated successful semantic calls independently returned the same unambiguous charged cost:

`$0.001 / semantic call = $1 / 1,000 semantic calls`.

Both response-body telemetry (`meta.cost_usd`) and response-header telemetry (`X-RateLimit-Cost-USD`) agreed on every semantic call. No mixed or inconsistent live observation occurred.

Therefore the D-010 reconciliation criterion is satisfied and the D-013 source conflict is CLOSED at the observed live charged price of `$1 / 1,000 semantic calls` as of 2026-09-10.

The contradictory documentation example remains historical evidence and is not erased. A materially different future authenticated charge is the reopen trigger.

## Consequence

P0.5 may freeze its economic assumption at `$0.001` per semantic call for this experiment. The preregistered rate constraint remains `<=1 semantic request/second`.

## Cleanup requirement

The temporary telemetry workflow must be removed after evidence capture. The run/job/commit identifiers above preserve the audit trail after cleanup.

Last updated: 2026-09-10
