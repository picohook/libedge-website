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
import { encodeHost, decodeHost, isValidEncodedHost } from '../../../backend/src/ra/host.js';
import { egressFetch } from './egress-client.js';
import { writeUpstreamAlert } from './alert-writer.js';

const SESSION_COOKIE  = 'ra_proxy_session';
const UPSTREAM_HOST_COOKIE = '__ra_upstream';
const SESSION_TTL_SEC = 3600;
const SESSION_ALT_HOST_PREFIX = '/__ra-host/';
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

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
    return await handleSessionHost(request, env, ctx, url, sessionHostMatch[1]);
  }

  // Path-proxy modu (mevcut)
  return await handlePathProxy(request, env, ctx, url);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION-HOST PROXY
// ─────────────────────────────────────────────────────────────────────────────

async function handleSessionHost(request, env, ctx, url, sessionId) {
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

  const proxyableHosts = await loadSessionProxyableHosts(env.DB, session);
  const upstreamCookieHost = readAllowedUpstreamHostCookie(
    request.headers.get('Cookie'),
    proxyableHosts
  );
  const target = parseSessionHostTarget(
    url.pathname,
    session.origin_host,
    proxyableHosts,
    upstreamCookieHost
  );
  if (!target) {
    return htmlError(403, 'Bu oturum bu yayıncı hostuna erişemez.');
  }

  // Upstream relay — path ve query aynen korunur, sadece host değişir.
  // Query params içindeki proxy hostname'i (r*.selmiye.com) origin'e rewrite et;
  // aksi hâlde EMIS gibi "ref=<current_url>" echo'layan siteler redirect loop oluşturur.
  const search = rewriteQueryProxyUrls(url.search, url.hostname, target.host);
  const targetUrl = `https://${target.host}${target.path}${search}`;
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: target.host,
    forceDesktopUserAgent: session.product_slug === 'emis',
  });
  const storedUpstreamCookies = await loadSessionHostCookieJar(env, sessionId, target.host);
  const effectiveUpstreamCookies = mergeSessionHostCookieJar(
    storedUpstreamCookies,
    upstreamHeaders.get('Cookie') || ''
  );
  if (effectiveUpstreamCookies) {
    upstreamHeaders.set('Cookie', effectiveUpstreamCookies);
  } else {
    upstreamHeaders.delete('Cookie');
  }

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

  if (upstreamResp.status === 401 || upstreamResp.status === 403) {
    ctx.waitUntil(writeUpstreamAlert(env, {
      product_slug: session.product_slug,
      institution_id: session.institution_id,
      target_host: target.host,
      status: upstreamResp.status,
    }));
  }

  await persistSessionHostCookieJar(
    env,
    sessionId,
    target.host,
    upstreamHeaders.get('Cookie') || '',
    upstreamResp.headers
  );

  const respHeaders = buildSessionHostResponseHeaders(
    upstreamResp.headers,
    url.hostname,
    session.origin_host,
    target.host,
    proxyableHosts
  );

  addStagingDebugHeaders(respHeaders, env, {
    targetUrl,
    upstreamStatus: upstreamResp.status,
    requestCookies: request.headers.get('Cookie'),
    upstreamCookies: upstreamHeaders.get('Cookie'),
    upstreamSetCookies: upstreamResp.headers,
    upstreamLocation: upstreamResp.headers.get('Location'),
    origin: request.headers.get('Origin'),
    referer: request.headers.get('Referer'),
    upstreamOrigin: upstreamHeaders.get('Origin'),
    upstreamReferer: upstreamHeaders.get('Referer'),
  });

  const contentType = upstreamResp.headers.get('Content-Type') || '';
  if (String(env?.ENVIRONMENT || '').toLowerCase() === 'staging') {
    respHeaders.set('X-RA-Debug-Content-Type', contentType.slice(0, 60));
    respHeaders.set('X-RA-Debug-Upstream-Cookie-Host', upstreamCookieHost || '-');
    addOidcCallbackDebugHeaders(
      respHeaders,
      target,
      url.search,
      request.headers.get('Cookie'),
      upstreamHeaders.get('Cookie')
    );
  }
  const needsTextRewrite =
    shouldRewriteSessionTextResponse(target, upstreamResp) ||
    shouldRewriteCurrentHostTextResponse(target, session.origin_host, contentType);

  if (needsTextRewrite) {
    let text = await upstreamResp.text();

    if (target.host !== session.origin_host) {
      text = rewriteCurrentHostUrls(text, url.hostname, target.host);
    }

    // Ürün-bazlı proxy URL rewrite (EMIS vb.)
    if (shouldRewriteSessionTextResponse(target, upstreamResp)) {
      text = rewriteSessionTextProxyUrls(text, url.hostname, session.origin_host, proxyableHosts);
    }

    respHeaders.delete('Content-Length');
    respHeaders.delete('Content-Encoding');

    return new Response(text, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  }

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

function buildSessionHostResponseHeaders(incoming, proxyHostname, originHost, currentTargetHost, proxyableHosts) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    if (STRIP_RESPONSE.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === 'set-cookie') {
      continue;
    }
    if (k.toLowerCase() === 'location') {
      const rewritten = rewriteSessionHostLocationWithUpstreamCookie(
        v,
        proxyHostname,
        originHost,
        currentTargetHost,
        proxyableHosts
      );
      out.set('Location', rewritten.location);
      if (rewritten.upstreamCookie) {
        out.append('Set-Cookie', rewritten.upstreamCookie);
      }
      continue;
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

async function handlePathProxy(request, env, ctx, url) {
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

  // Oturum ana host'unu mevcut URL label'ıyla kıyasla.
  // OIDC ve multi-origin akışlarında (örn. scifinder-n.cas.org → sso.cas.org →
  // scifinder-n.cas.org/pa/oidc/cb) farklı bir host gelebilir; ürünün
  // ra_host_allowlist_json listesindeyse aynı oturumla erişime izin ver.
  if (session.target_host !== targetHost) {
    const allowedHosts = await loadProductAllowedHosts(env.DB, session.product_slug, session.target_host);
    if (!allowedHosts.has(targetHost)) {
      return htmlError(403,
        'Bu oturum farklı bir kaynağa ait. Portal üzerinden ilgili kaynağa yeniden erişin.');
    }
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

  if (upstreamResp.status === 401 || upstreamResp.status === 403) {
    ctx.waitUntil(writeUpstreamAlert(env, {
      product_slug: session.product_slug,
      institution_id: session.institution_id,
      target_host: targetUrl.hostname,
      status: upstreamResp.status,
    }));
  }

  const baseHost = env.RA_PROXY_BASE_HOST || url.hostname;
  const respHeaders = buildResponseHeaders(upstreamResp.headers, baseHost, encodedLabel);
  addStagingDebugHeaders(respHeaders, env, {
    targetUrl: targetUrl.toString(),
    upstreamStatus: upstreamResp.status,
    requestCookies: request.headers.get('Cookie'),
    upstreamCookies: upstreamHeaders.get('Cookie'),
    upstreamSetCookies: upstreamResp.headers,
    upstreamLocation: upstreamResp.headers.get('Location'),
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

// EZproxy stanza'sından: HTTPHeader -request -process x-cas*
// CAS'in kendi header'ları publisher'a iletilmemeli.
function isCasPrivateHeader(lower) {
  return lower.startsWith('x-cas');
}

export function buildUpstreamHeaders(incoming, context = {}) {
  const out = new Headers();
  let sawUserAgent = false;
  for (const [k, v] of incoming.entries()) {
    const lower = k.toLowerCase();
    if (HOP_BY_HOP.has(lower) || STRIP_REQUEST.has(lower) || isCasPrivateHeader(lower)) continue;
    if (context.forceDesktopUserAgent && lower === 'user-agent') {
      out.set('User-Agent', DESKTOP_USER_AGENT);
      sawUserAgent = true;
      continue;
    }
    if (context.forceDesktopUserAgent && lower === 'sec-ch-ua-mobile') {
      out.set('Sec-CH-UA-Mobile', '?0');
      continue;
    }
    if (context.forceDesktopUserAgent && lower === 'sec-ch-ua-platform') {
      out.set('Sec-CH-UA-Platform', '"Windows"');
      continue;
    }
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
  if (context.forceDesktopUserAgent && !sawUserAgent) {
    out.set('User-Agent', DESKTOP_USER_AGENT);
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

function parseSessionHostTarget(pathname, originHost, proxyableHosts, upstreamCookieHost = null) {
  if (!pathname.startsWith(SESSION_ALT_HOST_PREFIX)) {
    return { host: upstreamCookieHost || originHost, path: pathname || '/' };
  }

  const rest = pathname.slice(SESSION_ALT_HOST_PREFIX.length);
  const slashIdx = rest.indexOf('/');
  const encodedHost = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  if (!isValidEncodedHost(encodedHost)) return null;

  const host = decodeHost(encodedHost);
  if (!proxyableHosts.has(host)) return null;

  const path = slashIdx === -1 ? '/' : rest.slice(slashIdx);
  return { host, path };
}

export function rewriteSessionHostLocation(location, proxyHostname, originHost, currentTargetHost, proxyableHosts) {
  if (!location) return location;
  try {
    const loc = new URL(location);
    if (!proxyableHosts.has(loc.hostname)) return location;
    return `https://${proxyHostname}${sessionHostPathFor(loc.hostname, originHost, loc.pathname)}${loc.search}${loc.hash}`;
  } catch {
    if (!location.startsWith('/')) return location;
    return sessionHostPathFor(currentTargetHost, originHost, location);
  }
}

export function rewriteSessionHostLocationWithUpstreamCookie(
  location,
  proxyHostname,
  originHost,
  currentTargetHost,
  proxyableHosts
) {
  const fallback = { location, upstreamCookie: null };
  if (!location) return fallback;

  try {
    const loc = new URL(location);
    const targetHost = normalizeHost(loc.hostname);
    if (!targetHost || !proxyableHosts.has(targetHost)) return fallback;

    const rewrittenLocation = `https://${proxyHostname}${loc.pathname || '/'}${loc.search}${loc.hash}`;
    return {
      location: rewrittenLocation,
      upstreamCookie: targetHost === originHost
        ? clearUpstreamHostCookie(proxyHostname)
        : buildUpstreamHostCookie(proxyHostname, targetHost),
    };
  } catch {
    if (!location.startsWith('/')) return fallback;

    const targetHost = normalizeHost(currentTargetHost);
    return {
      location,
      upstreamCookie: targetHost && targetHost !== originHost
        ? buildUpstreamHostCookie(proxyHostname, targetHost)
        : clearUpstreamHostCookie(proxyHostname),
    };
  }
}

function sessionHostPathFor(targetHost, originHost, pathname) {
  const path = pathname || '/';
  if (targetHost === originHost) return path;
  return `${SESSION_ALT_HOST_PREFIX}${encodeHost(targetHost)}${path.startsWith('/') ? path : `/${path}`}`;
}

function shouldRewriteSessionTextResponse(target, upstreamResp) {
  const contentType = upstreamResp.headers.get('Content-Type') || '';
  if (!/\b(javascript|ecmascript|json|text\/)/i.test(contentType)) return false;

  // EMIS mobile keeps API origins in a tiny runtime config file. Rewriting only
  // this file avoids touching large application bundles while fixing mobile XHRs.
  return target.host === 'm.emis.com'
    && /^\/config\/application(?:_[a-z0-9-]+)?\.js$/i.test(target.path);
}

function shouldRewriteCurrentHostTextResponse(target, originHost, contentType) {
  if (!target || target.host === originHost) return false;
  return /\b(javascript|ecmascript|json|text\/html|text\/plain|text\/css)/i.test(contentType || '');
}

export function rewriteCurrentHostUrls(text, proxyHostname, currentTargetHost) {
  const host = normalizeHost(currentTargetHost);
  if (!host) return String(text || '');

  return String(text || '')
    .replaceAll(`https://${host}`, `https://${proxyHostname}`)
    .replaceAll(`http://${host}`, `https://${proxyHostname}`)
    .replaceAll(`//${host}`, `//${proxyHostname}`);
}

export function rewriteSessionTextProxyUrls(text, proxyHostname, originHost, proxyableHosts) {
  let out = String(text || '');
  for (const targetHost of proxyableHosts) {
    const proxyOrigin = targetHost === originHost
      ? `https://${proxyHostname}`
      : `https://${proxyHostname}${SESSION_ALT_HOST_PREFIX}${encodeHost(targetHost)}`;

    out = out
      .replaceAll(`https://${targetHost}`, proxyOrigin)
      .replaceAll(`http://${targetHost}`, proxyOrigin);
  }

  return out.replace(
    /cookieDomain:\s*(['"])\.emis\.com\1/g,
    `cookieDomain: '${proxyHostname}'`
  );
}

// path_proxy cross-domain kontrolü için — ürünün ra_host_allowlist_json'unu yükler.
// OIDC, federated SSO gibi multi-origin akışlarda aynı oturum farklı hostlara
// yönlenebilir; bunların allowlist'te olması gerekir.
async function loadProductAllowedHosts(db, productSlug, originHost) {
  const hosts = new Set([originHost]);
  const product = await db
    .prepare('SELECT ra_host_allowlist_json FROM products WHERE slug = ?')
    .bind(productSlug)
    .first();
  if (product && product.ra_host_allowlist_json) {
    try {
      const list = JSON.parse(product.ra_host_allowlist_json);
      if (Array.isArray(list)) {
        for (const h of list) {
          const host = normalizeHost(h);
          if (host) hosts.add(host);
        }
      }
    } catch {
      // Bozuk JSON — sadece origin ile devam et
    }
  }
  return hosts;
}

async function loadSessionProxyableHosts(db, session) {
  const hosts = new Set([session.origin_host]);
  const product = await db
    .prepare(
      `SELECT ra_host_allowlist_json
       FROM products
       WHERE slug = ?`
    )
    .bind(session.product_slug)
    .first();

  if (product && product.ra_host_allowlist_json) {
    try {
      const parsed = JSON.parse(product.ra_host_allowlist_json);
      if (Array.isArray(parsed)) {
        for (const rawHost of parsed) {
          const host = normalizeHost(rawHost);
          if (host) hosts.add(host);
        }
      }
    } catch {
      // Malformed admin config: keep origin-only rather than failing all access.
    }
  }
  return hosts;
}

function normalizeHost(rawHost) {
  const host = String(rawHost || '').trim().toLowerCase();
  if (!host) return '';
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)
    ? host
    : '';
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

function readAllowedUpstreamHostCookie(cookieHeader, proxyableHosts) {
  const host = normalizeHost(readCookie(cookieHeader, UPSTREAM_HOST_COOKIE));
  if (!host || !proxyableHosts.has(host)) return null;
  return host;
}

function buildSessionCookie(sid, baseHost) {
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
    `Domain=${baseHost}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    `Max-Age=${SESSION_TTL_SEC}`
  );
}

function buildUpstreamHostCookie(proxyHostname, host) {
  return (
    `${UPSTREAM_HOST_COOKIE}=${encodeURIComponent(host)}; ` +
    `Domain=${proxyHostname}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    `Max-Age=${SESSION_TTL_SEC}`
  );
}

function clearUpstreamHostCookie(proxyHostname) {
  return (
    `${UPSTREAM_HOST_COOKIE}=; ` +
    `Domain=${proxyHostname}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    'Max-Age=0'
  );
}

export function stripSessionCookie(header) {
  if (!header) return '';
  const kept = [];
  for (const part of String(header).split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE || name === UPSTREAM_HOST_COOKIE) continue;
    kept.push(part);
  }
  return kept.join('; ');
}

async function loadSessionHostCookieJar(env, sessionId, targetHost) {
  try {
    return await env.RA_UPSTREAM_SESSIONS.get(sessionHostCookieJarKey(sessionId, targetHost)) || '';
  } catch (err) {
    console.warn('session host cookie jar read failed', err);
    return '';
  }
}

async function persistSessionHostCookieJar(env, sessionId, targetHost, currentCookieHeader, responseHeaders) {
  const setCookies = collectSetCookies(responseHeaders);
  if (!setCookies.length) return;
  const merged = mergeSessionHostSetCookies(currentCookieHeader, setCookies);
  try {
    await env.RA_UPSTREAM_SESSIONS.put(
      sessionHostCookieJarKey(sessionId, targetHost),
      merged,
      { expirationTtl: SESSION_TTL_SEC }
    );
  } catch (err) {
    console.warn('session host cookie jar write failed', err);
  }
}

function sessionHostCookieJarKey(sessionId, targetHost) {
  return `rhostjar:${sessionId}:${targetHost}`;
}

export function mergeSessionHostCookieJar(stored, browser) {
  const map = new Map();
  for (const source of [stored, browser]) {
    if (!source) continue;
    for (const pair of String(source).split(';').map(s => s.trim()).filter(Boolean)) {
      const idx = pair.indexOf('=');
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name) map.set(name, value);
    }
  }
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function mergeSessionHostSetCookies(existingCookieHeader, setCookies) {
  const map = new Map();
  for (const pair of String(existingCookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    map.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }

  for (const sc of setCookies || []) {
    const parts = String(sc || '').split(';').map(s => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    const idx = parts[0].indexOf('=');
    if (idx <= 0) continue;
    const name = parts[0].slice(0, idx).trim();
    const value = parts[0].slice(idx + 1).trim();
    if (!name) continue;
    if (isExpiredSetCookie(parts)) {
      map.delete(name);
    } else {
      map.set(name, value);
    }
  }

  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function isExpiredSetCookie(parts) {
  for (let i = 1; i < parts.length; i += 1) {
    const lower = parts[i].toLowerCase();
    if (lower === 'max-age=0' || lower === 'max-age=-1') return true;
    if (lower.startsWith('expires=')) {
      const ts = Date.parse(parts[i].slice(8).trim());
      if (!Number.isNaN(ts) && ts <= Date.now()) return true;
    }
  }
  return false;
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
  if (info.upstreamLocation) headers.set('X-RA-Debug-Upstream-Location', truncateHeader(info.upstreamLocation, 220));
  if (info.origin) headers.set('X-RA-Debug-Origin', truncateHeader(info.origin, 120));
  if (info.referer) headers.set('X-RA-Debug-Referer', truncateHeader(info.referer, 180));
  if (info.upstreamOrigin) headers.set('X-RA-Debug-Upstream-Origin', truncateHeader(info.upstreamOrigin, 120));
  if (info.upstreamReferer) headers.set('X-RA-Debug-Upstream-Referer', truncateHeader(info.upstreamReferer, 180));
}

function addOidcCallbackDebugHeaders(headers, target, search, browserCookieHeader, upstreamCookieHeader) {
  if (!target || target.host !== 'scifinder-n.cas.org' || target.path !== '/pa/oidc/cb') {
    return;
  }
  const suffix = decodeOidcStateSuffix(search);
  headers.set('X-RA-Debug-Oidc-State-Suffix', suffix || '-');
  if (!suffix) {
    headers.set('X-RA-Debug-Oidc-Nonce-Cookie', '-');
    headers.set('X-RA-Debug-Oidc-Upstream-Nonce-Cookie', '-');
    return;
  }
  const cookieName = `nonce.${suffix}`;
  headers.set(
    'X-RA-Debug-Oidc-Nonce-Cookie',
    hasCookieName(browserCookieHeader, cookieName) ? 'present' : 'missing'
  );
  headers.set(
    'X-RA-Debug-Oidc-Upstream-Nonce-Cookie',
    hasCookieName(upstreamCookieHeader, cookieName) ? 'present' : 'missing'
  );
}

export function decodeOidcStateSuffix(search) {
  const state = new URLSearchParams(String(search || '').replace(/^\?/, '')).get('state');
  if (!state) return '';
  const [protectedHeader] = state.split('.');
  if (!protectedHeader) return '';
  try {
    const json = atob(protectedHeader.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json);
    return typeof parsed.suffix === 'string' ? parsed.suffix : '';
  } catch {
    return '';
  }
}

function hasCookieName(cookieHeader, name) {
  if (!cookieHeader || !name) return false;
  for (const part of String(cookieHeader).split(';').map(s => s.trim())) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return true;
  }
  return false;
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
