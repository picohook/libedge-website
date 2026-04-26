/**
 * workers/proxy/src/index.js
 *
 * Remote Access Proxy Worker — iki modda çalışır:
 *
 * 1. path_proxy   → proxy-staging.selmiye.com/{encoded-host}/{path}
 * 2. session_host_proxy → r{sid}.selmiye.com/{path}  (JoVE, Primal vb.)
 *
 * Mod tespiti: hostname'e göre otomatik.
 */

import { verifyProxyToken } from '../../../backend/src/ra/jwt.js';
import { decodeHost, isValidEncodedHost } from '../../../backend/src/ra/host.js';
import { egressFetch } from './egress-client.js';

const SESSION_COOKIE  = 'ra_proxy_session';
const SESSION_TTL_SEC = 3600;

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (err) {
      console.error('proxy error', err);
      return htmlError(500, 'Proxy sunucusunda beklenmedik hata.', err.message);
    }
  },
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // ra-egress tunnel hostname — bu Worker handle etmez, origin'e pass-through.
  // *.selmiye.com/* route'u ra-egress.selmiye.com'u da yakaladığından buraya düşer.
  const egressHost = env.RA_EGRESS_HOST || 'ra-egress.selmiye.com';
  if (hostname === egressHost) {
    return fetch(request);
  }

  // R2 files subdomain — *.selmiye.com/* route'u bu hostname'i de yakaladığından
  // buraya düşer; JWT kontrolü yapmadan doğrudan R2'den serve et.
  const filesHost = env.RA_FILES_HOST || 'files.selmiye.com';
  if (hostname === filesHost) {
    return fetch(request);
  }

  // Session-host modu tespiti: "r" + 7 alfanumerik + "." + domain
  // örn: rx7f3a9b.selmiye.com  → sessionId = "rx7f3a9b"
  const sessionHostMatch = hostname.match(/^(r[a-z0-9]{6,8})\./);
  if (sessionHostMatch) {
    return await handleSessionHost(request, env, url, sessionHostMatch[1]);
  }

  // Path-proxy modu (mevcut)
  return await handlePathProxy(request, env, url);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION-HOST PROXY
// ─────────────────────────────────────────────────────────────────────────────

async function handleSessionHost(request, env, url, sessionId) {
  // Token var mı? (issue-token'dan gelen ilk yönlendirme)
  const token = url.searchParams.get('t');
  if (token) {
    return await acceptSessionHostToken(request, env, token, url, sessionId);
  }

  // Login redirect loop tespiti: URL'de proxy hostname'i içeren ?ref= varsa
  // client-side JS loopuna girildim demektir — hemen durdur.
  const refParam = url.searchParams.get('ref') || '';
  if (refParam.includes(url.hostname)) {
    return htmlError(403,
      'Bu kaynağa erişim sağlanamadı.',
      'Yayıncı sunucusu kurumunuzun IP adresini tanımıyor olabilir. ' +
      'Lütfen sistem yöneticinizle iletişime geçin.'
    );
  }

  // Session cookie kontrol
  const cookieVal = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  if (!cookieVal) {
    return htmlError(401, 'Oturum bulunamadı. Lütfen portal üzerinden tekrar erişin.');
  }

  // KV'dan session yükle
  const session = await env.RA_UPSTREAM_SESSIONS.get(`rhost:${sessionId}`, 'json');
  if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
    return htmlError(401, 'Oturum süresi dolmuş. Portal üzerinden yeniden erişin.');
  }

  // Upstream relay — path ve query aynen korunur, sadece host değişir.
  // Query params içindeki proxy hostname'i (r*.selmiye.com) origin'e rewrite et;
  // aksi hâlde EMIS gibi "ref=<current_url>" echo'layan siteler redirect loop oluşturur.
  const search = rewriteQueryProxyUrls(url.search, url.hostname, session.origin_host);
  const targetUrl = `https://${session.origin_host}${url.pathname}${search}`;
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: session.origin_host,
  });

  let upstreamResp;
  try {
    upstreamResp = await egressFetch(env, session.institution_id, targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
    });
  } catch (err) {
    console.error('egress error (session-host)', err);
    return htmlError(502, 'Kurumun erişim sunucusuna ulaşılamadı.', err.message);
  }

  const respHeaders = buildSessionHostResponseHeaders(
    upstreamResp.headers, url.hostname, session.origin_host
  );
  addStagingDebugHeaders(respHeaders, env, {
    targetUrl,
    upstreamStatus: upstreamResp.status,
    requestCookies: request.headers.get('Cookie'),
    upstreamCookies: upstreamHeaders.get('Cookie'),
    upstreamSetCookies: upstreamResp.headers,
    origin: request.headers.get('Origin'),
    referer: request.headers.get('Referer'),
    upstreamOrigin: upstreamHeaders.get('Origin'),
    upstreamReferer: upstreamHeaders.get('Referer'),
  });

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: respHeaders,
  });
}

