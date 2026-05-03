# Review Request — ra-browser: Playwright/Chromium Service for CF Managed Challenge
*Written by Builder (Bob). Read by Reviewer (Richard).*

Ready for Review: YES

---

## What Was Built

Step 04 — added `ra-browser` (Node.js + Playwright/Chromium) as a new institution-side
container. This bypasses CF Managed Challenge by using a real Chrome engine at the
institution IP instead of the Go HTTP client. Six parts:

1. **`ra-browser/` — new Node.js service** (Express + Playwright headless Chromium).
   Accepts the same HMAC-signed RA headers as ra-egress, validates independently,
   navigates to the target URL using a real browser context, detects and waits on
   CF challenges (8s), returns JSON envelope `{ status, headers, body (base64), finalUrl }`.

2. **`ra-egress/docker-compose.yml`** — added `ra-browser` service. No external ports.
   `depends_on: ra-egress`. Passes `EGRESS_SHARED_SECRET` and `MAX_CONCURRENT=3`.

3. **`ra-egress/main.go`** — added `/browser-proxy` handler and shared HMAC validation
   helper. HMAC validation extracted from `handleProxy` into `validateRARequest` to
   avoid duplication. `/browser-proxy` validates HMAC, then reverse-proxies to
   `http://ra-browser:8081/proxy`. `RA_BROWSER_URL` env var overrides the target for testing.

4. **`workers/proxy/src/egress-client.js`** — added `browserFetch()`. Calls `/browser-proxy`
   with signature format `HMAC-SHA256(secret, "${method}|${url}|${ts}|")` (empty body hash
   for GET — matches ra-egress/ra-browser validation exactly). Decodes base64 response body.

5. **`workers/proxy/src/index.js`** — routing in `proxySessionSurface` (stable-host only,
   as approved). Before `egressFetch`: queries `ra_waf_browser` from D1. If flag is 1
   AND method is GET AND not a CF challenge asset path: uses `browserFetch`. Otherwise
   falls through to existing `egressFetch` path unchanged. Added `loadProductWafBrowserFlag`
   helper with try/catch for pre-migration safety.

6. **`migrations/0027_ra_waf_browser.sql`** — adds `ra_waf_browser INTEGER NOT NULL DEFAULT 0`
   to products. Seed UPDATE is commented out — apply manually when container is at institution.

## Files Changed

| File | Change |
|---|---|
| `ra-browser/package.json` | New — Express + Playwright deps |
| `ra-browser/server.js` | New — Playwright service (245 lines) |
| `ra-browser/Dockerfile` | New — FROM playwright:v1.44.0-jammy |
| `ra-egress/docker-compose.yml` | Added ra-browser service block |
| `ra-egress/main.go` | Added `net/http/httputil` + `net/url` imports, `validateRARequest` helper, `handleBrowserProxy` handler, route registration. Refactored `handleProxy` to use shared helper. |
| `workers/proxy/src/egress-client.js` | Added `browserFetch()` + `base64Decode()` |
| `workers/proxy/src/index.js` | Added `browserFetch` import, `loadProductWafBrowserFlag`, browser routing in `proxySessionSurface` |
| `migrations/0027_ra_waf_browser.sql` | New — D1 schema migration |

## Test Results

**Go (`go test ./...` in ra-egress):** 11/11 PASS

```
ok  libedge.com/ra-egress  0.348s
```

All existing tests pass. No new Go tests added (browser proxy is a network-level
integration; unit testing requires a mock ra-browser server, deferred to Step 05 if needed).

**JavaScript (`npm test`):** 175/175 PASS

```
Test Files  14 passed (14)
Tests       175 passed (175)
```

## D1 Migration

Applied to staging remote:

```
ALTER TABLE products ADD COLUMN ra_waf_browser INTEGER NOT NULL DEFAULT 0;
```

Executed: 1 query, 1 row written, 0 errors.

## Staging Deploy

```
Uploaded libedge-ra-proxy-staging (12.10 sec)
Deployed libedge-ra-proxy-staging triggers (9.25 sec)
  proxy-staging.selmiye.com/* (zone name: selmiye.com)
  *.selmiye.com/* (zone name: selmiye.com)
Current Version ID: e0652048-0b46-4d03-8cf1-84f06dc93a26
```

## Stopping Point — Awaiting Arch Confirmation

**Not yet done (per build order — stop before step 11):**
- Docker Compose build + live start at institution (ra-browser container not yet running)
- D1 seed UPDATE for Emerald (commented out in migration file — apply when container is ready)
- Live Emerald test through ra-browser

## HMAC Signature Verification

The signature format used in `browserFetch()` is:
```
HMAC-SHA256(secret, "${method}|${url}|${ts}|")
```
This matches `validateRARequest` in ra-egress (`bodyHash` is `""` when body is empty)
and `validateHmac` in ra-browser server.js (concatenates `|` at end with empty body hash).
All three sides use the same secret (`EGRESS_SHARED_SECRET`).

## Architecture Notes

- ra-browser is never exposed externally — only ra-egress can reach it via Docker network.
- HMAC validated at ra-egress before forwarding (SSRF protection) and re-validated by
  ra-browser (defense in depth — same shared secret, original Worker-issued signature).
- `RA_BROWSER_URL` env var in ra-egress allows pointing to a different host for local testing
  without Docker Compose (e.g., `RA_BROWSER_URL=http://localhost:8081`).
- `loadProductWafBrowserFlag` catches D1 errors silently and falls back to `false` —
  safe before migration runs, safe if the column query fails for any reason.
- Browser pool: one Chromium singleton, `BrowserContext` per request (cookie isolation),
  context closed in `finally` block. Semaphore enforces `MAX_CONCURRENT=3` limit.
