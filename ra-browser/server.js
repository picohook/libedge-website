'use strict';

/**
 * ra-browser/server.js
 *
 * Node.js + Playwright/Chromium service for CF Managed Challenge publishers.
 *
 * POST /proxy       — full page navigation (resolves CF Turnstile)
 * POST /asset-proxy — serve cached sub-resources captured during /proxy
 * GET  /health
 *
 * Sub-resource caching strategy:
 *   During the main /proxy page load, all CSS/JS/image responses are captured
 *   via page.on('response', ...). These requests happen inside Chrome with
 *   Chrome's TLS fingerprint and the challenge cookies, so CF Bot Management
 *   passes them. They are stored in a module-level cache (keyed by URL, 5 min TTL).
 *   When the Worker routes a CSS/JS/image request to /asset-proxy, we serve
 *   directly from cache — no new outbound network connection required.
 */

const express = require('express');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_SECRET = process.env.EGRESS_SHARED_SECRET;
if (!SHARED_SECRET) {
  console.error('FATAL: EGRESS_SHARED_SECRET env var required');
  process.exit(1);
}

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3', 10);
const LISTEN_ADDR = process.env.LISTEN_ADDR || ':8081';
const listenParts = LISTEN_ADDR.replace(/^:/, '0.0.0.0:').split(':');
const LISTEN_HOST = listenParts.length === 2 ? listenParts[0] : '0.0.0.0';
const LISTEN_PORT = parseInt(listenParts[listenParts.length - 1], 10) || 8081;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-resource cache
// Populated during /proxy page load; served by /asset-proxy.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS   = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 300;
const resourceCache  = new Map(); // url → { status, headers, bodyB64, expiresAt }

function cachePut(url, status, headers, bodyBuffer) {
  if (resourceCache.size >= CACHE_MAX_SIZE) {
    resourceCache.delete(resourceCache.keys().next().value);
  }
  resourceCache.set(url, {
    status,
    headers,
    bodyB64: bodyBuffer.toString('base64'),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function cacheGet(url) {
  const entry = resourceCache.get(url);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { resourceCache.delete(url); return null; }
  return entry;
}

// Resource types to capture during page load.
const CAPTURABLE_TYPES = new Set(['stylesheet', 'script', 'image', 'font', 'other']);

// URL fragments to skip (CF internal, analytics, etc.)
function shouldSkipUrl(url) {
  return (
    url.includes('/cdn-cgi/') ||
    url.includes('cookielaw.org') ||
    url.includes('challenges.cloudflare.com') ||
    url.includes('sentry.io') ||
    url.includes('cloudflareinsights.com')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session context pool — Step 06 (Wiley persistent sessions)
//
// Wiley (ve benzeri client-state ağırlıklı yayıncılar) login durumunu
// document.cookie + localStorage + JS-set cookie ile takip eder. Bu state
// HTTP Set-Cookie ile Worker'a aktarılamaz; Playwright context'inde yaşar.
//
// Pool, sessionId bazlı context tutar. /proxy navigation context'i
// X-RA-Persist-Session=1 ile pool'a girer; /asset-proxy aynı sessionId
// için pooled context'i tekrar kullanır → JS-set cookies, localStorage,
// cf_clearance hepsi korunur.
//
// TTL: 15 dk (kullanıcı session_ttl ile uyumlu).
// Max boyut: 8 context (Docker memory ~50-100MB/context).
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_POOL_TTL_MS = 15 * 60 * 1000;
const CONTEXT_POOL_MAX = 8;
const contextPool = new Map(); // sessionId → { context, hostname, lastUsed, createdAt }

function poolKey(sessionId, hostname) {
  return `${sessionId}|${hostname}`;
}

function poolGet(sessionId, hostname) {
  if (!sessionId) return null;
  const key = poolKey(sessionId, hostname);
  const entry = contextPool.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CONTEXT_POOL_TTL_MS) {
    contextPool.delete(key);
    entry.context.close().catch(() => {});
    return null;
  }
  entry.lastUsed = Date.now();
  return entry.context;
}

function poolPut(sessionId, hostname, context) {
  if (!sessionId) return;
  // LRU eviction if at capacity
  while (contextPool.size >= CONTEXT_POOL_MAX) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of contextPool.entries()) {
      if (v.lastUsed < oldestTime) { oldestTime = v.lastUsed; oldestKey = k; }
    }
    if (!oldestKey) break;
    const evicted = contextPool.get(oldestKey);
    contextPool.delete(oldestKey);
    evicted.context.close().catch(() => {});
  }
  const key = poolKey(sessionId, hostname);
  const existing = contextPool.get(key);
  if (existing) {
    // Replace + close old context
    contextPool.delete(key);
    existing.context.close().catch(() => {});
  }
  contextPool.set(key, { context, hostname, lastUsed: Date.now(), createdAt: Date.now() });
}

// Background cleanup: TTL geçen context'leri her 5 dk'da temizle
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of contextPool.entries()) {
    if (now - v.createdAt > CONTEXT_POOL_TTL_MS) {
      contextPool.delete(k);
      v.context.close().catch(() => {});
    }
  }
}, 5 * 60 * 1000).unref?.();

