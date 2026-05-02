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
import { stableProxyHostLabel } from '../../../backend/src/ra/proxy-url.js';
import { egressFetch } from './egress-client.js';
import { writeUpstreamAlert } from './alert-writer.js';
import { htmlError } from './error-page.js';
import { enforceProxyRateLimit } from './rate-limit.js';

const SESSION_COOKIE  = 'ra_proxy_session';
const UPSTREAM_HOST_COOKIE = '__ra_upstream';
const SESSION_TTL_SEC = 3600;
const SESSION_ALT_HOST_PREFIX = '/__ra-host/';
const SESSION_ENTRY_REDIRECT_PATH = '/__ra-redirect';
const STABLE_ENTRY_REDIRECT_PATH = '/coproxy/redirect';
const CF_CHALLENGE_PROXY_PREFIX = '/__ra-cdn-cgi/';
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

  const stableHostMatch = hostname.match(/^([a-f0-9]{40})\./);
  if (stableHostMatch) {
    return await handleStableHost(request, env, ctx, url, stableHostMatch[1]);
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

  if (url.pathname === SESSION_ENTRY_REDIRECT_PATH) {
    return sessionEntryRedirectResponse(url);
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
  // Static asset tespitini upstream path'iyle yap. /__ra-host/<host>/... alt
  // host akışında url.pathname o prefix'le başlar; isStaticAssetPath'in prefix
  // kontrolleri (/static/, /_next/image, /assets/, ...) eşleşmez ve asset'ler
  // gereksiz yere KV write üretir. target.path üst-prefix kırpıldıktan sonraki
  // upstream path'tir; path-proxy modundaki remainingPath ile aynı semantiği taşır.
  const rateLimit = await enforceProxyRateLimit(env, sessionId, session, target.path);
  if (rateLimit) return proxyRateLimitResponse(rateLimit);

  // Upstream relay — path ve query aynen korunur, sadece host değişir.
  // Query params içindeki proxy hostname'i (r*.selmiye.com) origin'e rewrite et;
  // aksi hâlde EMIS gibi "ref=<current_url>" echo'layan siteler redirect loop oluşturur.
  const search = rewriteQueryProxyUrls(url.search, url.hostname, target.host);
  const targetUrl = `https://${target.host}${target.path}${search}`;
  const publisherCookieScopeHost = getPublisherCookieScopeHost(target.host);
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: target.host,
    forceDesktopUserAgent: session.product_slug === 'emis',
    publisherCookieScopeHost,
  });
  const useSessionCookieJar = shouldUseSessionCookieJar(publisherCookieScopeHost);
  const storedUpstreamCookies = useSessionCookieJar
    ? await loadSessionHostCookieJar(env, sessionId, target.host)
    : '';
  let effectiveUpstreamCookies = mergeSessionHostCookieJar(
    storedUpstreamCookies,
    upstreamHeaders.get('Cookie') || ''
  );
  if (effectiveUpstreamCookies && publisherCookieScopeHost) {
    effectiveUpstreamCookies = rewritePublisherCookieHeaderForUpstream(
      effectiveUpstreamCookies,
      publisherCookieScopeHost
    );
  }
  if (publisherCookieScopeHost) {
    effectiveUpstreamCookies = ensurePublisherScopedCookiesForwarded(
      effectiveUpstreamCookies,
      request.headers.get('Cookie'),
      publisherCookieScopeHost
    );
  }
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

  if (useSessionCookieJar) {
    await persistSessionHostCookieJar(
      env,
      sessionId,
      target.host,
      upstreamHeaders.get('Cookie') || '',
      upstreamResp.headers
    );
  }

  const respHeaders = buildSessionHostResponseHeaders(
    upstreamResp.headers,
    url.hostname,
    session.origin_host,
    target.host,
    proxyableHosts,
    {
      publisherCookieScopeHost,
      publisherCookieDomain: publisherCookieScopeHost
        ? proxyCookieDomainFromEnv(env, url.hostname)
        : null,
    }
  );
  addPublisherCookiePromotionHeaders(
    respHeaders,
    request.headers.get('Cookie'),
    publisherCookieScopeHost,
    proxyCookieDomainFromEnv(env, url.hostname)
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
    requestHeaders: request.headers,
    upstreamHeaders,
    publisherCookieScopeHost,
  });

  ctx.waitUntil(writeRaDebugEvent(env, {
    session,
    target,
    requestUrl: url.toString(),
    requestPath: url.pathname,
    upstreamResp,
    requestHeaders: request.headers,
    upstreamHeaders,
    publisherCookieScopeHost,
  }));

  const contentType = upstreamResp.headers.get('Content-Type') || '';
  if (String(env?.ENVIRONMENT || '').toLowerCase() === 'staging') {
    respHeaders.set('X-RA-Debug-Content-Type', contentType.slice(0, 60));
    respHeaders.set('X-RA-Debug-Upstream-Cookie-Host', upstreamCookieHost || '-');
    respHeaders.set('X-RA-Debug-Cookie-Namespace', publisherCookieScopeHost || '-');
    addOidcCallbackDebugHeaders(
      respHeaders,
      target,
      url.search,
      request.headers.get('Cookie'),
      upstreamHeaders.get('Cookie')
    );
  }
  sanitizeWafChallengeResponseHeaders(respHeaders, publisherCookieScopeHost);
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
    if (publisherCookieScopeHost) {
      text = rewritePublisherHostJavaScriptText(text, url.hostname, publisherCookieScopeHost, proxyableHosts);
      if (isCloudflareChallengeSurface(target, upstreamResp)) {
        text = rewriteCloudflareChallengeRuntimeLocation(text);
      }
      text = rewriteCloudflareChallengePaths(text);
    }
    if (publisherCookieScopeHost && /\btext\/html\b/i.test(contentType)) {
      text = relaxProxyMetaContentSecurityPolicy(text);
      text = injectPublisherCookieNamespaceScript(text, publisherCookieScopeHost, target.host);
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

async function handleStableHost(request, env, ctx, url, stableLabel) {
  const token = url.searchParams.get('t');
  if (token) {
    return await acceptStableHostToken(request, env, token, url, stableLabel);
  }

  if (url.pathname === STABLE_ENTRY_REDIRECT_PATH) {
    return stableHostEntryRedirectResponse(url);
  }

  const refParam = url.searchParams.get('ref') || '';
  if (refParam.includes(url.hostname)) {
    return htmlError(403,
      'Bu kaynağa erişim sağlanamadı.',
      'Yayıncı sunucusu kurumunuzun IP adresini tanımıyor olabilir. ' +
      'Lütfen sistem yöneticinizle iletişime geçin.'
    );
  }

  const sessionId = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  if (!sessionId) {
    return htmlError(401, 'Oturum bulunamadı. Lütfen portal üzerinden tekrar erişin.');
  }

  const session = await loadProxySession(env, sessionId);
  if (!session) {
    return htmlError(401, 'Oturum süresi dolmuş. Portal üzerinden yeniden erişin.');
  }

  const expectedLabel = await stableProxyHostLabel(session.product_slug, session.origin_host);
  if (expectedLabel !== stableLabel) {
    return htmlError(403, 'Bu sabit erişim hostu bu oturuma ait değil.');
  }

  return await proxySessionSurface(request, env, ctx, url, session, sessionId);
}

async function proxySessionSurface(request, env, ctx, url, session, sessionId) {
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

  const rateLimit = await enforceProxyRateLimit(env, sessionId, session, target.path);
  if (rateLimit) return proxyRateLimitResponse(rateLimit);

  const search = rewriteQueryProxyUrls(url.search, url.hostname, target.host);
  const targetUrl = `https://${target.host}${target.path}${search}`;
  const publisherCookieScopeHost = getPublisherCookieScopeHost(target.host);
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: target.host,
    forceDesktopUserAgent: session.product_slug === 'emis',
    publisherCookieScopeHost,
  });
  const useSessionCookieJar = shouldUseSessionCookieJar(publisherCookieScopeHost);
  const storedUpstreamCookies = useSessionCookieJar
    ? await loadSessionHostCookieJar(env, sessionId, target.host)
    : '';
  let effectiveUpstreamCookies = mergeSessionHostCookieJar(
    storedUpstreamCookies,
    upstreamHeaders.get('Cookie') || ''
  );
  if (effectiveUpstreamCookies && publisherCookieScopeHost) {
    effectiveUpstreamCookies = rewritePublisherCookieHeaderForUpstream(
      effectiveUpstreamCookies,
      publisherCookieScopeHost
    );
  }
  if (publisherCookieScopeHost) {
    effectiveUpstreamCookies = ensurePublisherScopedCookiesForwarded(
      effectiveUpstreamCookies,
      request.headers.get('Cookie'),
      publisherCookieScopeHost
    );
  }
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
    console.error('egress error (stable-host)', err);
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

  if (useSessionCookieJar) {
    await persistSessionHostCookieJar(
      env,
      sessionId,
      target.host,
      upstreamHeaders.get('Cookie') || '',
      upstreamResp.headers
    );
  }

  const respHeaders = buildSessionHostResponseHeaders(
    upstreamResp.headers,
    url.hostname,
    session.origin_host,
    target.host,
    proxyableHosts,
    {
      publisherCookieScopeHost,
      publisherCookieDomain: publisherCookieScopeHost
        ? proxyCookieDomainFromEnv(env, url.hostname)
        : null,
    }
  );
  addPublisherCookiePromotionHeaders(
    respHeaders,
    request.headers.get('Cookie'),
    publisherCookieScopeHost,
    proxyCookieDomainFromEnv(env, url.hostname)
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
    requestHeaders: request.headers,
    upstreamHeaders,
    publisherCookieScopeHost,
  });

  ctx.waitUntil(writeRaDebugEvent(env, {
    session,
    target,
    requestUrl: url.toString(),
    requestPath: url.pathname,
    upstreamResp,
    requestHeaders: request.headers,
    upstreamHeaders,
    publisherCookieScopeHost,
  }));

  const contentType = upstreamResp.headers.get('Content-Type') || '';
  if (String(env?.ENVIRONMENT || '').toLowerCase() === 'staging') {
    respHeaders.set('X-RA-Debug-Content-Type', contentType.slice(0, 60));
    respHeaders.set('X-RA-Debug-Upstream-Cookie-Host', upstreamCookieHost || '-');
    respHeaders.set('X-RA-Debug-Cookie-Namespace', publisherCookieScopeHost || '-');
    addOidcCallbackDebugHeaders(
      respHeaders,
      target,
      url.search,
      request.headers.get('Cookie'),
      upstreamHeaders.get('Cookie')
    );
  }
  sanitizeWafChallengeResponseHeaders(respHeaders, publisherCookieScopeHost);
  const needsTextRewrite =
    shouldRewriteSessionTextResponse(target, upstreamResp) ||
    shouldRewriteCurrentHostTextResponse(target, session.origin_host, contentType);

  if (needsTextRewrite) {
    let text = await upstreamResp.text();

    if (target.host !== session.origin_host) {
      text = rewriteCurrentHostUrls(text, url.hostname, target.host);
    }

    if (shouldRewriteSessionTextResponse(target, upstreamResp)) {
      text = rewriteSessionTextProxyUrls(text, url.hostname, session.origin_host, proxyableHosts);
    }
    if (publisherCookieScopeHost) {
      text = rewritePublisherHostJavaScriptText(text, url.hostname, publisherCookieScopeHost, proxyableHosts);
      if (isCloudflareChallengeSurface(target, upstreamResp)) {
        text = rewriteCloudflareChallengeRuntimeLocation(text);
      }
      text = rewriteCloudflareChallengePaths(text);
    }
    if (publisherCookieScopeHost && /\btext\/html\b/i.test(contentType)) {
      text = relaxProxyMetaContentSecurityPolicy(text);
      text = injectPublisherCookieNamespaceScript(text, publisherCookieScopeHost, target.host);
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

export async function acceptSessionHostToken(request, env, token, url, sessionId) {
  // Token doğrula
  let payload;
  try {
    payload = await verifyProxyToken(token, env.RA_PROXY_TOKEN_SECRET);
  } catch (err) {
    return htmlError(401, 'Erişim bağlantısı geçersiz veya süresi dolmuş.', err.message);
  }

  // jti tek kullanımlık. Ancak Chrome'un yeni-tab açarken yaptığı speculative
  // duplicate fetch (aynı URL'i iki defa istemesi) bu kontrolü tetikleyip
  // kullanıcıyı 401'e düşürüyor. jti consumed ama cookie+session zaten valid'se
  // bu duplicate fetch race'idir — sessizce 302 ile redirect et, kullanıcıya
  // hata gösterme.
  const jtiKey = `ra:jti:${payload.jti}`;
  const used = await safeKvGet(env.RATE_LIMIT_KV, jtiKey);
  const cookieSid = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);

  // mod uyumu kontrolü (jti henüz tüketilmemiş veya sadece doğrulama amaçlı)
  if (payload.mod !== 'session_host_proxy') {
    return htmlError(400, 'Token modu bu proxy ile uyumsuz.');
  }

  // KV session'ı doğrula (issue-token tarafından önceden yazılmış)
  const session = await env.RA_UPSTREAM_SESSIONS.get(`rhost:${sessionId}`, 'json');

  if (used) {
    // Idempotent yol: jti kullanılmış ama bu istek zaten doğru sessionId
    // cookie'sini taşıyor ve KV'da geçerli session var → graceful 302.
    if (cookieSid === sessionId && session && session.expires_at >= Math.floor(Date.now() / 1000)) {
      const clean = new URL(url);
      clean.searchParams.delete('t');
      const location = shouldUseSessionEntryRedirect(session)
        ? buildSessionEntryRedirectUrl(clean)
        : clean.toString();
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      });
    }
    return htmlError(401, 'Bu bağlantı daha önce kullanılmış. Portal üzerinden yeni bağlantı alın.');
  }
  await safeKvPut(env.RATE_LIMIT_KV, jtiKey, 'used', { expirationTtl: 600 });

  if (!session) {
    return htmlError(401, 'Oturum kaydı bulunamadı. Token ile session eşleşmiyor.');
  }

  // Cookie set et — SADECE bu subdomain'e (cross-session izolasyon)
  const clean = new URL(url);
  clean.searchParams.delete('t');
  const location = shouldUseSessionEntryRedirect(session)
    ? buildSessionEntryRedirectUrl(clean)
    : clean.toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie':
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ` +
        `Domain=${url.hostname}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`,
    },
  });
}

export async function acceptStableHostToken(request, env, token, url, stableLabel) {
  let payload;
  try {
    payload = await verifyProxyToken(token, env.RA_PROXY_TOKEN_SECRET);
  } catch (err) {
    return htmlError(401, 'Erişim bağlantısı geçersiz veya süresi dolmuş.', err.message);
  }

  if (payload.mod !== 'stable_host_proxy') {
    return htmlError(400, 'Token modu bu proxy ile uyumsuz.');
  }

  const expectedLabel = await stableProxyHostLabel(payload.pid, payload.tgt);
  if (expectedLabel !== stableLabel) {
    return htmlError(403, 'Token bu sabit erişim hostuna ait değil.');
  }

  const jtiKey = `ra:jti:${payload.jti}`;
  const used = await safeKvGet(env.RATE_LIMIT_KV, jtiKey);
  const cookieSid = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  const existingSession = cookieSid ? await loadProxySession(env, cookieSid) : null;

  if (used) {
    if (
      existingSession &&
      existingSession.product_slug === payload.pid &&
      existingSession.origin_host === payload.tgt
    ) {
      const clean = new URL(url);
      clean.searchParams.delete('t');
      return new Response(null, {
        status: 302,
        headers: { Location: buildStableHostEntryRedirectUrl(clean) },
      });
    }
    return htmlError(401, 'Bu bağlantı daha önce kullanılmış. Portal üzerinden yeni bağlantı alın.');
  }
  await safeKvPut(env.RATE_LIMIT_KV, jtiKey, 'used', { expirationTtl: 600 });

  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();
  await safeKvPut(
    env.RA_UPSTREAM_SESSIONS,
    `proxysess:${sessionId}`,
    JSON.stringify({
      origin_host:     payload.tgt,
      institution_id:  payload.iid,
      user_id:         payload.sub,
      product_slug:    payload.pid,
      subscription_id: payload.sid,
      created_at:      now,
      expires_at:      now + SESSION_TTL_SEC,
    }),
    { expirationTtl: SESSION_TTL_SEC }
  );

  const clean = new URL(url);
  clean.searchParams.delete('t');

  return new Response(null, {
    status: 302,
    headers: {
      Location: buildStableHostEntryRedirectUrl(clean),
      'Set-Cookie':
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ` +
        `Domain=${url.hostname}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`,
    },
  });
}

