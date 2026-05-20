#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const startUrl = args.url || args.u;
const query = args.query || args.q || 'nanotube';
const composeDir = args.composeDir || args['compose-dir'] || '';
const timeoutMs = Number(args.timeout || 45000);
const keepOpen = Boolean(args.keepOpen || args['keep-open']);
const browserName = String(args.browser || 'chrome').toLowerCase();

if (!startUrl) {
  console.error(`Usage:
  node scripts/check-sciencedirect-search.mjs --url <proxied-sciencedirect-url> [--query nanotube] [--browser chrome|edge] [--compose-dir <ra-egress-dir>]

Examples:
  node scripts/check-sciencedirect-search.mjs --url "https://r123.selmiye.com/" --compose-dir "C:\\Users\\rgurs_u1q2xlu\\Downloads\\ra-egress-laptop-kit\\ra-egress"
  node scripts/check-sciencedirect-search.mjs --url "https://r123.selmiye.com/search?qs=nanotube&origin=home&zone=qSearch"
`);
  process.exit(2);
}

const browserPath = findBrowser(browserName);
if (!browserPath) {
  console.error(`Could not find ${browserName}. Pass --browser edge, or add Chrome/Edge to the usual install path.`);
  process.exit(2);
}

const userDataDir = mkdtempSync(join(tmpdir(), 'ra-sd-check-'));
const port = 9222 + Math.floor(Math.random() * 1000);
let browser;

