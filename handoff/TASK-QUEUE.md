# Task Queue
*Owned by Architect. Builder and Reviewer read only the Active Step.*

---

## Active Step

Step: 06 - Wiley Online Library blank page
Owner: Builder
Status: planned
Gate: SPA makes absolute API calls (api.wiley.com etc.) directly from user browser, bypassing institution IP. Investigate whether link-proxy JS can intercept these domains or whether Wiley needs ra-browser-style full-browser proxy.

---

## Queue

- [x] Step 03 - Review Emerald outcome and decide whether to generalize for other WAF publishers. → Generalized: ra_waf_browser flag, Turnstile/CF Bot Management bypass via Playwright.
- [x] Step 04 - ra-browser Playwright/Chromium service. → Cleared (Emerald ✅).
- [x] Step 05 - CABI (CAB Abstracts) CF Bot Management bypass. → **Cleared 2026-05-19.**
  - Root cause: CF Bot Management + Turnstile on ALL paths (main page AND static assets).
  - Solution: playwright-extra + stealth + SwiftShader WebGL solves Turnstile. Sub-resource
    cache via `page.on('response')` captures CSS/JS/images during Chrome page load. Worker
    routes asset requests via `X-RA-Asset: 1` header to ra-browser cache handler.
  - Remaining: debug logs ([ra-debug]*) still in proxy Worker — remove before production deploy.
  - Performance: first visit ~30s (Turnstile), subsequent visits faster (cf_clearance in cookie).
  - Future: store cf_clearance in D1 (ra_waf_clearance table already exists) for Vetis-like
    3-second loads on all visits.
  - COEP/COOP/CORP added to STRIP_RESPONSE ✅. Migration 0036 (ra_waf_browser=1 for CABI) applied.
- [ ] Step 06 - Wiley Online Library blank page: SPA makes absolute API calls (api.wiley.com etc.) directly from user browser, bypassing institution IP.
- [ ] Step 07 - Production Proxy Worker deploy: blocked on libedge.com domain migration. Once domain is ready, add routes and deploy `libedge-ra-proxy-prod`.

---

## Status Values

- `planned` - Architect is still scoping.
- `ready-for-builder` - brief is complete.
- `building` - Builder owns the step.
- `monitoring` - Execution Monitor is running checks.
- `ready-for-review` - Builder has handed off and monitor report exists.
- `reviewing` - Reviewer owns the step.
- `blocked` - Architect decision or Project Owner decision required.
- `cleared` - Reviewer cleared the step.
- `deployed` - Architect deployed and logged the result.

---

## Dependency Rules

- Step N+1 does not start until Step N is cleared or explicitly deferred by Architect.
- Builder does not write code unless Active Step is `ready-for-builder` or `building`.
- Reviewer does not review unless Active Step is `ready-for-review` or `reviewing`.
- Production deploys require Project Owner approval after review.
