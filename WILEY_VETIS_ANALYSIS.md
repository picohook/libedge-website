# Wiley / Vetis Network Analysis

Date: 2026-05-24

Update: 2026-05-25 live CDP comparison added.

## Captures Used

- `1551683842c92c442f30948395dc2e4ae6a00da3.vetisonline.com.har`
- `r276r110.selmiye.com.har`
- `vetis-wiley-current-cdp-2026-05-24T08-48-55-774Z.json`

## Key Finding

Vetis is not making every Wiley static asset request live through a browser-like backend. It serves most Wiley static assets from Cloudflare edge cache.

In the fresh Chrome CDP capture:

- Main HTML `/action/showPublications`: `200`, `DYNAMIC`, about `818ms`
- Static assets: `111` total
- `cf-cache-status: HIT`: `71`
- `cf-cache-status: MISS`: `1`
- Asset cookies: none in request headers
- Typical cached asset ages:
  - Wiley CSS/JS: about `140,000s`
  - Wiley font assets: about `54,000s`

Example Vetis assets:

```text
CSS 200 HIT age=54106  /products/acropolis/pericles/releasedAssets/css/build-...
JS  200 HIT age=54106  /products/acropolis/pericles/releasedAssets/js/main.bundle-...
WOFF2 200 HIT age=54106 /products/acropolis/pericles/releasedAssets/fonts/open-sans/...
TXT 200 HIT age=140509 /pb-assets/utm_params_config/submission-systems-domains-...
```

Our comparable HAR:

- Static assets: `105`
- Bad static assets: `6`
- Failing class:
  - `woff` fonts
  - `submission-systems-domains-*.txt`
- Failure shape:

```text
403 text/html from Cloudflare
```

So the browser receives HTML error pages where it expects font/text assets, which causes broken fonts, MIME errors, and page instability.

## 2026-05-25 Live Vetis CDP Probe

Fresh navigation in the already-open Vetis Wiley tab:

```text
URL: /action/doSearch?AllField=nanotube-vetisprobe
Document: 200 DYNAMIC cloudflare at ~1.28s
Visible text: ~2s
ready=complete: ~8s
```

The important part is that the document request itself is not challenged:

```text
Document 200 DYNAMIC cloudflare /action/doSearch
```

Static assets are immediately served from Vetis' Cloudflare edge cache:

```text
~1.40s CSS 200 HIT /products/acropolis/pericles/releasedAssets/css/build-...
~1.40s JS  200 HIT /products/acropolis/pericles/releasedAssets/js/main.bundle-...
~1.41s CSS 200 HIT /wro/...~product.css
~1.42s JS  200 HIT /wro/...~product.js
~1.45s+ fonts 200 HIT /products/acropolis/pericles/releasedAssets/fonts/...
```

Vetis still allows many third-party analytics/ad scripts to load, but this does not block the first useful content:

```text
assets.adobedtm.com: many scripts after ~1.9s
connect.facebook.net, google analytics, bing, linkedin, twitter: later
```

This means Vetis' speed advantage is not primarily "blocking all ads". The decisive differences are:

1. Wiley document navigation does not hit a Cloudflare challenge.
2. Static assets are already edge-cached and shared across sessions.

## Current LibEdge Behavior After Step 06 Fixes

LibEdge now has:

- `ra_cookie_mode='host'` for Wiley.
- persistent browser context pool.
- pooled document context and pooled page reuse.
- external Wiley tracker script stripping, while keeping inline bootstrap scripts.

But ra-browser logs still show:

```text
browser-proxy document pool probe: persist=1 session=1 host=onlinelibrary.wiley.com hit=1
browser-proxy document using pooled context: https://onlinelibrary.wiley.com/action/doSearch?AllField=nanotube
browser-proxy document using pooled page: https://onlinelibrary.wiley.com/action/doSearch?AllField=nanotube
CF challenge (status=403 title="Just a moment...") for https://onlinelibrary.wiley.com/action/doSearch?AllField=nanotube, waiting...
CF challenge resolved...
```

So the remaining primary bottleneck is not missing pool state anymore. Even with pooled context and pooled page, Wiley challenges the headless browser document navigation.

The consequence:

```text
Vetis document: ~1.3s, no challenge
LibEdge document: challenge path, commonly 10-20s+
```