async function acceptSessionHostToken(request, env, token, url, sessionId) {
  // Token doğrula
  let payload;
  try {
    payload = await verifyProxyToken(token, env.RA_PROXY_TOKEN_SECRET);
  } catch (err) {
    return htmlError(401, 'Erişim bağlantısı geçersiz veya süresi dolmuş.', err.message);
  }

  // jti tek kullanımlık
  const jtiKey = `ra:jti:${payload.jti}`;
  const used = await env.RATE_LIMIT_KV.get(jtiKey);
  if (used) {
    return htmlError(401, 'Bu bağlantı daha önce kullanılmış. Portal üzerinden yeni bağlantı alın.');
  }
  await env.RATE_LIMIT_KV.put(jtiKey, 'used', { expirationTtl: 600 });

  // mod uyumu kontrolü
  if (payload.mod !== 'session_host_proxy') {
    return htmlError(400, 'Token modu bu proxy ile uyumsuz.');
  }

  // KV session'ı doğrula (issue-token tarafından önceden yazılmış)
  const session = await env.RA_UPSTREAM_SESSIONS.get(`rhost:${sessionId}`, 'json');
  if (!session) {
    return htmlError(401, 'Oturum kaydı bulunamadı. Token ile session eşleşmiyor.');
  }

  // Cookie set et — SADECE bu subdomain'e (cross-session izolasyon)
  const clean = new URL(url);
  clean.searchParams.delete('t');

  return new Response(null, {
    status: 302,
    headers: {
      Location: clean.toString(),
      'Set-Cookie':
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ` +
        `Domain=${url.hostname}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`,
    },
  });
}

function buildSessionHostResponseHeaders(incoming, proxyHostname, originHost) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    if (STRIP_RESPONSE.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === 'set-cookie') {
      continue;
    }
    if (k.toLowerCase() === 'location') {
      // Publisher'ın kendi hostname'ine yönlendirmesi → proxy subdomain'e çevir
      try {
        const loc = new URL(v);
        if (loc.hostname === originHost || loc.hostname.endsWith(`.${originHost}`)) {
          out.set('Location', `https://${proxyHostname}${loc.pathname}${loc.search}${loc.hash}`);
          continue;
        }
      } catch { /* relative → olduğu gibi bırak */ }
    }
    out.set(k, v);
  }
  for (const sc of collectSetCookies(incoming)) {
    out.append('Set-Cookie', rewriteSessionHostSetCookie(sc, proxyHostname));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATH-PROXY (mevcut akış — ayrı fonksiyona alındı)
// ─────────────────────────────────────────────────────────────────────────────

async function handlePathProxy(request, env, url) {
  // 1. Path parse: /www-jove-com/article/123
  const parsed = parseProxyPath(url.pathname);
  if (!parsed) {
    return htmlError(400, 'Geçersiz proxy URL yapısı. Lütfen portal üzerinden erişin.');
  }
  const { encodedLabel, remainingPath } = parsed;

  if (!isValidEncodedHost(encodedLabel)) {
    return htmlError(400, 'Hedef adres çözümlenemedi.');
  }
  const targetHost = decodeHost(encodedLabel);

  // 2. Token var mı?
  const token = url.searchParams.get('t');
  if (token) {
    return await acceptTokenAndRedirect(request, env, token, url, encodedLabel, remainingPath);
  }

  // 3. Session cookie?
  const sessionId = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  const session = sessionId ? await loadProxySession(env, sessionId) : null;

  if (!session) {
    return htmlError(401, 'Oturum bulunamadı. Lütfen portal üzerinden tekrar erişin.');
  }

  if (session.target_host !== targetHost) {
    return htmlError(403,
      'Bu oturum farklı bir kaynağa ait. Portal üzerinden ilgili kaynağa yeniden erişin.');
  }

  // 4. Upstream relay
  const targetUrl = new URL(`https://${targetHost}${remainingPath}${url.search}`);
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: targetHost,
    pathPrefix: `/${encodedLabel}`,
  });

  let upstreamResp;
  try {
    upstreamResp = await egressFetch(env, session.institution_id, targetUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
    });
  } catch (err) {
    console.error('egress error', err);
    return htmlError(502, 'Kurumun erişim sunucusuna ulaşılamadı.', err.message);
  }

  const baseHost = env.RA_PROXY_BASE_HOST || url.hostname;
  const respHeaders = buildResponseHeaders(upstreamResp.headers, baseHost, encodedLabel);
  addStagingDebugHeaders(respHeaders, env, {
    targetUrl: targetUrl.toString(),
    upstreamStatus: upstreamResp.status,
    requestCookies: request.headers.get('Cookie'),
    upstreamCookies: upstreamHeaders.get('Cookie'),
    upstreamSetCookies: upstreamResp.headers,
    origin: request.headers.get('Origin'),
    referer: request.headers.get('Referer'),
    upstreamOrigin: upstreamHeaders.get('Origin'),
    upstreamReferer: upstreamHeaders.get('Referer'),
  });

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: respHeaders,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Path parse: "/www-jove-com/article/123"
//   → { encodedLabel: "www-jove-com", remainingPath: "/article/123" }
// ─────────────────────────────────────────────────────────────────────────────
function parseProxyPath(pathname) {
  // Baştaki "/" sonrası ilk segment encoded host
  const withoutLeading = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const slashIdx = withoutLeading.indexOf('/');
  const encodedLabel = slashIdx === -1 ? withoutLeading : withoutLeading.slice(0, slashIdx);
  const remainingPath = slashIdx === -1 ? '/' : withoutLeading.slice(slashIdx);
  if (!encodedLabel) return null;
  return { encodedLabel, remainingPath };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token kabul → session oluştur → 302 ile token'sız URL'e yönlendir
// ─────────────────────────────────────────────────────────────────────────────
async function acceptTokenAndRedirect(request, env, token, url, encodedLabel, remainingPath) {
  let payload;
  try {
    payload = await verifyProxyToken(token, env.RA_PROXY_TOKEN_SECRET);
  } catch (err) {
    return htmlError(401, 'Erişim bağlantısı geçersiz veya süresi dolmuş.', err.message);
  }

  // jti tek kullanımlık
  const jtiKey = `ra:jti:${payload.jti}`;
  const used = await env.RATE_LIMIT_KV.get(jtiKey);
  if (used) {
    return htmlError(401, 'Bu erişim bağlantısı daha önce kullanılmış. Portal üzerinden yeni bağlantı alın.');
  }
  await env.RATE_LIMIT_KV.put(jtiKey, 'used', { expirationTtl: 600 });

  // Token'daki encoded host ile path'teki uyuşuyor mu?
  if (payload.tgt !== encodedLabel) {
    return htmlError(403, 'Token bu kaynağa ait değil.');
  }

  // Session oluştur
  const sid = crypto.randomUUID();
  const session = {
    user_id:         payload.sub,
    institution_id:  payload.iid,
    subscription_id: payload.sid,
    product_slug:    payload.pid,
    target_host:     decodeHost(payload.tgt),
    created_at:      Math.floor(Date.now() / 1000),
    expires_at:      Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  await env.RA_UPSTREAM_SESSIONS.put(
    `proxysess:${sid}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SEC }
  );

  // 302: token'ı URL'den sil
  const clean = new URL(url);
  clean.searchParams.delete('t');
  const baseHost = env.RA_PROXY_BASE_HOST || url.hostname;

  return new Response(null, {
    status: 302,
    headers: {
      Location:   clean.toString(),
      'Set-Cookie': buildSessionCookie(sid, baseHost),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// KV session yükle
// ─────────────────────────────────────────────────────────────────────────────
async function loadProxySession(env, sid) {
  const raw = await env.RA_UPSTREAM_SESSIONS.get(`proxysess:${sid}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s.expires_at && s.expires_at < Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header helpers
// ─────────────────────────────────────────────────────────────────────────────
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
]);

const STRIP_REQUEST = new Set([
  'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'cf-worker',
  'cdn-loop', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
  'x-real-ip', 'true-client-ip',
]);

export function buildUpstreamHeaders(incoming, context = {}) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    const lower = k.toLowerCase();
    if (HOP_BY_HOP.has(lower) || STRIP_REQUEST.has(lower)) continue;
    if (lower === 'cookie') {
      const cleaned = stripSessionCookie(v);
      if (cleaned) out.set(k, cleaned);
      continue;
    }
    if (lower === 'origin' || lower === 'referer') {
      const rewritten = rewriteClientContextHeader(k, v, context);
      if (rewritten) out.set(k, rewritten);
      continue;
    }
    out.set(k, v);
  }
  return out;
}