// ─────────────────────────────────────────────────────────────────────────────
// Browser singleton
// ─────────────────────────────────────────────────────────────────────────────

let browser = null;

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

async function ensureBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--use-gl=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    });
    console.log('Chromium launched');
  }
  return browser;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency semaphore
// ─────────────────────────────────────────────────────────────────────────────

let activeCount = 0;
const waitQueue = [];

function acquireSemaphore() {
  return new Promise((resolve) => {
    if (activeCount < MAX_CONCURRENT) { activeCount++; resolve(); }
    else waitQueue.push(resolve);
  });
}

function releaseSemaphore() {
  if (waitQueue.length > 0) waitQueue.shift()();
  else activeCount--;
}

// ─────────────────────────────────────────────────────────────────────────────
// HMAC validation
// ─────────────────────────────────────────────────────────────────────────────

function validateHmac(method, targetUrl, tsStr, sigHex) {
  if (!method || !targetUrl || !tsStr || !sigHex) return 'missing RA headers';
  const ts = parseInt(tsStr, 10);
  if (isNaN(ts)) return 'bad timestamp';
  const now = Math.floor(Date.now() / 1000);
  if (ts < now - 30 || ts > now + 30) return 'timestamp skew';
  const expected = crypto.createHmac('sha256', SHARED_SECRET)
    .update(`${method}|${targetUrl}|${ts}|`).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHex, 'hex'))) {
    return 'bad signature';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header helpers
// ─────────────────────────────────────────────────────────────────────────────

const RA_HEADERS = new Set([
  'x-ra-target-url', 'x-ra-method', 'x-ra-timestamp', 'x-ra-signature',
  'x-ra-raw',
  'x-ra-fast-document',
]);

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'content-length',
]);

const BROWSER_MANAGED = new Set([
  'user-agent', 'cookie', 'Cookie',
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-ch-ua-full-version-list',
  'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user',
  'accept', 'accept-encoding', 'accept-language', 'upgrade-insecure-requests',
]);

function extractPassthroughHeaders(reqHeaders) {
  const out = {};
  for (const [k, v] of Object.entries(reqHeaders)) {
    const lk = k.toLowerCase();
    if (!RA_HEADERS.has(lk) && !HOP_BY_HOP.has(lk)) out[k] = v;
  }
  return out;
}

async function injectCookiesFromHeader(context, cookieHeader, targetUrl) {
  if (!cookieHeader) return;
  const hostname = new URL(targetUrl).hostname;
  const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean).map(c => {
    const eqIdx = c.indexOf('=');
    const name  = eqIdx > 0 ? c.slice(0, eqIdx).trim() : c.trim();
    const value = eqIdx > 0 ? c.slice(eqIdx + 1).trim() : '';
    return { name, value, domain: `.${domain}`, path: '/' };
  }).filter(c => c.name);
  if (cookies.length) await context.addCookies(cookies);
}

function isChallengeTitle(t) {
  const lc = t.toLowerCase();
  return lc.includes('just a moment') || lc.includes('bir dakika') ||
    lc.includes('verification') || lc.includes('dogrulama') || lc.includes('security check');
}