This is why small patches cannot fully reach Vetis speed.

## What We Tried And Why It Failed

### 1. Cookie-less direct asset fetch

Idea: mimic Vetis request headers and strip cookies.

Result: Wiley Cloudflare returned `403`.

Reason: Vetis is showing cache HIT requests. Those do not prove that the original cache-populating request was cookie-less. Wiley can reject the first uncached request but serve later cached responses cookie-less.

### 2. Direct `egressFetch` with cookie + cookieless CF cache key

Idea: keep cookies for Wiley auth, but cache by asset URL.

Result: some asset requests still returned `403`, and `cacheEverything` risked caching those 403s.

Reason: our Go/uTLS request is not equivalent to Chromium for Wiley's Cloudflare checks. Chromium pool succeeds where direct egress can fail.

## Correct Architecture

Use Chromium only to populate the cache, then serve future static assets from Worker cache.

Flow:

1. Request for Wiley static asset arrives.
2. Worker checks Cache API using a publisher asset key:

```text
wiley-static:{realHost}{path}{query}
```

3. On cache HIT:
   - return cached response immediately
   - no ra-browser
   - no ra-egress
   - no Wiley Cloudflare request

4. On cache MISS:
   - use existing `assetBrowserFetch`
   - this uses Chromium/Playwright context and currently succeeds for protected Wiley assets
   - only if response is `200` and content type is asset-safe, store it in Worker Cache API
   - strip `Set-Cookie`
   - set long `Cache-Control`

This reproduces the observable Vetis behavior without requiring us to solve Wiley's exact Cloudflare fingerprinting at the Go/uTLS layer.

## Why This Is Safer

- It does not cache `403` responses.
- It does not depend on direct `egressFetch` passing Wiley Cloudflare checks.
- It uses the already-working Chromium path for the first population request.
- It shares static asset cache across Wiley sessions.
- It does not affect HTML navigation or other publishers.

## Expected Result

Current:

```text
Wiley first open/search/link: ~30-40s
Repeated asset loads: still expensive because they go through browser fetch
```

After Worker Cache API asset cache:

```text
First session after deploy: still slower while cache warms
Second page / second user / repeated session: much faster
Expected link/search after warm cache: roughly 3-8s instead of 30-40s
```

HTML may still require Playwright and remain slower than Vetis until a separate HTML fast path is implemented. But the asset bottleneck should drop sharply.

## Revised Correct Architecture For Vetis-Level Speed

The asset cache plan helps, but it is not sufficient. Vetis-level Wiley requires removing Playwright document navigation from the hot path.

Target architecture:

1. Use Playwright only for initial Cloudflare clearance acquisition.
2. Export/sync the usable browser session state needed for document requests.
3. Serve later Wiley document navigations with a fast HTTP path that does not trigger Cloudflare challenge.
4. If that fast path gets 403/challenge, fall back to Playwright and refresh state.
5. Populate Worker/edge cache for static Wiley assets only after successful Chromium fetches.

The hardest open problem is step 3: LibEdge's current Go/uTLS and Playwright `context.request` document paths both return 403 for Wiley document requests. Vetis has a document fetch path that Cloudflare accepts; ours does not yet.

Next investigation should focus on this exact delta:

- compare Vetis document request headers/cookies to LibEdge browser fallback headers.
- compare IP/tunnel path and Cloudflare-facing TLS/fingerprint.
- test whether Vetis' document path is browser-originated, server-originated, or Cloudflare edge-originated.
- do not spend more time on CSP/inline-script tuning until document challenge is solved.

## Implementation Scope

Patch only `workers/proxy/src/index.js`.

Add a Wiley/host-mode static asset cache branch around the existing `assetBrowserFetch` path:

- Match only `GET`
- Match only static extensions:
  - `.css`
  - `.js`
  - `.woff`
  - `.woff2`
  - `.ttf`
  - `.otf`
  - `.png`
  - `.jpg`
  - `.jpeg`
  - `.gif`
  - `.svg`
  - `.ico`
  - `.txt`
  - `.map`
- Cache only:
  - status `200`
  - no `Set-Cookie`
  - or `Set-Cookie` stripped before put
- Never cache:
  - `403`
  - `404`
  - HTML responses
  - navigations/documents

Rollback is simple: remove the cache branch; current slow-but-working behavior returns.