const STRIP_RESPONSE = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'trailer',
  'content-security-policy', 'content-security-policy-report-only',
  'strict-transport-security',
]);

function buildResponseHeaders(incoming, baseHost, encodedLabel) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    if (STRIP_RESPONSE.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === 'set-cookie') {
      continue;
    }
    // Location header rewrite: publisher kendi domain'ine yönlendiriyorsa proxy'e çevir
    if (k.toLowerCase() === 'location') {
      out.set('Location', rewriteLocation(v, baseHost, encodedLabel));
      continue;
    }
    out.set(k, v);
  }
  for (const sc of collectSetCookies(incoming)) {
    out.append('Set-Cookie', rewritePathProxySetCookie(sc, baseHost, encodedLabel));
  }
  return out;
}

// Query string içindeki proxy hostname'i → origin hostname'e çevir.
// EMIS gibi siteler "ref=<current_url>" ile redirect loop oluşturur;
// upstream'e göndermeden önce proxy URL'lerini temizleriz.
function rewriteQueryProxyUrls(search, proxyHostname, originHost) {
  if (!search || !search.includes(proxyHostname)) return search;
  // URL-encoded ve plain her iki forma da bak
  return search
    .replaceAll(encodeURIComponent(`https://${proxyHostname}`), encodeURIComponent(`https://${originHost}`))
    .replaceAll(`https://${proxyHostname}`, `https://${originHost}`);
}