function serializeBrowserCookie(cookie) {
  if (!cookie || !cookie.name) return '';
  const parts = [`${cookie.name}=${cookie.value || ''}`];
  parts.push(`Path=${cookie.path || '/'}`);
  if (cookie.expires && cookie.expires > 0) {
    parts.push(`Expires=${new Date(cookie.expires * 1000).toUTCString()}`);
  }
  if (cookie.httpOnly) parts.push('HttpOnly');
  if (cookie.secure) parts.push('Secure');
  if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);
  return parts.join('; ');
}

function uniqueCookieUrls(...urls) {
  return [...new Set(urls.filter(Boolean))];
}

async function waitForCookie(context, url, name, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const cookies = await context.cookies(url);
      if (cookies.some((cookie) => cookie.name === name && cookie.value)) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// /proxy — full page navigation, caches sub-resources
// ─────────────────────────────────────────────────────────────────────────────

async function handleProxy(req, res) {
    const targetUrl = req.headers['x-ra-target-url'];
    const method    = req.headers['x-ra-method'];
    const tsStr     = req.headers['x-ra-timestamp'];
    const sigHex    = req.headers['x-ra-signature'];
    const rawMode   = req.headers['x-ra-raw'] === '1';
    const fastDocument = req.headers['x-ra-fast-document'] === '1';

  const hmacErr = validateHmac(method, targetUrl, tsStr, sigHex);
  if (hmacErr) {
    res.status(hmacErr === 'bad signature' || hmacErr === 'timestamp skew' ? 401 : 400)
       .json({ error: hmacErr });
    return;
  }

  const pass = extractPassthroughHeaders(req.headers);
  await acquireSemaphore();
  let context = null;
  let contextPersisted = false;
  let usingPooledContext = false;
  const startedAt = Date.now();
  const timing = {};
  const mark = (name) => { timing[name] = Date.now() - startedAt; };
  try {
    const b = await ensureBrowser();
    const persistSession = req.headers['x-ra-persist-session'] === '1';
    const sessionId = req.headers['x-ra-session-id'];
    const targetHostname = (() => { try { return new URL(targetUrl).hostname; } catch { return ''; } })();
    const pooledContext = persistSession && sessionId && targetHostname
      ? poolGet(sessionId, targetHostname)
      : null;
    if (pooledContext) {
      context = pooledContext;
      usingPooledContext = true;
      console.log(`browser-proxy document using pooled context: ${targetUrl}`);
    } else {
      context = await b.newContext({
        ignoreHTTPSErrors: false,
        userAgent: pass['user-agent'] || CHROME_UA,
        viewport: { width: 1920, height: 1080 },
        locale: 'tr-TR',
        timezoneId: 'Europe/Istanbul',
        extraHTTPHeaders: {
          'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
        },
      });
    }
    mark('context');

    await injectCookiesFromHeader(context, pass['cookie'] || pass['Cookie'] || '', targetUrl);
    mark('cookies');

    const fwdHeaders = { ...pass };
    for (const h of BROWSER_MANAGED) delete fwdHeaders[h];
    if (Object.keys(fwdHeaders).length) await context.setExtraHTTPHeaders(fwdHeaders);

    const page = await context.newPage();

    // Capture sub-resource responses during page load with Chrome TLS/cookies.
    // Stored in module-level cache; served by /asset-proxy without new requests.
    page.on('response', async (response) => {
      const url = response.url();
      const type = response.request().resourceType();
      if (!CAPTURABLE_TYPES.has(type) || shouldSkipUrl(url)) return;
      try {
        const body = await response.body();
        cachePut(url, response.status(), response.headers(), body);
      } catch { /* body may not be available for some responses */ }
    });

    if (rawMode) {
      const target = new URL(targetUrl);
      let warmupUrl = `${target.origin}/`;
      try {
        const referer = pass.referer || pass.referrer || '';
        if (referer && new URL(referer).origin === target.origin) warmupUrl = referer;
      } catch { /* keep origin warmup */ }

      await page.goto(warmupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await waitForCookie(context, target.origin, 'cf_clearance', 12000);

      const rawFetchHeaders = { ...fwdHeaders };
      for (const h of [
        'accept-encoding',
        'connection',
        'content-length',
        'cookie',
        'host',
        'origin',
        'referer',
        'user-agent',
      ]) delete rawFetchHeaders[h];
      for (const h of Object.keys(rawFetchHeaders)) {
        if (h.toLowerCase().startsWith('sec-')) delete rawFetchHeaders[h];
      }

      const fetchRawInPage = async () => page.evaluate(async ({ url, headers }) => {
        const resp = await fetch(url, {
          credentials: 'include',
          headers,
          method: 'GET',
        });
        const rawHeaders = {};
        resp.headers.forEach((value, key) => { rawHeaders[key] = value; });
        const bytes = new Uint8Array(await resp.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return {
          body: btoa(binary),
          finalUrl: resp.url,
          headers: rawHeaders,
          status: resp.status,
        };
      }, { url: targetUrl, headers: rawFetchHeaders });

      let rawResult = await fetchRawInPage();
      if (rawResult.status === 401 || rawResult.status === 403) {
        const gotClearance = await waitForCookie(context, target.origin, 'cf_clearance', 8000);
        if (gotClearance) rawResult = await fetchRawInPage();
      }

      const rawHeaders = {};
      for (const [k, v] of Object.entries(rawResult.headers || {})) {
        const lk = k.toLowerCase();
        if (!HOP_BY_HOP.has(lk)) rawHeaders[k] = v;
      }
      const browserCookies = await context.cookies(uniqueCookieUrls(targetUrl, page.url(), rawResult.finalUrl));
      const setCookies = browserCookies.map(serializeBrowserCookie).filter(Boolean);
      if (setCookies.length) rawHeaders['set-cookie'] = setCookies;
      const cfClearanceCookie = browserCookies.find(c => c.name === 'cf_clearance');
      const envelope = {
        status: rawResult.status,
        headers: rawHeaders,
        body: rawResult.body,
        finalUrl: rawResult.finalUrl,
      };
      if (cfClearanceCookie?.value) envelope.cfClearance = cfClearanceCookie.value;
      res.json(envelope);
      return;
    }

    mark('before-goto');
    const navResponse = await page.goto(targetUrl, {
      waitUntil: fastDocument ? 'commit' : 'domcontentloaded',
      timeout: 30000,
    });
    mark('goto');

    const firstStatus = navResponse ? navResponse.status() : 200;
    const firstTitle  = await page.title().catch(() => '');
    const isCfChallenge = page.url().includes('__cf_chl') || isChallengeTitle(firstTitle);

    if (isCfChallenge) {
      console.log(`CF challenge (status=${firstStatus} title="${firstTitle}") for ${targetUrl}, waiting...`);
      try {
        await page.waitForFunction(
          () => {
            const t = document.title.toLowerCase();
            return !t.includes('just a moment') && !t.includes('bir dakika') &&
              !t.includes('verification') && !t.includes('dogulama') &&
              !t.includes('security check') && !location.href.includes('__cf_chl');
          },
          { timeout: 45000, polling: 1000 }
        );
        const resolvedTitle = await page.title().catch(() => '');
        console.log(`CF challenge resolved: title="${resolvedTitle}" url=${page.url()}`);
      } catch {
        console.log(`CF challenge timeout for ${targetUrl}`);
      }
      // Wait for sub-resources to load and be captured.
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    }

    const afterTitle     = await page.title().catch(() => '');
    const stillChallenge = isChallengeTitle(afterTitle);
    const status = isCfChallenge && !stillChallenge ? 200 : firstStatus;

    // For non-challenge visits (cf_clearance already valid), wait for page load
    // so page.on('response') cache is populated with sub-resources.
    if (!isCfChallenge && !fastDocument) {
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    }
    mark('load-wait');

    const responseHeaders = {};
    if (!isCfChallenge && navResponse) {
      for (const [k, v] of Object.entries(navResponse.headers())) {
        const lk = k.toLowerCase();
        // Strip content-encoding: Playwright always returns decoded HTML via
        // page.content(), so forwarding the original encoding header causes
        // the browser to attempt decompression on already-decoded content.
        if (!HOP_BY_HOP.has(lk) && lk !== 'content-encoding') responseHeaders[k] = v;
      }
    }

    const browserCookies = await context.cookies(uniqueCookieUrls(targetUrl, page.url()));
    const setCookies = browserCookies.map(serializeBrowserCookie).filter(Boolean);
    if (setCookies.length) responseHeaders['set-cookie'] = setCookies;

    // Return cf_clearance value so the Worker can persist it in D1 (ra_waf_clearance).
    // Stored clearance lets subsequent visits bypass Turnstile without Playwright.
    const cfClearanceCookie = browserCookies.find(c => c.name === 'cf_clearance');
    mark('cookies-out');

    let html;
    if (fastDocument && navResponse && !isCfChallenge) {
      // Wiley gibi ağır client-side sayfalarda DOM'un ra-browser içinde hydrate
      // olmasını beklemek 20-40sn sürebiliyor. Document response body'sini ham
      // döndürüp scriptleri kullanıcı browser'ında çalıştırmak Vetis'e daha yakın.
      html = await navResponse.text().catch(() => null);
    }
    mark('html');
    if (!html) try {
      html = await page.content();
    } catch (e1) {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        html = await page.content();
      } catch (e2) {
        try {
          html = await page.evaluate(() => document.documentElement.outerHTML);
        } catch (e3) {
          html = '<!doctype html><html><body><p>Sayfa yüklenirken hata.</p></body></html>';
          console.warn('page.content fallback all failed', { url: targetUrl, err: e3?.message });
        }
      }
    }
    mark('content');
    responseHeaders['x-ra-browser-timing'] = Object.entries(timing).map(([k, v]) => `${k};dur=${v}`).join(', ');
    responseHeaders['x-ra-browser-pooled'] = usingPooledContext ? '1' : '0';
    const envelope = { status, headers: responseHeaders, body: Buffer.from(html, 'utf8').toString('base64'), finalUrl: page.url() };
    if (cfClearanceCookie?.value) envelope.cfClearance = cfClearanceCookie.value;
    res.json(envelope);

    // Step 06 — persistent session: X-RA-Persist-Session=1 + X-RA-Session-ID varsa
    // context'i pool'a koy, kapatma. Sonraki /asset-proxy istekleri bu context'i
    // tekrar kullanır → JS-set cookies, localStorage, cf_clearance korunur.
    if (persistSession && sessionId && !usingPooledContext) {
      try {
        const hostname = new URL(targetUrl).hostname;
        poolPut(sessionId, hostname, context);
        contextPersisted = true;
      } catch (err) {
        console.warn('context pool put failed', err?.message);
      }
    } else if (usingPooledContext) {
      contextPersisted = true;
      try {
        const hostname = new URL(targetUrl).hostname;
        poolPut(sessionId, hostname, context);
        contextPersisted = true;
      } catch (err) {
        console.warn('context pool put failed', err?.message);
      }
    }
  } catch (err) {
    console.error('browser-proxy error:', err.message);
    res.json({
      status: 502, headers: {},
      body: Buffer.from(`ra-browser error: ${err.message}`, 'utf8').toString('base64'),
      finalUrl: targetUrl,
    });
  } finally {
    if (context && !contextPersisted) await context.close().catch(() => {});
    releaseSemaphore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /asset-proxy — serve cached sub-resources
// ─────────────────────────────────────────────────────────────────────────────

async function handleAssetProxy(req, res) {
  const targetUrl = req.headers['x-ra-target-url'];
  const method    = req.headers['x-ra-method'];
  const tsStr     = req.headers['x-ra-timestamp'];
  const sigHex    = req.headers['x-ra-signature'];

  const hmacErr = validateHmac(method, targetUrl, tsStr, sigHex);
  if (hmacErr) {
    res.status(hmacErr === 'bad signature' || hmacErr === 'timestamp skew' ? 401 : 400)
       .json({ error: hmacErr });
    return;
  }

  // Serve from cache if available (captured during /proxy with Chrome TLS).
  const cached = cacheGet(targetUrl);
  if (cached) {
    return res.json({ status: cached.status, headers: cached.headers, body: cached.bodyB64, finalUrl: targetUrl });
  }

  // Step 06: pooled session context for publishers that need client-state
  // continuity (Wiley: MAID, MACHINE_LAST_SEEN, cf_clearance live in browser context).
  const sessionId = req.headers['x-ra-session-id'];
  const targetHostname = (() => { try { return new URL(targetUrl).hostname; } catch { return ''; } })();
  const pooledContext = sessionId && targetHostname ? poolGet(sessionId, targetHostname) : null;

  // Cache miss: fall back to a fresh browser context request.
  // This may be blocked by CF Bot Management if cf_clearance is missing/stale.
  console.log(`asset-proxy cache miss: ${targetUrl}${pooledContext ? ' (pooled)' : ''}`);
  const pass = extractPassthroughHeaders(req.headers);
  await acquireSemaphore();
  let context = null;
  let usingPooledContext = false;
  try {
    if (pooledContext) {
      context = pooledContext;
      usingPooledContext = true;
      // Cookie inject — yeni HTTP cookies (Worker'dan gelen) pool context'ine eklenir,
      // mevcut JS-set cookies + localStorage korunur.
      await injectCookiesFromHeader(context, pass['cookie'] || pass['Cookie'] || '', targetUrl);
    } else {
      const b = await ensureBrowser();
      context = await b.newContext({ ignoreHTTPSErrors: false, userAgent: pass['user-agent'] || CHROME_UA });
      await injectCookiesFromHeader(context, pass['cookie'] || pass['Cookie'] || '', targetUrl);
    }

    const assetMethod = (req.headers['x-ra-asset-method'] || 'GET').toUpperCase();
    const fetchOptions = { maxRedirects: 5, timeout: 30000 };
    // Forward non-browser-managed request headers (Referer, Accept, etc.) so that
    // publisher API endpoints that use CSRF/Referer checks don't return 403.
    const passHeaders = {};
    const SKIP_HDR = new Set([
      'user-agent', 'cookie', 'accept-encoding', 'upgrade-insecure-requests',
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-ch-ua-full-version-list',
      'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user',
      'x-ra-target-url', 'x-ra-method', 'x-ra-timestamp', 'x-ra-signature',
      'x-ra-asset', 'x-ra-asset-method', 'x-ra-raw',
      'connection', 'keep-alive', 'te', 'trailers', 'transfer-encoding', 'upgrade',
      'host', 'content-length', 'proxy-authenticate', 'proxy-authorization',
    ]);
    for (const [k, v] of Object.entries(pass)) {
      if (!SKIP_HDR.has(k.toLowerCase())) passHeaders[k] = v;
    }
    if (assetMethod !== 'GET' && req.body && req.body.length) {
      fetchOptions.method = assetMethod;
      fetchOptions.data = req.body;
      fetchOptions.headers = { ...passHeaders, ...(pass['content-type'] ? { 'Content-Type': pass['content-type'] } : {}) };
    }
    const apiResp = assetMethod === 'GET'
      ? await context.request.get(targetUrl, { maxRedirects: 5, timeout: 30000, headers: passHeaders })
      : await context.request.fetch(targetUrl, fetchOptions);
    const body    = await apiResp.body();
    const cached2 = { status: apiResp.status(), headers: apiResp.headers(), bodyB64: body.toString('base64') };

    // Cache the result to avoid repeated fallback calls.
    if (cached2.status === 200) {
      cachePut(targetUrl, cached2.status, cached2.headers, body);
    }

    res.json({ status: cached2.status, headers: cached2.headers, body: cached2.bodyB64, finalUrl: apiResp.url() });
  } catch (err) {
    console.error('asset-proxy error:', err.message);
    res.json({
      status: 502, headers: {},
      body: Buffer.from(`asset-proxy error: ${err.message}`, 'utf8').toString('base64'),
      finalUrl: targetUrl,
    });
  } finally {
    // Pool'dan alındıysa kapatma, sonraki istekler için sakla
    if (context && !usingPooledContext) await context.close().catch(() => {});
    releaseSemaphore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express setup
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.raw({ type: '*/*', limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Math.floor(Date.now() / 1000) }));
// /proxy handles both full page navigation and asset requests (dispatched by X-RA-Asset header).
// ra-egress only has /browser-proxy → /proxy forwarding; no /asset-proxy route exists.
app.post('/proxy', (req, res) => {
  if (req.headers['x-ra-asset'] === '1') return handleAssetProxy(req, res);
  return handleProxy(req, res);
});
app.post('/asset-proxy', handleAssetProxy); // Direct access fallback
app.use((_req, res) => res.status(404).json({ error: 'not found' }));

async function main() {
  await ensureBrowser();
  app.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.log(`ra-browser listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
    console.log(`MAX_CONCURRENT=${MAX_CONCURRENT}`);
  });
}

main().catch((err) => {
  console.error('ra-browser startup error:', err);
  process.exit(1);
});
