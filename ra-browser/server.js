'use strict';

/**
 * ra-browser/server.js
 *
 * Node.js + Playwright Chromium service for CF Managed Challenge publishers.
 * Receives the same HMAC-signed RA headers as ra-egress /proxy.
 *
 * POST /proxy
 *   X-RA-Target-URL   — publisher URL
 *   X-RA-Method       — GET (browser fetch only supports GET)
 *   X-RA-Timestamp    — unix seconds
 *   X-RA-Signature    — hex HMAC-SHA256(secret, "${method}|${url}|${ts}|")
 *   Cookie            — forwarded to browser context
 *   User-Agent, Accept, Accept-Language, Referer — forwarded
 *
 * Response JSON:
 *   { status, headers: {}, body: "<base64>", finalUrl }
 *
 * Env vars:
 *   EGRESS_SHARED_SECRET  — required, same secret as ra-egress
 *   LISTEN_ADDR           — optional, default ":8081" → host:port or ":port"
 *   MAX_CONCURRENT        — optional, default 3
 */

const express = require('express');
const { chromium } = require('playwright');
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

// Parse ":port" or "host:port"
const listenParts = LISTEN_ADDR.replace(/^:/, '0.0.0.0:').split(':');
const LISTEN_HOST = listenParts.length === 2 ? listenParts[0] : '0.0.0.0';
const LISTEN_PORT = parseInt(listenParts[listenParts.length - 1], 10) || 8081;

// ─────────────────────────────────────────────────────────────────────────────
// Browser singleton
// ─────────────────────────────────────────────────────────────────────────────

let browser = null;

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
    if (activeCount < MAX_CONCURRENT) {
      activeCount++;
      resolve();
    } else {
      waitQueue.push(resolve);
    }
  });
}

function releaseSemaphore() {
  if (waitQueue.length > 0) {
    const next = waitQueue.shift();
    next();
  } else {
    activeCount--;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HMAC validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the HMAC-SHA256 signature on an incoming RA request.
 * Signature format: HMAC-SHA256(secret, "${method}|${url}|${ts}|")
 * (no body hash — browser fetch is GET only, body is always empty)
 *
 * Returns null on success, or an error string.
 */
function validateHmac(method, targetUrl, tsStr, sigHex) {
  if (!method || !targetUrl || !tsStr || !sigHex) {
    return 'missing RA headers';
  }

  const ts = parseInt(tsStr, 10);
  if (isNaN(ts)) return 'bad timestamp';

  const now = Math.floor(Date.now() / 1000);
  if (ts < now - 30 || ts > now + 30) return 'timestamp skew';

  // Body hash is empty string for GET (no body)
  const msg = `${method}|${targetUrl}|${ts}|`;
  const expected = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(msg)
    .digest('hex');

  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHex, 'hex'))) {
    return 'bad signature';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// /proxy handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Headers that ra-egress (the caller) adds for RA bookkeeping.
 * We do NOT forward these to the upstream browser context.
 */
const RA_HEADERS = new Set([
  'x-ra-target-url',
  'x-ra-method',
  'x-ra-timestamp',
  'x-ra-signature',
]);

/**
 * Hop-by-hop headers — not forwarded to browser context.
 */
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
  'content-length', // browser sets its own
]);