try {
  browser = spawn(browserPath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-popup-blocking',
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  const pageWs = await waitForPageWebSocket(port, timeoutMs);
  const cdp = new Cdp(pageWs);
  await cdp.ready;

  const state = {
    searchApi: new Map(),
    latestSearchApiRequestId: null,
    consoleMessages: [],
    pageErrors: [],
    failedRequests: [],
  };

  cdp.on('Runtime.consoleAPICalled', (event) => {
    const text = (event.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' ');
    if (text) state.consoleMessages.push(text);
  });
  cdp.on('Runtime.exceptionThrown', (event) => {
    const details = event.exceptionDetails || {};
    state.pageErrors.push(details.text || details.exception?.description || 'Runtime exception');
  });
  cdp.on('Network.requestWillBeSent', (event) => {
    if (!isSearchApi(event.request?.url)) return;
    const rec = ensureSearchRecord(state, event.requestId);
    rec.url = event.request.url;
    rec.method = event.request.method;
    rec.requestHeaders = { ...(rec.requestHeaders || {}), ...(event.request.headers || {}) };
    rec.timestamp = event.timestamp;
    state.latestSearchApiRequestId = event.requestId;
  });
  cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
    const rec = state.searchApi.get(event.requestId);
    if (!rec) return;
    rec.requestHeaders = { ...(rec.requestHeaders || {}), ...(event.headers || {}) };
    rec.associatedCookies = event.associatedCookies || [];
  });
  cdp.on('Network.responseReceived', (event) => {
    if (!isSearchApi(event.response?.url)) return;
    const rec = ensureSearchRecord(state, event.requestId);
    rec.status = event.response.status;
    rec.statusText = event.response.statusText;
    rec.responseHeaders = event.response.headers || {};
    rec.mimeType = event.response.mimeType;
    rec.remoteIPAddress = event.response.remoteIPAddress;
    rec.remotePort = event.response.remotePort;
    state.latestSearchApiRequestId = event.requestId;
  });
  cdp.on('Network.responseReceivedExtraInfo', (event) => {
    const rec = state.searchApi.get(event.requestId);
    if (!rec) return;
    rec.responseHeaders = { ...(rec.responseHeaders || {}), ...(event.headers || {}) };
    rec.extraStatusCode = event.statusCode;
  });
  cdp.on('Network.loadingFailed', (event) => {
    const rec = state.searchApi.get(event.requestId);
    if (rec) {
      rec.failed = true;
      rec.errorText = event.errorText;
    }
    state.failedRequests.push({ requestId: event.requestId, errorText: event.errorText });
  });
  cdp.on('Network.loadingFinished', async (event) => {
    const rec = state.searchApi.get(event.requestId);
    if (!rec) return;
    rec.finished = true;
    try {
      const body = await cdp.send('Network.getResponseBody', { requestId: event.requestId });
      rec.bodyBase64 = body.base64Encoded;
      rec.body = body.base64Encoded
        ? Buffer.from(body.body || '', 'base64').toString('utf8')
        : body.body || '';
    } catch (err) {
      rec.bodyError = err.message;
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Network.enable', { maxTotalBufferSize: 20_000_000, maxResourceBufferSize: 10_000_000 });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  const targetUrl = buildSearchUrl(startUrl, query);
  console.log(`Opening: ${targetUrl}`);
  await cdp.send('Page.navigate', { url: targetUrl });

  await waitForCondition(
    () => {
      const rec = latestSearchRecord(state);
      return rec && (rec.finished || rec.failed || rec.status);
    },
    timeoutMs
  ).catch(() => {});

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const cookies = await cdp.send('Network.getAllCookies').catch(() => ({ cookies: [] }));
  const rec = latestSearchRecord(state);
  const dockerReport = composeDir ? readDockerLogs(composeDir) : null;
  printReport({ targetUrl, rec, cookies: cookies.cookies || [], state, dockerReport });

  if (!keepOpen) {
    await cdp.close().catch(() => {});
    browser.kill();
  } else {
    console.log('\nBrowser left open because --keep-open was used.');
  }
} finally {
  if (!keepOpen) {
    try { browser?.kill(); } catch {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function findBrowser(name) {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const candidates = name === 'edge'
    ? [
        join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
        join(pfx86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      ]
    : [
        join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
        join(pfx86, 'Google\\Chrome\\Application\\chrome.exe'),
        local ? join(local, 'Google\\Chrome\\Application\\chrome.exe') : '',
      ];
  for (const path of candidates.filter(Boolean)) {
    try {
      execFileSync('cmd.exe', ['/c', 'if', 'exist', path, 'echo', 'ok'], { stdio: 'pipe' });
      return path;
    } catch {}
  }
  return null;
}

async function waitForPageWebSocket(port, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT' }).catch(() => null);
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
      const page = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Chrome DevTools did not become ready on port ${port}`);
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (msg) => {
      const data = JSON.parse(String(msg.data));
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
        else resolve(data.result || {});
        return;
      }
      if (data.method && this.handlers.has(data.method)) {
        for (const fn of this.handlers.get(data.method)) fn(data.params || {});
      }
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
    });
  }
  async close() {
    this.ws.close();
  }
}

function buildSearchUrl(input, query) {
  const url = new URL(input);
  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/search';
    url.search = `?qs=${encodeURIComponent(query)}&origin=home&zone=qSearch`;
    url.hash = 'submit';
  } else if (!url.pathname.startsWith('/search')) {
    url.pathname = '/search';
    url.search = `?qs=${encodeURIComponent(query)}&origin=home&zone=qSearch`;
    url.hash = 'submit';
  } else if (!url.searchParams.has('qs')) {
    url.searchParams.set('qs', query);
  }
  return url.toString();
}

function isSearchApi(url) {
  try {
    return new URL(url).pathname === '/search/api';
  } catch {
    return false;
  }
}

function ensureSearchRecord(state, requestId) {
  if (!state.searchApi.has(requestId)) state.searchApi.set(requestId, { requestId });
  return state.searchApi.get(requestId);
}

function latestSearchRecord(state) {
  if (state.latestSearchApiRequestId) return state.searchApi.get(state.latestSearchApiRequestId);
  return [...state.searchApi.values()].at(-1) || null;
}

async function waitForCondition(fn, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out');
}

function readDockerLogs(dir) {
  try {
    const egress = execFileSync('docker', ['compose', 'logs', '--tail', '160', 'ra-egress'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const browser = execFileSync('docker', ['compose', 'logs', '--tail', '80', 'ra-browser'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { egress, browser };
  } catch (err) {
    return { error: err.message };
  }
}

function printReport({ targetUrl, rec, cookies, state, dockerReport }) {
  console.log('\nScienceDirect Search Check');
  console.log('='.repeat(32));
  console.log(`Target: ${targetUrl}`);

  if (!rec) {
    console.log('\n/search/api: NOT SEEN');
  } else {
    const reqCookie = headerValue(rec.requestHeaders, 'cookie');
    const respContentType = headerValue(rec.responseHeaders, 'content-type');
    const server = headerValue(rec.responseHeaders, 'server');
    const raFinalUrl = headerValue(rec.responseHeaders, 'x-ra-browser-final-url');
    const cfRay = headerValue(rec.responseHeaders, 'cf-ray');

    console.log(`\n/search/api status: ${rec.status || rec.extraStatusCode || 'unknown'} ${rec.statusText || ''}`.trim());
    console.log(`content-type: ${respContentType || rec.mimeType || '(none)'}`);
    console.log(`server: ${server || '(none)'}`);
    console.log(`remote: ${rec.remoteIPAddress || '(unknown)'}${rec.remotePort ? `:${rec.remotePort}` : ''}`);
    console.log(`cf-ray: ${cfRay || '(none)'}`);
    console.log(`x-ra-browser-final-url: ${raFinalUrl || '(none)'}`);
    console.log(`failed: ${rec.failed ? rec.errorText || 'yes' : 'no'}`);

    console.log('\nRequest cookie flags');
    printFlag('raw cf_clearance', hasCookie(reqCookie, 'cf_clearance'));
    printFlag('raw __cf_bm', hasCookie(reqCookie, '__cf_bm'));
    printFlag('__ra_sd_clean marker', hasCookie(reqCookie, '__ra_sd_clean'));
    printFlag('namespaced MIAMISESSION', hasCookie(reqCookie, '__cp_sciencedirect.com|MIAMISESSION'));
    printFlag('namespaced SD_REMOTEACCESS', hasCookie(reqCookie, '__cp_sciencedirect.com|SD_REMOTEACCESS'));
    printFlag('namespaced cf_clearance', hasCookie(reqCookie, '__cp_sciencedirect.com|cf_clearance'));
    printFlag('namespaced __cf_bm', hasCookie(reqCookie, '__cp_sciencedirect.com|__cf_bm'));

    const bodyPreview = String(rec.body || '').slice(0, 240).replace(/\s+/g, ' ').trim();
    if (bodyPreview) console.log(`\nBody preview: ${bodyPreview}`);

    console.log('\nDiagnosis');
    diagnose(rec, reqCookie);
  }

  const sdCookies = cookies.filter((cookie) =>
    cookie.name === 'cf_clearance' ||
    cookie.name === '__cf_bm' ||
    cookie.name === '__ra_sd_clean' ||
    cookie.name.startsWith('__cp_sciencedirect.com|') ||
    ['MIAMISESSION', 'SD_REMOTEACCESS', 'sd_session_id', 'ANONRA_COOKIE'].includes(cookie.name)
  );
  console.log(`\nBrowser cookie snapshot (${sdCookies.length})`);
  for (const cookie of sdCookies.slice(0, 30)) {
    console.log(`- ${cookie.name} @ ${cookie.domain}`);
  }

  if (state.pageErrors.length) {
    console.log('\nPage errors');
    for (const err of state.pageErrors.slice(0, 8)) console.log(`- ${err}`);
  }

  if (dockerReport) {
    console.log('\nDocker logs');
    if (dockerReport.error) {
      console.log(`Could not read logs: ${dockerReport.error}`);
    } else {
      const egressSearchLines = dockerReport.egress.split(/\r?\n/).filter((line) => line.includes('/search/api'));
      const browserProxyLines = dockerReport.browser.split(/\r?\n/).filter((line) => /proxy|search\/api|error/i.test(line));
      console.log(`ra-egress /search/api lines: ${egressSearchLines.length}`);
      for (const line of egressSearchLines.slice(-8)) console.log(line);
      console.log(`ra-browser relevant lines: ${browserProxyLines.length}`);
      for (const line of browserProxyLines.slice(-8)) console.log(line);
    }
  }
}

function diagnose(rec, reqCookie) {
  const status = rec.status || rec.extraStatusCode;
  const contentType = headerValue(rec.responseHeaders, 'content-type') || rec.mimeType || '';
  const raFinalUrl = headerValue(rec.responseHeaders, 'x-ra-browser-final-url');
  const rawCf = hasCookie(reqCookie, 'cf_clearance');
  const rawBm = hasCookie(reqCookie, '__cf_bm');
  const nsMiami = hasCookie(reqCookie, '__cp_sciencedirect.com|MIAMISESSION');
  const nsRemote = hasCookie(reqCookie, '__cp_sciencedirect.com|SD_REMOTEACCESS');

  if (status === 200 && /json/i.test(contentType)) {
    console.log('OK: search API returned JSON.');
    return;
  }
  if (rawCf || rawBm) {
    console.log('Likely edge cookie poison: raw Cloudflare cookie is still sent on selmiye.com.');
  }
  if (status === 401 && /html/i.test(contentType) && !raFinalUrl) {
    console.log('Likely blocked before/at Cloudflare edge. If egress log has no /search/api line, Worker did not reach browser/egress.');
  }
  if (!nsMiami || !nsRemote) {
    console.log('ScienceDirect auth cookies are missing from the browser request.');
  }
  if (status === 401 && raFinalUrl) {
    console.log('ra-browser was used, but upstream still returned 401. Compare returned Set-Cookie and clearance state.');
  }
}

function headerValue(headers = {}, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === wanted) return Array.isArray(value) ? value.join('; ') : String(value);
  }
  return '';
}

function hasCookie(cookieHeader = '', name) {
  const lowerName = String(name).toLowerCase();
  return String(cookieHeader || '').split(';').some((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return false;
    return part.slice(0, idx).trim().toLowerCase() === lowerName;
  });
}

function printFlag(label, value) {
  console.log(`- ${label}: ${value ? 'YES' : 'no'}`);
}