function shouldUseSessionEntryRedirect(session) {
  return Boolean(getPublisherCookieScopeHost(session?.origin_host));
}

function buildSessionEntryRedirectUrl(cleanUrl) {
  const next = new URL(cleanUrl.toString());
  const targetPath = `${cleanUrl.pathname || '/'}${cleanUrl.search || ''}${cleanUrl.hash || ''}`;
  next.pathname = SESSION_ENTRY_REDIRECT_PATH;
  next.search = '';
  next.hash = '';
  next.searchParams.set('to', targetPath || '/');
  return next.toString();
}

function sessionEntryRedirectResponse(url) {
  const to = url.searchParams.get('to') || '/';
  const location = isSafeSessionEntryPath(to) ? to : '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

function buildStableHostEntryRedirectUrl(cleanUrl) {
  const next = new URL(cleanUrl.toString());
  const target = new URL(cleanUrl.toString());
  next.pathname = STABLE_ENTRY_REDIRECT_PATH;
  next.search = '';
  next.hash = '';
  next.searchParams.set('redirectUrl', target.toString());
  return next.toString();
}

function stableHostEntryRedirectResponse(url) {
  const redirectUrl = url.searchParams.get('redirectUrl') || '';
  let location = `https://${url.hostname}/`;
  try {
    const parsed = new URL(redirectUrl);
    if (parsed.protocol === 'https:' && parsed.hostname === url.hostname) {
      location = parsed.toString();
    }
  } catch {
    location = '/';
  }
  const safeJsonLocation = JSON.stringify(location).replace(/<\/script/gi, '<\\/script');
  const safeAttrLocation = escapeHtmlAttr(location);
  const html = `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="referrer" content="strict-origin-when-cross-origin">` +
    `<meta http-equiv="refresh" content="0;url=${safeAttrLocation}">` +
    `<script>location.replace(${safeJsonLocation});</script>` +
    `</head><body><a href="${safeAttrLocation}">Continue</a></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeSessionEntryPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !/[\r\n]/.test(value);
}

export function buildSessionHostResponseHeaders(incoming, proxyHostname, originHost, currentTargetHost, proxyableHosts, options = {}) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    const lower = k.toLowerCase();
    if (STRIP_RESPONSE.has(lower)) continue;
    if (options.publisherCookieScopeHost && STRIP_WAF_CHALLENGE_RESPONSE.has(lower)) continue;
    if (lower === 'set-cookie') {
      continue;
    }
    if (lower === 'location') {
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
    out.append('Set-Cookie', rewriteSessionHostSetCookie(sc, proxyHostname, options));
  }
  if (options.publisherCookieScopeHost) {
    out.set('Content-Security-Policy', RELAXED_PROXY_CSP);
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
  // Path-proxy modunda url.pathname encoded host prefix'iyle başlar
  // (/www-jove-com/...). Static asset tespiti için upstream'e yönelik olan
  // remainingPath'i geç; aksi hâlde /_next/static/, /assets/ gibi prefix'ler
  // session-host modundaki gibi yakalanmaz, modlar arasında tutarsızlık olur.
  const rateLimit = await enforceProxyRateLimit(env, sessionId, session, remainingPath);
  if (rateLimit) return proxyRateLimitResponse(rateLimit);

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

  // Use the actual request host for path-proxy rewrites. RA_PROXY_BASE_HOST may
  // be the bare apex (selmiye.com), which is served by Pages and causes 404s.
  const baseHost = url.hostname;
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
    requestHeaders: request.headers,
    upstreamHeaders,
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
  const used = await safeKvGet(env.RATE_LIMIT_KV, jtiKey);
  if (used) {
    return htmlError(401, 'Bu erişim bağlantısı daha önce kullanılmış. Portal üzerinden yeni bağlantı alın.');
  }
  await safeKvPut(env.RATE_LIMIT_KV, jtiKey, 'used', { expirationTtl: 600 });

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
  // Cookie must stay scoped to the active proxy host, not the bare apex.
  const baseHost = url.hostname;

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

async function safeKvGet(kv, key) {
  try {
    return kv ? await kv.get(key) : null;
  } catch (err) {
    console.warn('kv get failed open', err);
    return null;
  }
}

async function safeKvPut(kv, key, value, options) {
  try {
    if (kv) await kv.put(key, value, options);
  } catch (err) {
    console.warn('kv put failed open', err);
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
  // Browser HTML document navigasyonu mu? Üst seviye sayfa isteğinde
  // Sec-Fetch-Dest=document ve/veya Accept text/html olur. Bu tespit edilirse
  // Cloudflare/Imperva gibi bot detection'a takılmamak için tarayıcının
  // address-bar yazımı sırasındaki "natural navigation" header setini taklit ederiz.
  const isDocNav = isDocumentNavigation(incoming);
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
    // Document navigasyonunda Sec-Fetch-Site=cross-site forward edilirse
    // Cloudflare WAF "external link from suspicious origin" görür ve
    // ACS gibi sertleşmiş publisher'larda root sayfayı 403 ile döner.
    // Tarayıcının doğrudan address-bar'a yazma davranışına çevir.
    if (isDocNav && lower === 'sec-fetch-site') {
      out.set('Sec-Fetch-Site', context.publisherCookieScopeHost ? 'same-origin' : 'none');
      continue;
    }
    if (isDocNav && lower === 'sec-fetch-mode') {
      out.set('Sec-Fetch-Mode', 'navigate');
      continue;
    }
    if (isDocNav && lower === 'sec-fetch-user') {
      out.set('Sec-Fetch-User', '?1');
      continue;
    }
    if (isDocNav && lower === 'sec-fetch-dest') {
      out.set('Sec-Fetch-Dest', 'document');
      continue;
    }
    if (lower === 'cookie') {
      let cleaned = stripSessionCookie(v);
      if (cleaned) {
        cleaned = rewritePublisherCookieHeaderForUpstream(
          cleaned,
          context.publisherCookieScopeHost || ''
        );
      }
      if (cleaned) out.set(k, cleaned);
      continue;
    }
    if (lower === 'origin' || lower === 'referer') {
      // Document navigasyonunda Referer'ı tamamen sil — proxy domain'i
      // Cloudflare bot detection'a "external referrer" sinyali gönderiyor.
      if (isDocNav && lower === 'referer' && !context.publisherCookieScopeHost) continue;
      if (isDocNav && lower === 'referer' && context.publisherCookieScopeHost) {
        const normalized = rewriteNamespaceDocumentReferer(v, context);
        if (normalized) out.set(k, normalized);
        continue;
      }
      const rewritten = rewriteClientContextHeader(k, v, context);
      if (rewritten) out.set(k, rewritten);
      continue;
    }
    out.set(k, v);
  }
  if (context.forceDesktopUserAgent && !sawUserAgent) {
    out.set('User-Agent', DESKTOP_USER_AGENT);
  }
  // Document navigasyonunda eksik olan natural-navigation hint'lerini doldur.
  if (isDocNav) {
    if (!out.has('Sec-Fetch-Site')) {
      out.set('Sec-Fetch-Site', context.publisherCookieScopeHost ? 'same-origin' : 'none');
    }
    if (!out.has('Sec-Fetch-Mode')) out.set('Sec-Fetch-Mode', 'navigate');
    if (!out.has('Sec-Fetch-User')) out.set('Sec-Fetch-User', '?1');
    if (!out.has('Sec-Fetch-Dest')) out.set('Sec-Fetch-Dest', 'document');
    if (!out.has('Upgrade-Insecure-Requests')) out.set('Upgrade-Insecure-Requests', '1');
    if (!out.has('Accept-Language')) out.set('Accept-Language', 'tr-TR,tr;q=0.9,en;q=0.8');
  }
  return out;
}

/**
 * Browser HTML document navigasyonu tespiti.
 *
 * Üst seviye HTML sayfası isteği iki sinyalden tanınır:
 *  - Sec-Fetch-Dest: document  (modern tarayıcılar her zaman gönderir)
 *  - Accept: text/html ile başlar  (Sec-Fetch-Dest yoksa fallback)
 *
 * Asset request'leri (CSS/JS/image/font/XHR) için false döner; onların doğal
 * Sec-Fetch değerleri korunur.
 */
function isDocumentNavigation(headers) {
  const dest = headers.get('Sec-Fetch-Dest');
  if (dest) return dest.toLowerCase() === 'document';
  const accept = headers.get('Accept') || '';
  return /^text\/html\b/i.test(accept);
}

const STRIP_RESPONSE = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'trailer',
  'content-security-policy', 'content-security-policy-report-only',
  'strict-transport-security',
]);
const STRIP_WAF_CHALLENGE_RESPONSE = new Set([
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
  'permissions-policy',
  'referrer-policy',
]);
const RELAXED_PROXY_CSP = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *;";

function sanitizeWafChallengeResponseHeaders(headers, scopeHost) {
  if (!scopeHost) return;
  for (const name of STRIP_WAF_CHALLENGE_RESPONSE) {
    headers.delete(name);
  }
  headers.set('Content-Security-Policy', RELAXED_PROXY_CSP);
  headers.set('X-RA-Debug-WAF-Policy-Strip', '1');
}

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
    return {
      host: upstreamCookieHost || originHost,
      path: rewriteProxyChallengePath(pathname || '/'),
    };
  }

  const rest = pathname.slice(SESSION_ALT_HOST_PREFIX.length);
  const slashIdx = rest.indexOf('/');
  const encodedHost = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  if (!isValidEncodedHost(encodedHost)) return null;

  const host = decodeHost(encodedHost);
  if (!proxyableHosts.has(host)) return null;

  const path = rewriteProxyChallengePath(slashIdx === -1 ? '/' : rest.slice(slashIdx));
  return { host, path };
}

function rewriteProxyChallengePath(pathname) {
  const path = pathname || '/';
  if (path.startsWith(CF_CHALLENGE_PROXY_PREFIX)) {
    return `/cdn-cgi/${path.slice(CF_CHALLENGE_PROXY_PREFIX.length)}`;
  }
  return path;
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
  if (/\btext\/html\b/i.test(contentType)) return true;

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
      .replaceAll(`http://${targetHost}`, proxyOrigin)
      .replaceAll(`//${targetHost}`, proxyOrigin.replace(/^https:/, ''));
  }

  return out.replace(
    /cookieDomain:\s*(['"])\.emis\.com\1/g,
    `cookieDomain: '${proxyHostname}'`
  );
}

export function rewriteCloudflareChallengePaths(text) {
  return String(text || '')
    .replaceAll('/cdn-cgi/', CF_CHALLENGE_PROXY_PREFIX)
    .replaceAll('\\/cdn-cgi\\/', '\\/__ra-cdn-cgi\\/')
    .replace(/\\u002fcdn-cgi\\u002f/gi, '\\u002f__ra-cdn-cgi\\u002f')
    .replace(/%2fcdn-cgi%2f/gi, '%2F__ra-cdn-cgi%2F');
}

function isCloudflareChallengeSurface(target, upstreamResp) {
  const path = String(target?.path || '');
  const mitigated = String(upstreamResp?.headers?.get('cf-mitigated') || '').toLowerCase();
  return mitigated === 'challenge' || path.startsWith('/cdn-cgi/challenge-platform/');
}

export function rewriteCloudflareChallengeRuntimeLocation(text) {
  return String(text || '').replace(
    /\b(?:(?:window|self|document)\.)?location\.(hostname|host|origin|href)\b/g,
    (_match, prop) => `window.__raPublisherLocation.${prop}`
  );
}

export function rewritePublisherHostJavaScriptText(text, proxyHostname, scopeHost, proxyableHosts) {
  let out = String(text || '');
  const hosts = new Set();
  for (const host of proxyableHosts || []) {
    const normalized = normalizeHost(host);
    if (normalized && (normalized === scopeHost || normalized.endsWith(`.${scopeHost}`))) {
      hosts.add(normalized);
    }
  }
  hosts.add(scopeHost);
  hosts.add(`www.${scopeHost}`);

  for (const host of hosts) {
    out = replaceQuotedHost(out, host, proxyHostname);
    if (host === scopeHost) {
      out = replaceQuotedHost(out, `.${host}`, proxyHostname);
    }
  }
  return out;
}

function replaceQuotedHost(text, fromHost, toHost) {
  const escaped = escapeRegExp(fromHost);
  return String(text || '').replace(
    new RegExp(`(['"])${escaped}\\1`, 'gi'),
    (_m, quote) => `${quote}${toHost}${quote}`
  );
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function relaxProxyMetaContentSecurityPolicy(text) {
  return String(text || '').replace(
    /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?content-security-policy["']?)[^>]*>/gi,
    ''
  );
}

export function injectPublisherCookieNamespaceScript(text, scopeHost, originHost = '') {
  const html = String(text || '');
  if (!scopeHost || html.includes('__raPublisherCookieNamespace')) return html;

  const script = buildPublisherCookieNamespaceScript(scopeHost, originHost);
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  }
  if (/<script\b/i.test(html)) {
    return html.replace(/<script\b/i, `${script}<script`);
  }
  return `${script}${html}`;
}

function buildPublisherCookieNamespaceScript(scopeHost, originHost = '') {
  const safeScope = JSON.stringify(String(scopeHost || '').toLowerCase()).replace(/<\/script/gi, '<\\/script');
  const safeOriginHost = JSON.stringify(normalizeHost(originHost) || String(originHost || '').toLowerCase()).replace(/<\/script/gi, '<\\/script');
  return `<script>(function(){try{var scope=${safeScope};var originHost=${safeOriginHost}||('www.'+scope);var origin='https://'+originHost;window.__raPublisherLocation={hostname:originHost,host:originHost,origin:origin,get href(){return origin+location.pathname+location.search+location.hash;}};var prefix='__cp_'+scope+'|';var names={cf_clearance:1,__cf_bm:1,EMER_SessionId:1};var d=Object.getOwnPropertyDescriptor(Document.prototype,'cookie')||Object.getOwnPropertyDescriptor(HTMLDocument.prototype,'cookie');if(!d||!d.get||!d.set||window.__raPublisherCookieNamespace)return;Object.defineProperty(window,'__raPublisherCookieNamespace',{value:1});Object.defineProperty(document,'cookie',{configurable:true,get:function(){var raw=d.get.call(document)||'';return raw.split(/;\\s*/).filter(Boolean).map(function(p){var i=p.indexOf('=');if(i<1)return p;var n=p.slice(0,i);if(n.indexOf(prefix)===0)return n.slice(prefix.length)+p.slice(i);return p;}).join('; ');},set:function(v){var s=String(v||'');var semi=s.indexOf(';');var end=semi<0?s.length:semi;var eq=s.indexOf('=');if(eq>0&&eq<end){var n=s.slice(0,eq).trim();if(names[n]&&n.indexOf(prefix)!==0){s=prefix+n+s.slice(eq);s=s.replace(/;\\s*domain=[^;]*/ig,'');}}return d.set.call(document,s);}});}catch(e){}})();</script>`;
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

function proxyRateLimitResponse(rateLimit) {
  const resp = htmlError(
    429,
    'Bu oturumdan çok fazla istek geldi. Lütfen kısa bir süre sonra tekrar deneyin.'
  );
  resp.headers.set('Retry-After', String(rateLimit.retryAfter || 60));
  resp.headers.set('X-RA-Rate-Limit-Scope', rateLimit.scope || 'proxy');
  return resp;
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

function shouldUseSessionCookieJar(publisherCookieScopeHost) {
  return !publisherCookieScopeHost;
}

async function persistSessionHostCookieJar(env, sessionId, targetHost, currentCookieHeader, responseHeaders) {
  const setCookies = collectSetCookies(responseHeaders);
  if (!setCookies.length) return;
  const merged = mergeSessionHostSetCookies(currentCookieHeader, setCookies);
  if (merged === String(currentCookieHeader || '')) return;
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
    const name = pair.slice(0, idx).trim();
    if (!isSessionJarVolatileCookieName(name)) {
      map.set(name, pair.slice(idx + 1).trim());
    }
  }

  for (const sc of setCookies || []) {
    const parts = String(sc || '').split(';').map(s => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    const idx = parts[0].indexOf('=');
    if (idx <= 0) continue;
    const name = parts[0].slice(0, idx).trim();
    const value = parts[0].slice(idx + 1).trim();
    if (!name) continue;
    if (isSessionJarVolatileCookieName(name)) {
      map.delete(name);
      continue;
    }
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

function isSessionJarVolatileCookieName(name) {
  const lower = String(name || '').toLowerCase();
  return lower === 'cf_clearance' || lower === '__cf_bm';
}

export function rewriteSessionHostSetCookie(setCookie, proxyHostname, options = {}) {
  const scopeHost = options.publisherCookieScopeHost || '';
  if (scopeHost) {
    return rewritePublisherSetCookie(
      prefixPublisherSetCookieName(setCookie, scopeHost),
      {
        domain: options.publisherCookieDomain || proxyHostname,
        path: '/',
      }
    );
  }
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

function rewriteNamespaceDocumentReferer(value, context = {}) {
  if (!value || !context.originHost) return value;
  try {
    const parsed = new URL(value);
    if (parsed.hostname === context.proxyHostname) {
      if (parsed.pathname === STABLE_ENTRY_REDIRECT_PATH) {
        const redirectUrl = parsed.searchParams.get('redirectUrl') || '';
        try {
          const target = new URL(redirectUrl);
          if (target.hostname === context.proxyHostname) {
            return `https://${context.originHost}${target.pathname || '/'}${target.search}${target.hash}`;
          }
        } catch {
          return `https://${context.originHost}/`;
        }
      }
      return rewriteClientContextHeader('Referer', value, context);
    }
    return `https://${context.originHost}/`;
  } catch {
    return `https://${context.originHost}/`;
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

const PUBLISHER_COOKIE_PREFIX = '__cp_';
const PUBLISHER_COOKIE_SCOPE_HOSTS = new Map([
  ['emerald.com', 'emerald.com'],
  ['nejm.org', 'nejm.org'],
  ['cabdirect.org', 'cabdirect.org'],
]);

function getPublisherCookieScopeHost(host) {
  const normalized = normalizeHost(host);
  for (const [suffix, scopeHost] of PUBLISHER_COOKIE_SCOPE_HOSTS.entries()) {
    if (normalized === suffix || normalized.endsWith(`.${suffix}`)) return scopeHost;
  }
  return '';
}

function proxyCookieDomainFromEnv(env, fallback) {
  let raw = String(env?.RA_PROXY_BASE_HOST || '').trim();
  if (!raw) return fallback;
  try {
    raw = raw.includes('://') ? new URL(raw).hostname : raw;
  } catch {
    return fallback;
  }
  raw = normalizeHost(raw).replace(/^\.+/, '');
  return raw || fallback;
}

function rewritePublisherCookieHeaderForUpstream(cookieHeader, scopeHost) {
  const scopedNames = new Set();
  for (const pair of String(cookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const prefixed = parsePublisherCookieName(pair.slice(0, idx).trim());
    if (prefixed?.scopeHost === scopeHost && prefixed.name) {
      scopedNames.add(prefixed.name.toLowerCase());
    }
  }

  const map = new Map();
  for (const pair of String(cookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!name) continue;

    const prefixed = parsePublisherCookieName(name);
    if (prefixed) {
      if (prefixed.scopeHost === scopeHost && prefixed.name) {
        map.set(prefixed.name, value);
      }
      continue;
    }

    if (scopeHost && isPublisherTrackingCookieName(name)) continue;
    if (scopeHost && isPublisherScopedCookieName(name) && scopedNames.has(name.toLowerCase())) continue;
    if (scopeHost && isPublisherScopedCookieName(name) && !shouldAllowRawPublisherCookieFallback(name)) continue;
    if (!map.has(name)) map.set(name, value);
  }
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function ensurePublisherScopedCookiesForwarded(cookieHeader, browserCookieHeader, scopeHost) {
  const browserCookies = rewritePublisherCookieHeaderForUpstream(
    stripSessionCookie(browserCookieHeader),
    scopeHost
  );
  if (!browserCookies) return cookieHeader || '';
  return mergeSessionHostCookieJar(cookieHeader || '', browserCookies);
}

function addPublisherCookiePromotionHeaders(headers, browserCookieHeader, scopeHost, domain) {
  if (!scopeHost || !browserCookieHeader) return;
  const cookies = parseCookiePairs(browserCookieHeader);

  for (const name of ['cf_clearance']) {
    if (!cookies.has(name)) continue;
    headers.append('Set-Cookie', `${name}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    headers.append('Set-Cookie', `${name}=; Domain=${domain}; Path=/; Secure; SameSite=Lax; Max-Age=0`);
  }
}

function parseCookiePairs(cookieHeader) {
  const map = new Map();
  for (const part of String(cookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name && !map.has(name)) map.set(name, value);
  }
  return map;
}

function isPublisherScopedCookieName(name) {
  const lower = String(name || '').toLowerCase();
  return lower === 'cf_clearance' || lower === '__cf_bm';
}

function shouldAllowRawPublisherCookieFallback(name) {
  return false;
}

function isPublisherTrackingCookieName(name) {
  const lower = String(name || '').toLowerCase();
  return lower === '_ga' ||
    lower.startsWith('_ga_') ||
    lower === '_gid' ||
    lower === '_gat' ||
    lower.startsWith('_hj') ||
    lower === '_clck' ||
    lower.startsWith('_clsk') ||
    lower === '_gcl_au' ||
    lower === '__gtm_referrer' ||
    lower === '_fbp' ||
    lower === '_fbc' ||
    lower === 'fs_uid' ||
    lower === '_twpid' ||
    lower === '__gads' ||
    lower === '__gpi' ||
    lower === '__eoi';
}

function parsePublisherCookieName(name) {
  if (!String(name || '').startsWith(PUBLISHER_COOKIE_PREFIX)) return null;
  const rest = String(name).slice(PUBLISHER_COOKIE_PREFIX.length);
  const idx = rest.indexOf('|');
  if (idx <= 0) return null;
  return {
    scopeHost: normalizeHost(rest.slice(0, idx)),
    name: rest.slice(idx + 1),
  };
}

function prefixPublisherSetCookieName(setCookie, scopeHost) {
  if (!setCookie) return setCookie;
  const parts = String(setCookie).split(';');
  if (!parts.length) return setCookie;
  const first = String(parts[0] || '').trim();
  const idx = first.indexOf('=');
  if (idx <= 0) return setCookie;

  const name = first.slice(0, idx).trim();
  const value = first.slice(idx + 1);
  if (!name || parsePublisherCookieName(name)) return setCookie;

  parts[0] = `${PUBLISHER_COOKIE_PREFIX}${scopeHost}|${name}=${value}`;
  return parts.join(';');
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
  if (info.publisherCookieScopeHost) {
    const forwarded = rewritePublisherCookieHeaderForUpstream(
      stripSessionCookie(info.requestCookies),
      info.publisherCookieScopeHost
    );
    headers.set('X-RA-Debug-Publisher-Cookie-Scope', info.publisherCookieScopeHost);
    headers.set('X-RA-Debug-Publisher-Cookies-From-Browser', cookieNames(forwarded).join(',') || '-');
  }
  headers.set('X-RA-Debug-Set-Cookies', setCookieNames(info.upstreamSetCookies).join(',') || '-');
  if (info.upstreamLocation) headers.set('X-RA-Debug-Upstream-Location', truncateHeader(info.upstreamLocation, 220));
  if (info.origin) headers.set('X-RA-Debug-Origin', truncateHeader(info.origin, 120));
  if (info.referer) headers.set('X-RA-Debug-Referer', truncateHeader(info.referer, 180));
  if (info.upstreamOrigin) headers.set('X-RA-Debug-Upstream-Origin', truncateHeader(info.upstreamOrigin, 120));
  if (info.upstreamReferer) headers.set('X-RA-Debug-Upstream-Referer', truncateHeader(info.upstreamReferer, 180));
  if (info.requestHeaders) headers.set('X-RA-Debug-Req-CH', clientHintHeaderNames(info.requestHeaders).join(',') || '-');
  if (info.upstreamHeaders) headers.set('X-RA-Debug-Upstream-CH', clientHintHeaderNames(info.upstreamHeaders).join(',') || '-');
}

async function writeRaDebugEvent(env, info) {
  if (String(env?.ENVIRONMENT || '').toLowerCase() !== 'staging') return;
  if (!info?.publisherCookieScopeHost || !env?.DB) return;

  try {
    await env.DB.prepare(
      `INSERT INTO ra_debug_events (
         created_at, product_slug, institution_id, target_host, target_path,
         request_path, request_url, upstream_status, cf_mitigated, cf_ray,
         request_cookie_names, upstream_cookie_names, set_cookie_names,
         request_ch_names, upstream_ch_names, referer, upstream_referer, user_agent
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        Math.floor(Date.now() / 1000),
        info.session?.product_slug || null,
        info.session?.institution_id || null,
        info.target?.host || null,
        info.target?.path || null,
        info.requestPath || null,
        truncateHeader(info.requestUrl || '', 500),
        info.upstreamResp?.status || null,
        info.upstreamResp?.headers?.get('cf-mitigated') || null,
        info.upstreamResp?.headers?.get('cf-ray') || null,
        JSON.stringify(cookieNames(info.requestHeaders?.get('Cookie')).sort()),
        JSON.stringify(cookieNames(info.upstreamHeaders?.get('Cookie')).sort()),
        JSON.stringify(setCookieNames(info.upstreamResp?.headers).sort()),
        JSON.stringify(clientHintHeaderNames(info.requestHeaders || new Headers())),
        JSON.stringify(clientHintHeaderNames(info.upstreamHeaders || new Headers())),
        truncateHeader(info.requestHeaders?.get('Referer') || '', 500),
        truncateHeader(info.upstreamHeaders?.get('Referer') || '', 500),
        truncateHeader(info.requestHeaders?.get('User-Agent') || '', 240)
      )
      .run();
  } catch (err) {
    console.warn('ra debug event write failed', err);
  }
}

function clientHintHeaderNames(headerBag) {
  const out = [];
  for (const [name] of headerBag.entries()) {
    const lower = name.toLowerCase();
    if (lower.startsWith('sec-ch-') || lower.startsWith('ua-')) out.push(name);
  }
  return out.sort();
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