// Publisher'ın Location header'ı (redirect) → proxy URL'e çevir
function rewriteLocation(location, baseHost, currentEncodedLabel) {
  try {
    const loc = new URL(location);
    // Aynı origin'e yönlendirme → proxy path'e çevir
    const locEncoded = loc.hostname
      .toLowerCase()
      .replace(/-/g, '--')
      .replace(/\./g, '-');
    return `https://${baseHost}/${locEncoded}${loc.pathname}${loc.search}${loc.hash}`;
  } catch {
    // Relative URL — olduğu gibi bırak, tarayıcı proxy domain'i baz alır
    return location;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────────────────────────
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';').map(s => s.trim())) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

function buildSessionCookie(sid, baseHost) {
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
    `Domain=${baseHost}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    `Max-Age=${SESSION_TTL_SEC}`
  );
}

export function stripSessionCookie(header) {
  if (!header) return '';
  const kept = [];
  for (const part of String(header).split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) continue;
    kept.push(part);
  }
  return kept.join('; ');
}

export function rewriteSessionHostSetCookie(setCookie, proxyHostname) {
  return rewritePublisherSetCookie(setCookie, {
    domain: proxyHostname,
    path: '/',
  });
}

export function rewritePathProxySetCookie(setCookie, baseHost, encodedLabel) {
  return rewritePublisherSetCookie(setCookie, {
    domain: baseHost,
    path: `/${encodedLabel}/`,
  });
}

export function rewriteClientContextHeader(headerName, value, context = {}) {
  if (!value || !context.proxyHostname || !context.originHost) return value;
  const lower = String(headerName || '').toLowerCase();

  try {
    const parsed = new URL(value);
    if (parsed.hostname !== context.proxyHostname) return value;

    if (lower === 'origin') {
      return `https://${context.originHost}`;
    }

    let path = parsed.pathname || '/';
    if (context.pathPrefix) {
      const prefix = context.pathPrefix;
      if (path === prefix) {
        path = '/';
      } else if (path.startsWith(`${prefix}/`)) {
        path = path.slice(prefix.length) || '/';
      }
    }

    return `https://${context.originHost}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function rewritePublisherSetCookie(setCookie, { domain, path }) {
  if (!setCookie) return setCookie;
  const parts = String(setCookie).split(';').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return setCookie;

  const rewritten = [parts[0]];
  let sawSameSite = false;
  for (let i = 1; i < parts.length; i += 1) {
    const lower = parts[i].toLowerCase();
    if (lower.startsWith('domain=')) continue;
    if (lower.startsWith('path=')) continue;
    if (lower === 'secure') continue;
    if (lower.startsWith('samesite=')) sawSameSite = true;
    rewritten.push(parts[i]);
  }
  rewritten.push(`Domain=${domain}`);
  rewritten.push(`Path=${path}`);
  rewritten.push('Secure');
  if (!sawSameSite) rewritten.push('SameSite=Lax');
  return rewritten.join('; ');
}

function collectSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const out = [];
  for (const [k, v] of headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') out.push(v);
  }
  return out;
}

function addStagingDebugHeaders(headers, env, info) {
  if (String(env?.ENVIRONMENT || '').toLowerCase() !== 'staging') return;
  headers.set('X-RA-Debug-Target', truncateHeader(info.targetUrl, 220));
  headers.set('X-RA-Debug-Upstream-Status', String(info.upstreamStatus || ''));
  headers.set('X-RA-Debug-Req-Cookies', cookieNames(info.requestCookies).join(',') || '-');
  headers.set('X-RA-Debug-Upstream-Cookies', cookieNames(info.upstreamCookies).join(',') || '-');
  headers.set('X-RA-Debug-Set-Cookies', setCookieNames(info.upstreamSetCookies).join(',') || '-');
  if (info.origin) headers.set('X-RA-Debug-Origin', truncateHeader(info.origin, 120));
  if (info.referer) headers.set('X-RA-Debug-Referer', truncateHeader(info.referer, 180));
  if (info.upstreamOrigin) headers.set('X-RA-Debug-Upstream-Origin', truncateHeader(info.upstreamOrigin, 120));
  if (info.upstreamReferer) headers.set('X-RA-Debug-Upstream-Referer', truncateHeader(info.upstreamReferer, 180));
}

function cookieNames(cookieHeader) {
  if (!cookieHeader) return [];
  const names = [];
  for (const part of String(cookieHeader).split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx > 0) names.push(part.slice(0, idx).trim());
  }
  return names;
}

function setCookieNames(headers) {
  const names = [];
  for (const sc of collectSetCookies(headers)) {
    const idx = String(sc).indexOf('=');
    if (idx > 0) names.push(String(sc).slice(0, idx).trim());
  }
  return names;
}

function truncateHeader(value, maxLen) {
  const s = String(value || '');
  return s.length > maxLen ? `${s.slice(0, maxLen - 3)}...` : s;
}

// ─────────────────────────────────────────────────────────────────────────────
function htmlError(status, message, detail) {
  const portalUrl = 'https://selmiye.com/profile.html';
  const body = `<!doctype html><html><head><meta charset="utf-8">
<title>Uzaktan Erişim — Hata</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;background:#f5f5f5;color:#222;padding:3rem;max-width:640px;margin:auto}
h1{color:#b00020;font-size:1.4rem}p{line-height:1.5}code{background:#eee;padding:2px 6px;border-radius:4px}</style>
</head><body>
<h1>Erişim hatası (${status})</h1>
<p>${escapeHtml(message)}</p>
${detail ? `<p><small>Detay: <code>${escapeHtml(detail)}</code></small></p>` : ''}
<p><a href="${portalUrl}">← Portal'a dön</a></p>
</body></html>`;
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