async function handleProxy(req, res) {
  const targetUrl  = req.headers['x-ra-target-url'];
  const method     = req.headers['x-ra-method'];
  const tsStr      = req.headers['x-ra-timestamp'];
  const sigHex     = req.headers['x-ra-signature'];

  // Validate HMAC
  const hmacErr = validateHmac(method, targetUrl, tsStr, sigHex);
  if (hmacErr) {
    res.status(hmacErr === 'bad signature' || hmacErr === 'timestamp skew' ? 401 : 400)
       .json({ error: hmacErr });
    return;
  }

  // Collect passthrough headers (cookie, user-agent, accept, etc.)
  const passthroughHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (RA_HEADERS.has(lk)) continue;
    if (HOP_BY_HOP.has(lk)) continue;
    passthroughHeaders[k] = v;
  }

  await acquireSemaphore();
  let context = null;
  try {
    const b = await ensureBrowser();

    context = await b.newContext({
      ignoreHTTPSErrors: false,
      userAgent: passthroughHeaders['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    // Hide automation signals before any page script runs
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) window.chrome.runtime = {};
    });

    // Inject cookies into the browser's cookie store for the target domain
    const cookieHeader = passthroughHeaders['cookie'] || passthroughHeaders['Cookie'] || '';
    if (cookieHeader) {
      const targetHostname = new URL(targetUrl).hostname;
      const domain = targetHostname.startsWith('www.')
        ? targetHostname.slice(4)
        : targetHostname;
      const cookies = cookieHeader.split(';')
        .map(c => c.trim())
        .filter(Boolean)
        .map(c => {
          const eqIdx = c.indexOf('=');
          const name = eqIdx > 0 ? c.slice(0, eqIdx).trim() : c.trim();
          const value = eqIdx > 0 ? c.slice(eqIdx + 1).trim() : '';
          return { name, value, domain: `.${domain}`, path: '/' };
        })
        .filter(c => c.name);
      if (cookies.length) await context.addCookies(cookies);
    }

    // Inject non-cookie passthrough headers
    const fwdHeaders = { ...passthroughHeaders };
    delete fwdHeaders['user-agent'];
    delete fwdHeaders['cookie'];
    delete fwdHeaders['Cookie'];
    if (Object.keys(fwdHeaders).length) {
      await context.setExtraHTTPHeaders(fwdHeaders);
    }

    const page = await context.newPage();

    // page.goto resolves with the final main-frame navigation response after
    // redirects. Capturing the first response breaks sites like Oxford Academic:
    // their first hop is a 307 to the same canonical URL, but the rendered page
    // is available after Playwright follows it.
    const navResponse = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // CF Managed Challenge detection
    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    const isCfChallenge =
      finalUrl.includes('__cf_chl') ||
      title.includes('Just a moment');

    if (isCfChallenge) {
      console.log(`CF challenge detected for ${targetUrl}, waiting for resolution`);
      try {
        await page.waitForFunction(
          () => !document.title.includes('Just a moment') && !location.href.includes('__cf_chl'),
          { timeout: 20000, polling: 500 }
        );
        console.log(`CF challenge resolved for ${targetUrl}`);
      } catch {
        console.log(`CF challenge timeout for ${targetUrl}`);
      }
    }

    // Collect response info
    const status = navResponse ? navResponse.status() : 200;

    // Collect response headers — filter hop-by-hop
    const responseHeaders = {};
    if (navResponse) {
      for (const [k, v] of Object.entries(navResponse.headers())) {
        const lk = k.toLowerCase();
        if (HOP_BY_HOP.has(lk)) continue;
        responseHeaders[k] = v;
      }
    }
    const browserCookies = await context.cookies(uniqueCookieUrls(targetUrl, page.url()));
    const setCookies = browserCookies.map(serializeBrowserCookie).filter(Boolean);
    if (setCookies.length) {
      responseHeaders['set-cookie'] = setCookies;
    }

    // page.content() returns the DOM-serialized HTML (JS-rendered, full DOM).
    // This is intentional — we need the rendered page, not raw bytes.
    const html = await page.content();
    const body = Buffer.from(html, 'utf8').toString('base64');

    res.json({
      status,
      headers: responseHeaders,
      body,
      finalUrl: page.url(),
    });
  } catch (err) {
    console.error('browser-proxy error:', err.message);
    const errBody = Buffer.from(`ra-browser error: ${err.message}`, 'utf8').toString('base64');
    res.json({
      status: 502,
      headers: {},
      body: errBody,
      finalUrl: targetUrl,
    });
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    releaseSemaphore();
  }
}

function uniqueCookieUrls(...urls) {
  return [...new Set(urls.filter(Boolean))];
}

function serializeBrowserCookie(cookie) {
  if (!cookie || !cookie.name) return '';
  const parts = [`${cookie.name}=${cookie.value || ''}`];
  if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
  parts.push(`Path=${cookie.path || '/'}`);
  if (cookie.expires && cookie.expires > 0) {
    parts.push(`Expires=${new Date(cookie.expires * 1000).toUTCString()}`);
  }
  if (cookie.httpOnly) parts.push('HttpOnly');
  if (cookie.secure) parts.push('Secure');
  if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);
  return parts.join('; ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Express setup
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// Raw body not needed — we read from headers only, no body parsing required.
app.use(express.raw({ type: '*/*', limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Math.floor(Date.now() / 1000) });
});

app.post('/proxy', handleProxy);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Pre-launch browser so first request doesn't pay cold start
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
