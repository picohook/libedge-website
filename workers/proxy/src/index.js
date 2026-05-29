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
import { egressFetch, browserFetch, assetBrowserFetch, workerDirectFetch } from './egress-client.js';
import { writeUpstreamAlert } from './alert-writer.js';
import { htmlError } from './error-page.js';
import { enforceProxyRateLimit } from './rate-limit.js';

const SESSION_COOKIE  = 'ra_proxy_session';
const COMPAT_SESSION_COOKIE = 'coproxy_session_id';
const UPSTREAM_HOST_COOKIE = '__ra_upstream';

// EZproxy "NeverProxy" eşdeğeri — analytics/teaser/3rd-party hostları proxy'leme.
// Wiley sayfaları wiley.scienceconnect.io'dan teaser yüklüyor; biz proxy'lersek
// __ra_upstream cookie bu hosta set oluyor ve sonraki link tıklamalarında relative
// URL'ler (/action/showPublications) yanlış hosta gidip 404 alıyor.
const NEVER_PROXY_HOSTS = new Set([
  'wiley.scienceconnect.io',
  'scienceconnect.io',
]);

function isNeverProxyHost(host) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (NEVER_PROXY_HOSTS.has(normalized)) return true;
  for (const h of NEVER_PROXY_HOSTS) {
    if (normalized.endsWith(`.${h}`)) return true;
  }
  return false;
}
const SESSION_TTL_SEC = 3600;
const SESSION_ALT_HOST_PREFIX = '/__ra-host/';
const SESSION_ENTRY_REDIRECT_PATH = '/__ra-redirect';
const STABLE_ENTRY_REDIRECT_PATH = '/coproxy/redirect';
const CF_CHALLENGE_PROXY_PREFIX = '/__ra-cdn-cgi/';
const CLIENT_DEBUG_PATH = '/__ra-client-debug';
const LINK_AUDIT_PATH = '/__ra-link-audit';
const COPROXY_REDIRECT_PATH = '/coproxy/redirect';
const WOS_DYNAMIC_HOSTS_PREFIX = 'rhostdyn:';
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
const SESSION_KV_CACHE_TTL_MS = 30 * 1000;
const SESSION_KV_CACHE_MAX = 500;
const sessionKvCache = new Map();
let linkAuditSchemaEnsured = false;

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

  // Admin route — stored WAF clearance management (RA_ADMIN_SECRET protected)
  if (url.pathname === '/__ra-admin/waf-clearance') {
    return await handleAdminWafClearance(request, env);
  }

  // Path-proxy modu (mevcut)
  return await handlePathProxy(request, env, ctx, url);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION-HOST PROXY
// ─────────────────────────────────────────────────────────────────────────────

async function handleSessionHost(request, env, ctx, url, sessionId) {
  // Cloudflare RUM / beacon telemetry — upstream'de bu endpoint yok, 204 dön.
  if (isCloudflareTelemetryPath(url.pathname)) {
    return new Response(null, { status: 204 });
  }

  // Token var mı? (issue-token'dan gelen ilk yönlendirme)
  const token = url.searchParams.get('t');
  if (token && isLikelyProxyToken(token)) {
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

  // KV'dan session yükle. Kısa isolate-local cache asset fırtınasında aynı
  // session kaydını her istek için tekrar KV'den okumayı azaltır.
  const session = await loadCachedSessionHostSession(env, sessionId);
  if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
    return htmlError(401, 'Oturum süresi dolmuş. Portal üzerinden yeniden erişin.');
  }

  if (url.pathname === CLIENT_DEBUG_PATH) {
    return await handleClientDebug(request, env, session, url);
  }

  if (url.pathname === LINK_AUDIT_PATH) {
    return await handleLinkAudit(request, env, session, url, sessionId);
  }

  if (url.pathname === COPROXY_REDIRECT_PATH) {
    return await handleSessionHostRedirectWrapper(request, env, url, session, sessionId);
  }

  if (url.pathname === SESSION_ENTRY_REDIRECT_PATH) {
    return sessionEntryRedirectResponse(url);
  }

  return await proxySessionSurface(request, env, ctx, url, session, sessionId);

  const proxyableHosts = await loadSessionProxyableHosts(env, session, sessionId);
  const upstreamCookieHost = readAllowedUpstreamHostCookie(
    request.headers.get('Cookie'),
    proxyableHosts
  );
  const target = parseSessionHostTarget(
    url.pathname,
    session.origin_host,
    proxyableHosts,
    upstreamCookieHost,
    { productSlug: session.product_slug }
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
  const search = rewriteQueryProxyUrls(url.search, url.hostname, target.host, {
    sessionOriginHost: session.origin_host,
    preserveHostnameParam: isScienceDirectProxyHost(target.host),
    targetPath: target.path,
  });
  const targetUrl = `https://${target.host}${target.path}${search}`;
  const publisherCookieScopeHost = getPublisherCookieScopeHost(target.host);
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: target.host,
    targetHost: target.host,
    forceDesktopUserAgent: session.product_slug === 'emis',
    publisherCookieScopeHost,
    targetPath: target.path,
  });
  const useSessionCookieJar = shouldUseSessionCookieJar(publisherCookieScopeHost);
  const storedUpstreamCookies = useSessionCookieJar
    ? await loadSessionHostCookieJar(env, sessionId, target.host)
    : '';
  let effectiveUpstreamCookies = mergeSessionHostCookieJar(
    storedUpstreamCookies,
    upstreamHeaders.get('Cookie') || ''
  );
  const allowCfChl = { allowCloudflareChallengeRuntimeCookies: isCloudflareChallengeAssetPath(target.path) };
  if (effectiveUpstreamCookies && publisherCookieScopeHost) {
    effectiveUpstreamCookies = rewritePublisherCookieHeaderForUpstream(
      effectiveUpstreamCookies,
      publisherCookieScopeHost,
      allowCfChl
    );
  }
  if (publisherCookieScopeHost) {
    effectiveUpstreamCookies = ensurePublisherScopedCookiesForwarded(
      effectiveUpstreamCookies,
      request.headers.get('Cookie'),
      publisherCookieScopeHost,
      allowCfChl
    );
  }
  if (publisherCookieScopeHost && !isCloudflareChallengeAssetPath(target.path)) {
    effectiveUpstreamCookies = await injectStoredWafClearanceIfMissing(
      env,
      session.product_slug,
      publisherCookieScopeHost,
      effectiveUpstreamCookies
    );
  }
  if (isWileyProxyHost(target.host)) {
    effectiveUpstreamCookies = ensureCookiePair(effectiveUpstreamCookies, 'theproxy', 'ezproxy');
  }
  if (isScienceDirectProxyHost(target.host) || isScopusProxyHost(target.host)) {
    effectiveUpstreamCookies = ensureCookiePair(effectiveUpstreamCookies, 'BROWSER_SUPPORTS_COOKIES', '1');
  }
  if (cookieIsolationMode === 'host') {
    effectiveUpstreamCookies = dedupeCookieHeaderKeepLast(effectiveUpstreamCookies);
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

  // Only persist the cookie jar for the session's origin host.
  // Sub-hosts (CDN, analytics, tracking) set frequently-changing cookies that
  // would generate excessive KV writes without providing session value.
  if (useSessionCookieJar && target.host === session.origin_host) {
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
  if (publisherCookieScopeHost === 'sciencedirect.com' && /\btext\/html\b/i.test(upstreamResp.headers.get('Content-Type') || '')) {
    appendOtherPublisherCookieClearHeaders(
      respHeaders,
      request.headers.get('Cookie'),
      publisherCookieScopeHost,
      proxyCookieDomainFromEnv(env, url.hostname)
    );
  }
  clearPublisherClearanceOnChallenge(
    respHeaders,
    upstreamResp,
    publisherCookieScopeHost,
    proxyCookieDomainFromEnv(env, url.hostname),
    target.path
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
    if (scienceDirectSearchApiNeedsBrowser) {
      respHeaders.set('X-RA-SD-SearchAPI-Worker', '1');
      respHeaders.set('X-RA-SD-SearchAPI-Mode', useBrowserFetch ? 'browserFetch' : 'egressFetch');
      respHeaders.set('X-RA-SD-SearchAPI-Upstream-Cookies', cookieNames(upstreamHeaders.get('Cookie')).join(',') || '-');
      respHeaders.set('X-RA-SD-SearchAPI-Raw', upstreamHeaders.get('X-RA-Raw') || '-');
    }
    addOidcCallbackDebugHeaders(
      respHeaders,
      target,
      url.search,
      request.headers.get('Cookie'),
      upstreamHeaders.get('Cookie')
    );
  }
  sanitizeWafChallengeResponseHeaders(respHeaders, publisherCookieScopeHost);

  if (isCloudflareChallengeAssetPath(target.path) && /\btext\/html\b/i.test(contentType)) {
    let text = await upstreamResp.text();
    text = relaxProxyMetaContentSecurityPolicy(text);
    text = rewriteCloudflareChallengePaths(text);
    text = injectCloudflareChallengeCookieNamespaceScript(text, publisherCookieScopeHost);
    clearRawPublisherClearanceCookies(
      respHeaders,
      publisherCookieScopeHost,
      proxyCookieDomainFromEnv(env, url.hostname)
    );
    respHeaders.delete('Content-Length');
    respHeaders.delete('Content-Encoding');
    return new Response(text, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  }

  const needsTextRewrite =
    shouldRewriteSessionTextResponse(target, upstreamResp) ||
    shouldRewriteCurrentHostTextResponse(target, session.origin_host, contentType) ||
    shouldInjectRaLinkAuditScript(session, contentType);

  if (needsTextRewrite) {
    let text = await upstreamResp.text();
    const challengeSurface = isCloudflareChallengeSurface(target, upstreamResp);

    if (target.host !== session.origin_host) {
      text = rewriteCurrentHostUrls(text, url.hostname, target.host);
    }

    // Ürün-bazlı proxy URL rewrite (EMIS vb.). Cloudflare challenge sayfasında
    // publisher/global rewrite yapmak Turnstile callback/Trusted Types akışını
    // bozuyor; challenge için sadece /cdn-cgi path rewrite yapılır.
    if (!challengeSurface && shouldRewriteSessionTextResponse(target, upstreamResp)) {
      text = rewriteSessionTextProxyUrls(text, url.hostname, session.origin_host, proxyableHosts);
      if (isWebOfScienceProxyHost(target.host)) {
        text = rewriteCloudflareChallengePaths(text);
      }
    }
    if (!challengeSurface && isWebOfScienceProxyHost(target.host) && isJavaScriptContentType(contentType)) {
      text = injectSessionHostFullTextProxyRuntime(text, url.hostname, session.origin_host, proxyableHosts);
    }
    if (!challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = injectSessionHostLinkProxyScript(text, url.hostname, session.origin_host, proxyableHosts);
    }
    if (publisherCookieScopeHost && !challengeSurface && shouldRewritePublisherTextBody(target, contentType)) {
      text = rewriteSessionTextProxyUrls(text, url.hostname, session.origin_host, proxyableHosts);
      text = rewritePublisherHostJavaScriptText(text, url.hostname, publisherCookieScopeHost, proxyableHosts);
      text = rewriteCloudflareChallengePaths(text);
    }
    if (isScopusProxyHost(target.host) && !challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = patchScopusNextData(text, session.origin_host, url.hostname);
      text = injectScopusAnalyticsStub(text);
    }
    if (isWileyProxyHost(target.host) && !challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = stripWileyThirdPartyScripts(text);
      text = injectWileyConsentHide(text);
      text = injectWileyBackForwardReload(text);
      respHeaders.set('Cache-Control', 'no-store');
    }
    if (challengeSurface) {
      text = relaxProxyMetaContentSecurityPolicy(text);
      text = rewriteCloudflareChallengePaths(text);
      text = injectCloudflareChallengeCookieNamespaceScript(text, publisherCookieScopeHost);
      clearRawPublisherClearanceCookies(
        respHeaders,
        publisherCookieScopeHost,
        proxyCookieDomainFromEnv(env, url.hostname)
      );
    }
    if (publisherCookieScopeHost && publisherCookieScopeHost !== 'scopus.com' && !challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = relaxProxyMetaContentSecurityPolicy(text);
      text = injectPublisherCookieNamespaceScript(
        text,
        publisherCookieScopeHost,
        target.host,
        isStagingEnv(env)
      );
    }
    if (!challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = injectRaLinkAuditScript(text, session);
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
  if (isCloudflareTelemetryPath(url.pathname)) {
    return new Response(null, { status: 204 });
  }

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

  const sessionId = readProxySessionCookie(request.headers.get('Cookie'));
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

  if (url.pathname === CLIENT_DEBUG_PATH) {
    return await handleClientDebug(request, env, session, url);
  }

  if (url.pathname === LINK_AUDIT_PATH) {
    return await handleLinkAudit(request, env, session, url, sessionId);
  }

  return await proxySessionSurface(request, env, ctx, url, session, sessionId);
}

async function proxySessionSurface(request, env, ctx, url, session, sessionId) {
  const proxyableHosts = await loadSessionProxyableHosts(env, session, sessionId);

  // WoS full-text linking: load subscribed publisher hosts into proxyableHosts for
  // ALL WoS requests so that:
  //   1. parseSessionHostTarget allows /__ra-host/<publisher> navigation
  //   2. injectSessionHostLinkProxyScript bakes publisher hosts into the injected script
  //      (the script is generated once at HTML-serve time and stays client-side)
  //   3. rewriteSessionTextProxyUrls rewrites publisher URLs in HTML/JSON responses
  //
  // wosJsRewriteHosts is a copy of the WoS-core allowlist saved BEFORE publisher
  // hosts are added. It is used in place of proxyableHosts when running
  // rewriteSessionTextProxyUrls on WoS JavaScript bundles — publisher URLs are never
  // hardcoded in those Angular bundles, so scanning them for 100+ extra hosts is pure
  // CPU waste that triggers a 503 on large bundles (the previous fix that caused 503).
  let coreJsRewriteHosts = null;
  if (
    isWebOfScienceSurface({ host: session.origin_host }, { productSlug: session.product_slug }) ||
    session.product_slug === 'scopus'
  ) {
    coreJsRewriteHosts = new HostAllowlist(proxyableHosts.patterns());
    try {
      const pubHosts = await loadWosPublisherHosts(env.DB, session.institution_id);
      for (const h of pubHosts) if (h) proxyableHosts.add(h);
    } catch (err) {
      console.warn('loadWosPublisherHosts failed', err?.message);
    }
  }

  const upstreamCookieHost = readAllowedUpstreamHostCookie(
    request.headers.get('Cookie'),
    proxyableHosts
  );
  // Referer-based alt-host fallback: when __ra_upstream cookie is absent and the
  // browser fetches a root-relative path (CSS/JS), parse the Referer header to
  // detect which /__ra-host/<encoded>/ page triggered the sub-resource load.
  // This is more reliable than the cookie alone because browsers send Referer
  // synchronously with the sub-resource request, before the Set-Cookie from the
  // parent page response has been processed.
  const effectiveUpstreamHost = upstreamCookieHost || readRefererAltHost(
    request.headers.get('Referer'),
    url.hostname,
    proxyableHosts
  );
  const target = parseSessionHostTarget(
    url.pathname,
    session.origin_host,
    proxyableHosts,
    effectiveUpstreamHost,
    { productSlug: session.product_slug }
  );
  if (!target) {
    return htmlError(403, 'Bu oturum bu yayıncı hostuna erişemez.');
  }

  // Nature's client sometimes calls the verification service as a relative
  // /verify/* path. That path belongs to verify.nature.com, not www.nature.com.
  // Route it to the real service instead of returning a proxy-origin 404.
  if (session.product_slug === 'nature' && target.path.startsWith('/verify/')) {
    target.host = 'verify.nature.com';
  }

  // Scopus: rum.scopus.com is NeverProxy — analytics only, 204 to avoid errors.
  if (session.product_slug === 'scopus' && target.host === 'rum.scopus.com') {
    return new Response(null, { status: 204 });
  }

  // Global NeverProxy list (Wiley scienceconnect.io vb. analytics/teaser hostları).
  // EZproxy stanza eşdeğeri. 204 dön ki browser hata göstermesin; ayrıca
  // __ra_upstream cookie temizle ki sonraki relative URL'ler bu hosta gitmesin.
  if (isNeverProxyHost(target.host)) {
    return new Response(null, {
      status: 204,
      headers: {
        'Set-Cookie': `${UPSTREAM_HOST_COOKIE}=; Path=/; Domain=${url.hostname}; Max-Age=0; Secure; HttpOnly; SameSite=Lax`,
      },
    });
  }

  const wileyNoise = wileyNoiseResponse(target, request.method);
  if (wileyNoise) return wileyNoise;

  if (session.product_slug === 'sciencedirect' && target.path.startsWith('/cdn-cgi/challenge-platform/')) {
    const headers = new Headers({
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    clearRawPublisherClearanceCookies(
      headers,
      'sciencedirect.com',
      proxyCookieDomainFromEnv(env, url.hostname)
    );
    return new Response('/* LibEdge: ScienceDirect challenge asset suppressed on proxy surface. */', {
      status: 200,
      headers,
    });
  }

  const scienceDirectPdfLocation = scienceDirectPdfDirectProxyLocation(url, target);
  if (scienceDirectPdfLocation) {
    return new Response(null, {
      status: 302,
      headers: new Headers({
        Location: scienceDirectPdfLocation,
        'Cache-Control': 'no-store',
      }),
    });
  }

  const getFtrDirectTarget = getFtrEmbeddedTargetUrl(target);
  if (getFtrDirectTarget) {
    const embeddedHost = normalizeHost(getFtrDirectTarget.hostname);
    const canRouteEmbeddedHost = embeddedHost && (
      proxyableHosts.has(embeddedHost) ||
      ((session.product_slug === 'scopus' ||
        isWebOfScienceSurface({ host: session.origin_host }, { productSlug: session.product_slug })) &&
        isElsevierProxyHost(embeddedHost))
    );
    if (canRouteEmbeddedHost) {
      if (!proxyableHosts.has(embeddedHost)) {
        proxyableHosts.add(embeddedHost);
        ctx.waitUntil(persistDynamicSessionProxyHost(env, sessionId, embeddedHost));
      }
      const location = `https://${url.hostname}${sessionHostPathFor(
        embeddedHost,
        session.origin_host,
        getFtrDirectTarget.pathname || '/'
      )}${getFtrDirectTarget.search}${getFtrDirectTarget.hash}`;
      return new Response(null, {
        status: 302,
        headers: new Headers({
          Location: location,
          'Cache-Control': 'no-store',
        }),
      });
    }
  }

  // Elsevier/Scopus cookie bridge endpoint.
  // Browser calls POST /cookies/set.uri but Scopus only handles GET.
  // Forward as GET via egress so Scopus can set session cookies server-side,
  // then capture those cookies into the KV jar so subsequent requests carry them.
  if (target.path === '/cookies/set.uri') {
    try {
      const bridgeUrl = `https://${target.host}/cookies/set.uri${url.search}`;
      const bridgeHeaders = buildUpstreamHeaders(request.headers, {
        proxyHostname: url.hostname, originHost: target.host, targetHost: target.host,
      });
      const storedNow = await loadSessionHostCookieJar(env, sessionId, target.host);
      if (storedNow) bridgeHeaders.set('Cookie', storedNow);
      const bridgeResp = await egressFetch(env, session.institution_id, bridgeUrl, {
        method: 'GET', headers: bridgeHeaders,
      });
      const body = await bridgeResp.text();
      ctx.waitUntil(persistSessionHostCookieJar(env, sessionId, target.host, storedNow, bridgeResp.headers));
      const respHeaders = new Headers({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      for (const sc of collectSetCookies(bridgeResp.headers)) {
        respHeaders.append('Set-Cookie', rewriteSessionHostSetCookie(sc, url.hostname, {}));
      }
      return new Response(body || 'callback({})', { status: 200, headers: respHeaders });
    } catch {
      const cb = url.searchParams.get('callback') || 'callback';
      return new Response(`${cb}({})`, { status: 200, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
    }
  }

  // Scopus home.url — EZproxy fetches this URI-list to initialise the session
  // and find the redirect target. We mimic that: fetch the real home.url through
  // egress (institutional IP → session cookies set), parse the first https:// URL
  // in the response, then redirect the browser there via the proxy.
  if (session.product_slug === 'scopus' && target.path === '/home.url') {
    try {
      const homeResp = await egressFetch(env, session.institution_id,
        `https://${target.host}/home.url`,
        { method: 'GET', headers: buildUpstreamHeaders(request.headers, {
            proxyHostname: url.hostname, originHost: target.host, targetHost: target.host,
          }) }
      );
      const ct = homeResp.headers.get('content-type') || '';
      const text = await homeResp.text();

      // URI-list: find first https:// line that isn't home.url itself (avoid loop)
      // and isn't an error page URL.
      const redirectTarget = text.split('\n').map(l => l.trim())
        .find(l =>
          (l.startsWith('https://') || l.startsWith('http://')) &&
          !l.includes('/home.url') &&
          !l.includes('statusCode=') &&
          !l.includes('/error')
        );
      if (redirectTarget) {
        const dest = redirectTarget.replace(/^https?:\/\/[^/]+/, `https://${url.hostname}`);
        const h = new Headers({ Location: dest });
        // await — KV write must complete before redirect so next request sees the cookies.
        const existing = await loadSessionHostCookieJar(env, sessionId, target.host);
        await persistSessionHostCookieJar(env, sessionId, target.host, existing, homeResp.headers);
        return new Response(null, { status: 302, headers: h });
      }
      // If response is already JS/HTML, pass it through
      if (/javascript|html/i.test(ct)) {
        return new Response(text, { status: homeResp.status,
          headers: { 'content-type': ct } });
      }
    } catch { /* fall through to stub */ }
    return new Response(
      'var $enableThirdPartyJS=false;var $s3Backgroundurl="";',
      { status: 200, headers: { 'content-type': 'application/javascript; charset=UTF-8' } }
    );
  }

  const scienceDirectCookieCleanup = scienceDirectCookieCleanupRedirect(
    request,
    url,
    target,
    proxyCookieDomainFromEnv(env, url.hostname)
  );
  if (scienceDirectCookieCleanup) return scienceDirectCookieCleanup;

  const rateLimit = await enforceProxyRateLimit(env, sessionId, session, target.path);
  if (rateLimit) return proxyRateLimitResponse(rateLimit);

  const search = rewriteQueryProxyUrls(url.search, url.hostname, target.host, {
    sessionOriginHost: session.origin_host,
    preserveHostnameParam: isScienceDirectProxyHost(target.host),
    targetPath: target.path,
  });
  const targetUrl = `https://${target.host}${target.path}${search}`;
  let publisherCookieScopeHost = getPublisherCookieScopeHost(target.host);
  let cookieIsolationMode = 'scoped';
  // ra_cookie_mode='host' (vetis-tarzı per-session izolasyon) → scope'u boşalt.
  // Tüm scoping logic (prefix, parent cookie domain, namespace shim) skip edilir.
  // rewriteSessionHostSetCookie doğal olarak Domain=proxyHostname (session host) yazar.
  // Default 'scoped' → mevcut davranış aynen korunur.
  if (publisherCookieScopeHost) {
    cookieIsolationMode = await loadProductCookieMode(env.DB, session.product_slug);
    if (cookieIsolationMode === 'host') publisherCookieScopeHost = '';
  }
  const upstreamHeaders = buildUpstreamHeaders(request.headers, {
    proxyHostname: url.hostname,
    originHost: target.host,
    targetHost: target.host,
    forceDesktopUserAgent: session.product_slug === 'emis',
    publisherCookieScopeHost,
    targetPath: target.path,
  });
  const useSessionCookieJar = shouldUseSessionCookieJar(publisherCookieScopeHost);
  const storedUpstreamCookies = useSessionCookieJar
    ? await loadSessionHostCookieJar(env, sessionId, target.host)
    : '';
  let effectiveUpstreamCookies = mergeSessionHostCookieJar(
    storedUpstreamCookies,
    upstreamHeaders.get('Cookie') || ''
  );
  const allowCfChl = { allowCloudflareChallengeRuntimeCookies: isCloudflareChallengeAssetPath(target.path) };
  if (effectiveUpstreamCookies && publisherCookieScopeHost) {
    effectiveUpstreamCookies = rewritePublisherCookieHeaderForUpstream(
      effectiveUpstreamCookies,
      publisherCookieScopeHost,
      allowCfChl
    );
  }
  if (publisherCookieScopeHost) {
    effectiveUpstreamCookies = ensurePublisherScopedCookiesForwarded(
      effectiveUpstreamCookies,
      request.headers.get('Cookie'),
      publisherCookieScopeHost,
      allowCfChl
    );
  }
  if (publisherCookieScopeHost && !isCloudflareChallengeAssetPath(target.path)) {
    effectiveUpstreamCookies = await injectStoredWafClearanceIfMissing(
      env,
      session.product_slug,
      publisherCookieScopeHost,
      effectiveUpstreamCookies
    );
  }
  if (isWileyProxyHost(target.host)) {
    effectiveUpstreamCookies = ensureCookiePair(effectiveUpstreamCookies, 'theproxy', 'ezproxy');
  }
  if (isScienceDirectProxyHost(target.host) || isScopusProxyHost(target.host)) {
    effectiveUpstreamCookies = ensureCookiePair(effectiveUpstreamCookies, 'BROWSER_SUPPORTS_COOKIES', '1');
  }
  if (effectiveUpstreamCookies) {
    upstreamHeaders.set('Cookie', effectiveUpstreamCookies);
  } else {
    upstreamHeaders.delete('Cookie');
  }

  // WebSocket upgrade — proxy directly (ra-egress does not support WS upgrade).
  if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    const wsUrl = `wss://${target.host}${target.path}${search}`;
    return proxyWebSocket(wsUrl, upstreamHeaders);
  }

  // ra_waf_browser routing: for CF Managed Challenge publishers (Emerald, OUP,
  // Wiley, CAB), use the Playwright/Chromium browser service.
  //
  // useBrowserFetch    — full page navigation (HTML, resolves CF Turnstile)
  // useAssetBrowserFetch — sub-resource fetch via context.request (Chrome TLS)
  //   CABI applies CF Bot Management to ALL paths; the Go HTTP client's TLS
  //   fingerprint is detected as a bot even with a valid cf_clearance cookie.
  //   context.request uses Chrome's TLS stack and bypasses this check.
  const isGet = request.method.toUpperCase() === 'GET';
  const isDocNav = isDocumentNavigation(request.headers);
  const isCfPath = isCloudflareChallengeAssetPath(target.path);
  const productWafBrowser = isGet && !isCfPath
    ? await loadProductWafBrowserFlag(env.DB, session.product_slug)
    : false;

  // Publishers that use CF Bot Management (not just Managed Challenge) require
  // Playwright/Chrome TLS to bypass. ACS/Emerald use IP-based Managed Challenge
  // only and work fine via the Go egress client (egressFetch).
  //
  const PLAYWRIGHT_SLUGS = new Set(['cab-abstracts', 'wiley', 'scopus']);
  // Also use Playwright when the TARGET host is a CF Bot Management publisher,
  // even if we're in a different session (e.g. WoS session accessing a Wiley article
  // via GetFTR full-text link).
  // ScienceDirect's search API works as a same-origin XHR through the normal
  // egress path. Forcing it through ra-browser/raw fetch returns Cloudflare
  // HTML 403 even when the browser has a valid cf_clearance.
  const scienceDirectSearchApiNeedsBrowser = false;
  const scopusRootNavigation = session.product_slug === 'scopus' &&
    isDocNav &&
    isScopusProxyHost(target.host) &&
    target.host === session.origin_host &&
    target.path === '/';
  const needsPlaywright = (!scopusRootNavigation && productWafBrowser && PLAYWRIGHT_SLUGS.has(session.product_slug)) ||
    (isGet && !isCfPath && isWileyProxyHost(target.host)) ||
    scienceDirectSearchApiNeedsBrowser;
  const useBrowserFetch      = isGet && !isCfPath && ((isDocNav && needsPlaywright) || scienceDirectSearchApiNeedsBrowser);
  // Scopus: route all API requests (including POST) through Chrome TLS to avoid
  // TLS fingerprint inconsistency between Playwright page load and Go egress.
  const scopusApiNeedsBrowser = PLAYWRIGHT_SLUGS.has(session.product_slug) && !isGet && !isCfPath;
  const useAssetBrowserFetch = (!isCfPath && needsPlaywright && !scienceDirectSearchApiNeedsBrowser && (
    (isGet && !isDocNav) || scopusApiNeedsBrowser
  ));
  // Wiley static asset edge cache (caches.default). Cache key URL-only,
  // Set-Cookie/Content-Length stripped, Cache-Control 7d immutable. Cookie
  // mode'a bakmıyor — key user-agnostic, response sanitize ediliyor (bkz.
  // buildStaticAssetCacheKey, buildStaticAssetCacheResponse).
  // ra-browser page-eval fetch (200 alıyoruz) + edge cache → vetis-style HIT
  // (3-50ms küresel cache hit, asset 403 sorununu doğal çözer).
  const useWileyStaticAssetCache = useAssetBrowserFetch
    && isGet
    && isWileyProxyHost(target.host)
    && isStaticAssetPath(target.path);
  const isWileyDocumentNavigation = useBrowserFetch
    && isGet
    && isDocNav
    && cookieIsolationMode === 'host'
    && isWileyProxyHost(target.host);
  // Vetis-style Worker direct fetch path için ayrı koşul — cookie mode'a
  // bakmıyor (workerDirectFetch URL-only fetch, scope/host cookie izolasyonu
  // ile çelişmez). Wiley document path'ler için aktif.
  const useWileyWorkerDirect = useBrowserFetch
    && isGet
    && isDocNav
    && isWileyProxyHost(target.host);
  // context.request and Go/utls direct document fetches are consistently 403
  // for Wiley. Skip those probes; the fast path is now pooled-page navigation
  // inside ra-browser, which preserves page-level CF/browser state.
  const useWileyDocumentContextFetch = false;
  const useWileyDocumentFastPath = useWileyDocumentContextFetch
    && /\bcf_clearance=/.test(effectiveUpstreamCookies || '');

  // Step 06 — Wiley için persistent browser context (JS-set cookies: MAID,
  // MACHINE_LAST_SEEN, userRandomGroup). ra-browser sessionId+hostname bazlı
  // context pool tutar; sonraki asset request'leri aynı context'i kullanır.
  const PERSISTENT_SESSION_SLUGS = new Set(['wiley']);
  const persistSession = PERSISTENT_SESSION_SLUGS.has(session.product_slug);

  let upstreamResp;
  let wileyDocumentRoute = '';
  const appendWileyDocumentRoute = (step) => {
    if (!step) return;
    wileyDocumentRoute = wileyDocumentRoute ? `${wileyDocumentRoute};${step}` : step;
  };
  try {
    if (useBrowserFetch) {
      try {
        if (useWileyDocumentContextFetch) {
          appendWileyDocumentRoute('context-attempt');
          upstreamResp = await assetBrowserFetch(env, session.institution_id, targetUrl, {
            method: request.method,
            headers: upstreamHeaders,
            body: null,
            sessionId,
          });
          if (upstreamResp.status === 401 || upstreamResp.status === 403 || /\btext\/html\b/i.test(upstreamResp.headers.get('Content-Type') || '') && isCloudflareChallengeHtml(await upstreamResp.clone().text().catch(() => ''))) {
            appendWileyDocumentRoute(`context-rejected-${upstreamResp.status}`);
            upstreamResp = null;
          } else {
            upstreamResp.headers.set('X-RA-Wiley-Doc-Context', '1');
            appendWileyDocumentRoute('context');
          }
        }
        if (!upstreamResp && useWileyDocumentFastPath) {
          appendWileyDocumentRoute('direct-attempt');
          upstreamResp = await egressFetch(env, session.institution_id, targetUrl, {
            method: request.method,
            headers: upstreamHeaders,
            body: null,
          });
          if (upstreamResp.status === 401 || upstreamResp.status === 403 || /\btext\/html\b/i.test(upstreamResp.headers.get('Content-Type') || '') && isCloudflareChallengeHtml(await upstreamResp.clone().text().catch(() => ''))) {
            appendWileyDocumentRoute(`direct-rejected-${upstreamResp.status}`);
            upstreamResp = null;
          } else {
            upstreamResp.headers.set('X-RA-Wiley-Doc-Fast', '1');
            appendWileyDocumentRoute('direct');
          }
        }
        // Vetis-style direct fetch (workerDirectFetch) — Wiley document path için
        // birincil deneme. CF Worker → Wiley fetch'i Bot Management tarafından
        // (genelde) challenge edilmiyor (kanıt: probe sonuçları 5/6 temiz).
        // Cookie jar ile `?cookieSet=1` redirect zincirini takip eder.
        // Challenge yer (cf-mitigated, body "Just a moment...") → browserFetch fallback.
        //
        // NOT: Search (`/action/doSearch?...`) muhtemelen challenge yer; bu sefer
        // mevcut ra-browser yolu kullanılır (eski hız korunur). Çözüm değil, yan
        // etki: search hâlâ Vetis seviyesi değil.
        if (!upstreamResp && useWileyWorkerDirect) {
          appendWileyDocumentRoute('worker-direct-attempt');
          try {
            const direct = await workerDirectFetch(targetUrl, {
              method: request.method,
              headers: upstreamHeaders,
              body: null,
            });
            if (direct.response && !direct.challenged) {
              upstreamResp = direct.response;
              upstreamResp.headers.set('X-RA-Wiley-Doc-Worker-Direct', '1');
              appendWileyDocumentRoute('worker-direct');
            } else {
              appendWileyDocumentRoute(`worker-direct-rejected-${direct.challenged ? 'challenge' : 'no-resp'}`);
            }
          } catch (err) {
            appendWileyDocumentRoute('worker-direct-error');
            console.warn('workerDirectFetch failed', err?.message);
          }
        }
        if (!upstreamResp) {
          if (isWileyDocumentNavigation) {
            appendWileyDocumentRoute('browser');
          }
          upstreamResp = await browserFetch(env, session.institution_id, targetUrl, {
            headers: upstreamHeaders,
            sessionId,
            persistSession,
            fastDocument: session.product_slug === 'wiley',
          });
        }
        // Persist cf_clearance in D1 so subsequent visits can use ra-egress directly.
        const cfClearance = upstreamResp.headers.get('X-RA-CF-Clearance');
        if (cfClearance && publisherCookieScopeHost) {
          ctx.waitUntil(
            env.DB.prepare(
              'INSERT INTO ra_waf_clearance (product_slug, scope_host, clearance, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)' +
              ' ON CONFLICT(product_slug, scope_host) DO UPDATE SET clearance=excluded.clearance, updated_at=excluded.updated_at'
            ).bind(session.product_slug, publisherCookieScopeHost, cfClearance, Math.floor(Date.now() / 1000), 'ra-browser').run()
            .catch(err => console.warn('waf clearance store failed', err))
          );
        }
      } catch (browserErr) {
        console.warn('browser fetch failed; falling back to direct egress', {
          product_slug: session.product_slug,
          target_host: target.host,
          message: browserErr && browserErr.message ? browserErr.message : String(browserErr),
        });
        upstreamResp = await egressFetch(env, session.institution_id, targetUrl, {
          method: request.method,
          headers: upstreamHeaders,
          body: null,
        });
      }
    } else if (useAssetBrowserFetch) {
      const assetCacheKey = useWileyStaticAssetCache
        ? buildStaticAssetCacheKey(target, search)
        : null;
      if (assetCacheKey) {
        upstreamResp = await caches.default.match(assetCacheKey);
        if (upstreamResp) {
          const cachedHeaders = new Headers(upstreamResp.headers);
          cachedHeaders.set('X-RA-Asset-Cache', 'HIT');
          upstreamResp = new Response(upstreamResp.body, {
            status: upstreamResp.status,
            statusText: upstreamResp.statusText,
            headers: cachedHeaders,
          });
        }
      }
      if (!upstreamResp) {
        upstreamResp = await assetBrowserFetch(env, session.institution_id, targetUrl, {
          method: request.method,
          headers: upstreamHeaders,
          body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
          sessionId, // Wiley için pool context'i kullanmak üzere ra-browser'a iletilir
        });
        if (assetCacheKey) {
          const cacheableResp = buildStaticAssetCacheResponse(upstreamResp);
          if (cacheableResp) {
            ctx.waitUntil(caches.default.put(assetCacheKey, cacheableResp).catch(err => {
              console.warn('static asset cache put failed', {
                product_slug: session.product_slug,
                target_host: target.host,
                target_path: target.path,
                message: err && err.message ? err.message : String(err),
              });
            }));
            upstreamResp = new Response(upstreamResp.body, {
              status: upstreamResp.status,
              statusText: upstreamResp.statusText,
              headers: (() => {
                const h = new Headers(upstreamResp.headers);
                h.delete('Set-Cookie');
                h.delete('set-cookie');
                h.delete('Content-Length');
                h.delete('content-length');
                h.set('Cache-Control', 'public, max-age=604800, immutable');
                h.set('X-RA-Asset-Cache', 'MISS');
                return h;
              })(),
            });
          }
        }
      }
    } else {
      upstreamResp = await egressFetch(env, session.institution_id, targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
      });
    }
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

  // WoS background API calls that fail with 4xx → Angular's doFetchEsti throws
  // Server.authorization/internalError → deferred session re-auth on next user action.
  // Intercept known subscription-gated or session-state endpoints with empty 200s.
  const wosFallbackResp = webOfScienceFailureFallbackResponse(target, upstreamResp, {
    proxyHostname: url.hostname,
    productSlug: session.product_slug,
  });
  if (wosFallbackResp) return wosFallbackResp;

  const proQuestFallbackResp = proQuestFailureFallbackResponse(target, upstreamResp);
  if (proQuestFallbackResp) return proQuestFallbackResp;

  const dynamicWosRedirectHost = webOfScienceDynamicRedirectHost(
    upstreamResp.headers.get('Location'),
    target,
    session
  );
  if (dynamicWosRedirectHost && !proxyableHosts.has(dynamicWosRedirectHost)
      && !isScienceDirectProxyHost(dynamicWosRedirectHost)
      && !isElsevierProxyHost(dynamicWosRedirectHost)) {
    proxyableHosts.add(dynamicWosRedirectHost);
    await persistDynamicSessionProxyHost(env, sessionId, dynamicWosRedirectHost);
  }

  const dynamicScienceDirectRedirectHost = scienceDirectDynamicRedirectHost(
    upstreamResp.headers.get('Location'),
    target,
    session
  );
  if (dynamicScienceDirectRedirectHost && !proxyableHosts.has(dynamicScienceDirectRedirectHost)) {
    proxyableHosts.add(dynamicScienceDirectRedirectHost);
    await persistDynamicSessionProxyHost(env, sessionId, dynamicScienceDirectRedirectHost);
  }

  // Only persist the cookie jar for the session's origin host.
  // Sub-hosts (CDN, analytics, tracking) set frequently-changing cookies that
  // would generate excessive KV writes without providing session value.
  if (useSessionCookieJar && target.host === session.origin_host) {
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
  // When serving an alt-host page (/__ra-host/<host>/...) reached via JS navigation
  // (not HTTP 302), __ra_upstream is not set by the redirect handler. Set it here
  // so root-relative paths (CSS, JS) from that page go to the correct alt-host.
  //
  // ra_cookie_mode='host' (Wiley vb.) → __ra_upstream cookie set ETMEYE. Wiley'in
  // alt-host'ları (nim.*, ars.els-cdn.com vb.) farklı path space kullanıyor; cookie
  // set edilirse sonraki root navigation yanlış alt-hosta gider → 404. Wiley
  // multi-host akışı zaten /__ra-host/{encoded}/ path prefix ile çalışır.
  if (target.host !== session.origin_host && !publisherCookieScopeHost
      && cookieIsolationMode !== 'host'
      && upstreamCookieHost !== target.host) {
    respHeaders.append('Set-Cookie', buildUpstreamHostCookie(url.hostname, target.host));
  }
  addPublisherCookiePromotionHeaders(
    respHeaders,
    request.headers.get('Cookie'),
    publisherCookieScopeHost,
    proxyCookieDomainFromEnv(env, url.hostname)
  );
  clearPublisherClearanceOnChallenge(
    respHeaders,
    upstreamResp,
    publisherCookieScopeHost,
    proxyCookieDomainFromEnv(env, url.hostname),
    target.path
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
    if (isWileyDocumentNavigation) {
      respHeaders.set('X-RA-Wiley-Doc-Route', wileyDocumentRoute || 'none');
      respHeaders.set('X-RA-Wiley-Doc-Has-CF', /\bcf_clearance=/.test(effectiveUpstreamCookies || '') ? '1' : '0');
    }
    addOidcCallbackDebugHeaders(
      respHeaders,
      target,
      url.search,
      request.headers.get('Cookie'),
      upstreamHeaders.get('Cookie')
    );
  }
  sanitizeWafChallengeResponseHeaders(respHeaders, publisherCookieScopeHost);

  if (isCloudflareChallengeAssetPath(target.path) && /\btext\/html\b/i.test(contentType)) {
    let text = await upstreamResp.text();
    text = relaxProxyMetaContentSecurityPolicy(text);
    text = rewriteCloudflareChallengePaths(text);
    text = injectCloudflareChallengeCookieNamespaceScript(text, publisherCookieScopeHost);
    clearRawPublisherClearanceCookies(
      respHeaders,
      publisherCookieScopeHost,
      proxyCookieDomainFromEnv(env, url.hostname)
    );
    respHeaders.delete('Content-Length');
    respHeaders.delete('Content-Encoding');
    return new Response(text, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  }

  const needsTextRewrite =
    shouldRewriteSessionTextResponse(target, upstreamResp) ||
    shouldRewriteCurrentHostTextResponse(target, session.origin_host, contentType) ||
    shouldInjectRaLinkAuditScript(session, contentType);

  if (needsTextRewrite) {
    let text = await upstreamResp.text();
    const challengeSurface = isCloudflareChallengeSurface(target, upstreamResp);

    if (target.host !== session.origin_host) {
      text = rewriteCurrentHostUrls(text, url.hostname, target.host);
    }

    if (!challengeSurface && shouldRewriteSessionTextResponse(target, upstreamResp)) {
      // For WoS JavaScript bundles: use WoS-core hosts only (no publisher hosts).
      // Publisher URLs are not hardcoded in Angular bundles; scanning a 1MB+ bundle
      // for 100+ extra publisher host patterns causes CPU timeout (503).
      const textRewriteHosts = (
        coreJsRewriteHosts &&
        (isWebOfScienceProxyHost(target.host) || isScopusProxyHost(target.host)) &&
        isJavaScriptContentType(contentType)
      )
        ? coreJsRewriteHosts
        : proxyableHosts;
      text = rewriteSessionTextProxyUrls(text, url.hostname, session.origin_host, textRewriteHosts);
      if (isWebOfScienceProxyHost(target.host)) {
        text = rewriteCloudflareChallengePaths(text);
      }
    }
    if (!challengeSurface && isWebOfScienceProxyHost(target.host) && isJavaScriptContentType(contentType)) {
      text = injectSessionHostFullTextProxyRuntime(text, url.hostname, session.origin_host, proxyableHosts);
    }
    if (!challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = injectSessionHostLinkProxyScript(text, url.hostname, session.origin_host, proxyableHosts);
    }
    if (publisherCookieScopeHost && !challengeSurface && shouldRewritePublisherTextBody(target, contentType)) {
      text = rewriteSessionTextProxyUrls(text, url.hostname, session.origin_host, proxyableHosts);
      text = rewritePublisherHostJavaScriptText(text, url.hostname, publisherCookieScopeHost, proxyableHosts);
      text = rewriteCloudflareChallengePaths(text);
    }
    if (isScopusProxyHost(target.host) && !challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = patchScopusNextData(text, session.origin_host, url.hostname);
      text = injectScopusAnalyticsStub(text);
    }
    if (isWileyProxyHost(target.host) && !challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = stripWileyThirdPartyScripts(text);
      text = injectWileyConsentHide(text);
      text = injectWileyBackForwardReload(text);
      respHeaders.set('Cache-Control', 'no-store');
    }
    if (challengeSurface) {
      text = relaxProxyMetaContentSecurityPolicy(text);
      text = rewriteCloudflareChallengePaths(text);
      text = injectCloudflareChallengeCookieNamespaceScript(text, publisherCookieScopeHost);
      clearRawPublisherClearanceCookies(
        respHeaders,
        publisherCookieScopeHost,
        proxyCookieDomainFromEnv(env, url.hostname)
      );
    }
    if (publisherCookieScopeHost && publisherCookieScopeHost !== 'scopus.com' && !challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = relaxProxyMetaContentSecurityPolicy(text);
      text = injectPublisherCookieNamespaceScript(
        text,
        publisherCookieScopeHost,
        target.host,
        isStagingEnv(env)
      );
    }
    if (!challengeSurface && /\btext\/html\b/i.test(contentType)) {
      text = injectRaLinkAuditScript(text, session);
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
  const cookieSid = readProxySessionCookie(request.headers.get('Cookie'));

  // mod uyumu kontrolü (jti henüz tüketilmemiş veya sadece doğrulama amaçlı)
  if (payload.mod !== 'session_host_proxy') {
    return htmlError(400, 'Token modu bu proxy ile uyumsuz.');
  }

  // KV session'ı doğrula (issue-token tarafından önceden yazılmış)
  const session = await loadCachedSessionHostSession(env, sessionId);

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

  const headers = new Headers({
    Location: buildStableHostEntryRedirectUrl(clean),
  });
  headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ` +
      `Domain=${url.hostname}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`
  );
  headers.append('Set-Cookie', buildCompatSessionCookie(sessionId, proxyCookieDomainFromEnv(env, url.hostname)));

  return new Response(null, {
    status: 302,
    headers,
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

function redirectResponse(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
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

const STATIC_ASSET_PATH_RE = /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|ico|txt|map)(?:$|[?#])/i;

function isStaticAssetPath(path) {
  return STATIC_ASSET_PATH_RE.test(String(path || ''));
}

function buildStaticAssetCacheKey(target, search) {
  const keyUrl = new URL('https://ra-static-cache.libedge.local/wiley-asset');
  keyUrl.searchParams.set('h', target.host);
  keyUrl.searchParams.set('p', target.path || '/');
  keyUrl.searchParams.set('q', String(search || '').replace(/^\?/, ''));
  return new Request(keyUrl.toString(), { method: 'GET' });
}

function buildStaticAssetCacheResponse(resp) {
  if (!resp || resp.status !== 200) return null;
  const contentType = resp.headers.get('Content-Type') || '';
  if (/\btext\/html\b/i.test(contentType)) return null;
  const headers = new Headers(resp.headers);
  headers.delete('Set-Cookie');
  headers.delete('set-cookie');
  headers.delete('Content-Length');
  headers.delete('content-length');
  headers.set('Cache-Control', 'public, max-age=604800, immutable');
  headers.set('X-RA-Asset-Cache', 'STORE');
  return new Response(resp.clone().body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

function dedupeCookieHeaderKeepLast(cookieHeader) {
  if (!cookieHeader) return '';
  const order = [];
  const values = new Map();
  for (const part of String(cookieHeader).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!name) continue;
    if (!values.has(name)) order.push(name);
    values.set(name, value);
  }
  return order
    .filter(name => values.has(name))
    .map(name => `${name}=${values.get(name)}`)
    .join('; ');
}

function isCloudflareChallengeHtml(text) {
  const sample = String(text || '').slice(0, 5000).toLowerCase();
  return sample.includes('__cf_chl')
    || sample.includes('just a moment')
    || sample.includes('checking your browser')
    || sample.includes('cf-browser-verification')
    || sample.includes('cloudflare ray id');
}

function wileyNoiseResponse(target, method = 'GET') {
  if (!isWileyProxyHost(target.host)) return null;
  const path = String(target.path || '');
  if (/^\/v2\/(?:r|p)(?:$|[/?#])/i.test(path)) {
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'X-RA-Wiley-Noise': '204',
      },
    });
  }
  if (/^\/v2\/decide(?:$|[/?#])/i.test(path)) {
    const body = method.toUpperCase() === 'POST' ? '{}' : '';
    return new Response(body, {
      status: method.toUpperCase() === 'POST' ? 200 : 204,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-RA-Wiley-Noise': 'decide',
      },
    });
  }
  if (/^\/pb-assets\/utm_params_config\/submission-systems-domains-\d+\.txt$/i.test(path)) {
    return new Response('', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
        'X-RA-Wiley-Noise': 'utm-empty',
      },
    });
  }
  if (/^\/action\/doSuggest(?:$|[/?#])/i.test(path)) {
    return new Response('[]', {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-RA-Wiley-Noise': 'suggest-empty',
      },
    });
  }
  if (/^\/resource\/lodash(?:$|[/?#])/i.test(path)) {
    return new Response('/* Lodash is unavailable */\n', {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-RA-Wiley-Noise': 'lodash-stub',
      },
    });
  }
  return null;
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
  if (url.pathname === LINK_AUDIT_PATH) {
    const sessionId = readProxySessionCookie(request.headers.get('Cookie'));
    const session = sessionId ? await loadProxySession(env, sessionId) : null;
    if (!session) return new Response(null, { status: 204 });
    return await handleLinkAudit(request, env, session, url, sessionId);
  }

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
    targetHost,
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
    return normalizeLoadedProxySession(s);
  } catch {
    return null;
  }
}

function normalizeLoadedProxySession(session) {
  if (!session || typeof session !== 'object') return session;
  if (isScienceDirectSurface({ host: session.origin_host }, { productSlug: session.product_slug }) &&
      !isScienceDirectProxyHost(session.origin_host)) {
    return { ...session, origin_host: 'www.sciencedirect.com' };
  }
  return session;
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

async function loadCachedSessionHostSession(env, sessionId) {
  const key = `rhost:${sessionId}`;
  const now = Date.now();
  const hit = sessionKvCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const value = await env.RA_UPSTREAM_SESSIONS.get(key, 'json');
  if (value) {
    if (sessionKvCache.size >= SESSION_KV_CACHE_MAX) {
      const oldest = sessionKvCache.keys().next().value;
      if (oldest) sessionKvCache.delete(oldest);
    }
    sessionKvCache.set(key, {
      value,
      expiresAt: now + SESSION_KV_CACHE_TTL_MS,
    });
  } else {
    sessionKvCache.delete(key);
  }
  return value;
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
  // Akamai bot-detection cookies/headers — proxy infrastructure artifacts.
  'x-1p-wos-no-action',
  'awsenv', 'ak_bmsc', 'bm_sv', 'bm_mi', 'bm_sz', '_abck',
  // Wiley stanza: these client/app tracking headers should not be relayed.
  'x-application-id', 'x-request-id', 'x-transient-subjectid',
  // Scopus stanza.
  'authentication-source',
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
    if (
      HOP_BY_HOP.has(lower) ||
      STRIP_REQUEST.has(lower) ||
      isCasPrivateHeader(lower) ||
      lower === 'x-requested-with'
    ) continue;
    // Scopus: EZproxy stanza "HTTPHeader -request -process authentication-source"
    if (lower === 'authentication-source' && context.publisherCookieScopeHost === 'scopus.com') continue;
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
          context.publisherCookieScopeHost || '',
          {
            allowCloudflareChallengeRuntimeCookies: isCloudflareChallengeAssetPath(context.targetPath),
          }
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
  if (shouldInjectOxfordProxyServerHeader(context) && !out.has('X-Proxy-Server')) {
    out.set('X-Proxy-Server', context.proxyHostname);
  }
  if (isWileyProxyHost(context.originHost) || isWileyProxyHost(context.targetHost)) {
    out.set('X-Forwarded-For', '127.0.0.1');
  }
  return out;
}

function shouldInjectOxfordProxyServerHeader(context = {}) {
  const host = normalizeHost(context.originHost);
  return Boolean(context.proxyHostname) && (
    host === 'oup.com' ||
    host.endsWith('.oup.com')
  );
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
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'x-frame-options',
]);
const STRIP_WAF_CHALLENGE_RESPONSE = new Set([
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
  'permissions-policy',
  'referrer-policy',
  'x-frame-options',
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
export function rewriteQueryProxyUrls(search, proxyHostname, originHost, options = {}) {
  const maybeEncodedScienceDirectPdfHost = isScienceDirectPdfPath(options.targetPath);
  if (!search || (!search.includes(proxyHostname) && !maybeEncodedScienceDirectPdfHost)) return search;
  const normalizedProxyHost = normalizeHost(proxyHostname);
  const normalizedOriginHost = normalizeHost(originHost);
  const normalizedSessionOriginHost = normalizeHost(options.sessionOriginHost);
  const callbackParamNames = new Set(['redirect_uri', 'redirect_url', 'return_url', 'returnUrl']);

  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    let changed = false;

    // ScienceDirect search APIs send hostname=<window.location.hostname>.
    // Upstream validates this against its own host and rejects proxy hostnames
    // with 401, so restore the publisher hostname before forwarding.
    if (
      !options.preserveHostnameParam &&
      normalizedProxyHost &&
      normalizedOriginHost &&
      normalizeHost(params.get('hostname')) === normalizedProxyHost
    ) {
      params.set('hostname', normalizedOriginHost);
      changed = true;
    }

    if (isScienceDirectPdfPath(options.targetPath) && normalizedProxyHost && normalizedOriginHost) {
      for (const key of ['host', 'tsoh', 'rh', 'ns_h']) {
        if (decodeBase64UrlParam(params.get(key)) === normalizedProxyHost) {
          params.set(key, btoa(normalizedOriginHost));
          changed = true;
        }
      }
    }

    if (normalizedProxyHost && normalizedSessionOriginHost) {
      for (const key of callbackParamNames) {
        const value = params.get(key);
        const rewritten = rewriteQueryParamProxyUrlHost(value, normalizedProxyHost, normalizedSessionOriginHost);
        if (rewritten && rewritten !== value) {
          params.set(key, rewritten);
          changed = true;
        }
      }
    }

    if (normalizedProxyHost && normalizedOriginHost) {
      for (const [key, value] of params.entries()) {
        if (callbackParamNames.has(key)) continue;
        if (key === 'hostname') continue;
        const rewritten = rewriteQueryParamProxyUrlHost(value, normalizedProxyHost, normalizedOriginHost);
        if (rewritten && rewritten !== value) {
          params.set(key, rewritten);
          changed = true;
        }
      }
    }

    if (changed) {
      return `?${params.toString()}`;
    }
  } catch {
    // Fall back to the plain string replacement below.
  }

  // URL-encoded ve plain her iki forma da bak
  return rewritePlainProxyUrlsInSearch(search, proxyHostname, originHost);
}

function rewritePlainProxyUrlsInSearch(search, proxyHostname, originHost) {
  return String(search || '')
    .replaceAll(encodeURIComponent(`https://${proxyHostname}`), encodeURIComponent(`https://${originHost}`))
    .replaceAll(`https://${proxyHostname}`, `https://${originHost}`);
}

function isScienceDirectPdfPath(pathname = '') {
  const path = String(pathname || '').toLowerCase();
  return path.endsWith('/pdfft') || path.includes('/pdfft/');
}

function decodeBase64UrlParam(value) {
  if (!value) return '';
  try {
    return atob(String(value).replace(/-/g, '+').replace(/_/g, '/')).trim().toLowerCase();
  } catch {
    return '';
  }
}

export function scienceDirectPdfDirectProxyLocation(url, target = {}) {
  if (!url || !isScienceDirectProxyHost(target.host) || !isScienceDirectPdfPath(target.path)) return '';
  const decodedOriginal = decodeHexUrlParam(url.searchParams?.get('original'));
  if (!decodedOriginal || !decodedOriginal.startsWith('?')) return '';
  const params = new URLSearchParams(decodedOriginal.slice(1));
  const pid = params.get('pid') || '';
  if (!/\.pdf$/i.test(pid)) return '';
  const pdfPath = String(target.path || '').replace(/\/pdfft(?:\/.*)?$/i, '/pdf');
  if (!pdfPath || pdfPath === target.path) return '';
  const query = params.toString();
  return `${url.origin}${pdfPath}${query ? `?${query}` : ''}`;
}

function decodeHexUrlParam(value) {
  const input = String(value || '').trim();
  if (!input || input.length % 2 || !/^[0-9a-f]+$/i.test(input)) return '';
  try {
    const bytes = [];
    for (let i = 0; i < input.length; i += 2) bytes.push(parseInt(input.slice(i, i + 2), 16));
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}

function rewriteQueryParamProxyUrlHost(value, proxyHostname, replacementHost) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (normalizeHost(parsed.hostname) !== proxyHostname) return value;
    // Preserve proxy alt-host routing paths: /__ra-host/<pub>/ is an internal
    // proxy path that must stay on the proxy hostname so OAuth redirect_uri
    // callbacks (e.g. Springer IDP → back to proxy) route correctly.
    if (parsed.pathname.startsWith(SESSION_ALT_HOST_PREFIX)) return value;
    parsed.hostname = replacementHost;
    return parsed.toString();
  } catch {
    return String(value)
      .replaceAll(`https://${proxyHostname}`, `https://${replacementHost}`)
      .replaceAll(encodeURIComponent(`https://${proxyHostname}`), encodeURIComponent(`https://${replacementHost}`));
  }
}

function parseSessionHostTarget(pathname, originHost, proxyableHosts, upstreamCookieHost = null, context = {}) {
  if (!pathname.startsWith(SESSION_ALT_HOST_PREFIX)) {
    const path = rewriteProxyChallengePath(pathname || '/');
    return {
      host: shouldRouteSessionPathToOrigin(path, originHost, context)
        ? originHost
        : upstreamCookieHost || originHost,
      path,
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

export function shouldRouteSessionPathToOrigin(pathname, originHost, context = {}) {
  const path = rewriteProxyChallengePath(pathname || '/');
  if (isScienceDirectSurface({ host: originHost }, context)) {
    return path === '/' ||
      path.startsWith('/search') ||
      path.startsWith('/journal/') ||
      path.startsWith('/science/') ||
      path.startsWith('/book/') ||
      path.startsWith('/user/') ||
      path.startsWith('/sdfe/') ||
      path.startsWith('/shared-assets/') ||
      path.startsWith('/eu-west-1/') ||
      path.startsWith('/prod/') ||
      path.startsWith('/feature/') ||
      path.startsWith('/assets/') ||
      path === '/arp.css' ||
      path === '/arp.js' ||
      path === '/ai-components';
  }
  if (!isWebOfScienceSurface({ host: originHost }, context)) return false;

  return path.startsWith('/api/wosnx/') ||
    path === '/api/wosnxcorews' ||
    path.startsWith('/api/wosnxcorews/') ||
    path.startsWith('/api/esti/') ||
    path === '/api/gateway' ||
    path.startsWith('/api/gateway/');
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

    rewriteNestedSessionRedirectParams(loc, proxyHostname, originHost, proxyableHosts);
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
  if (isCloudflareChallengeAssetTarget(target)) return false;
  if (/\btext\/html\b/i.test(contentType)) return true;

  // EMIS mobile keeps API origins in a tiny runtime config file. Rewriting only
  // this file avoids touching large application bundles while fixing mobile XHRs.
  if (target.host === 'm.emis.com') {
    return /^\/config\/application(?:_[a-z0-9-]+)?\.js$/i.test(target.path);
  }

  // Web of Science's SPA bundles contain absolute www.webofscience.com
  // navigation URLs (including location.href assignments). Those cannot be
  // intercepted reliably at runtime, so rewrite WoS/Clarivate text bundles.
  return isWebOfScienceProxyHost(target.host) ||
    isElsevierProxyHost(target.host) ||
    isScopusProxyHost(target.host) ||
    isWileyProxyHost(target.host) ||
    isProQuestProxyHost(target.host) ||
    isSpringerProxyHost(target.host) ||
    isNatureProxyHost(target.host);
}

function rewriteNestedSessionRedirectParams(loc, proxyHostname, originHost, proxyableHosts) {
  const targetHost = normalizeHost(loc?.hostname);
  if (!shouldRewriteNestedRedirectParamsForLocationHost(targetHost)) return;

  for (const key of ['redirect_uri', 'redirect_url', 'return_url', 'returnUrl']) {
    const rawValue = loc.searchParams.get(key);
    const rewritten = rewriteNestedSessionRedirectParam(
      rawValue,
      proxyHostname,
      originHost,
      proxyableHosts
    );
    if (rewritten && rewritten !== rawValue) {
      loc.searchParams.set(key, rewritten);
    }
  }
}

function shouldRewriteNestedRedirectParamsForLocationHost(host) {
  return host === 'idp.springer.com' ||
    host === 'idp.nature.com';
}

function rewriteNestedSessionRedirectParam(rawValue, proxyHostname, originHost, proxyableHosts) {
  if (!rawValue) return '';
  try {
    const nested = new URL(rawValue);
    const nestedHost = normalizeHost(nested.hostname);
    if (!nestedHost || !proxyableHosts.has(nestedHost)) return rawValue;
    if (nestedHost === 'www.nature.com' && nested.pathname === '/nature') {
      nested.pathname = '/';
    }
    const path = sessionHostPathFor(nestedHost, originHost, nested.pathname || '/');
    return `https://${proxyHostname}${path}${nested.search}${nested.hash}`;
  } catch {
    return rawValue;
  }
}

function isJavaScriptContentType(contentType) {
  return /\b(javascript|ecmascript)\b/i.test(contentType || '');
}

export function webOfScienceFailureFallbackResponse(target, upstreamResp, context = {}) {
  if (!isWebOfScienceSurface(target, context) || upstreamResp?.ok) return null;

  const p = String(target?.path || '');
  const jsonHeaders = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });

  // esti Chat service — not subscribed → 403; return empty conversation list.
  if (p.startsWith('/api/esti/')) {
    return new Response('[]', { status: 200, headers: jsonHeaders });
  }

  // wosnx indicators — 400 when no marked items or session state missing.
  if (p.startsWith('/api/wosnx/indic/')) {
    return new Response('{"count":0,"total":0,"items":[],"records":[]}', {
      status: 200,
      headers: jsonHeaders,
    });
  }

  // SignalR HTTP fallback can surface authorization/internal errors after the
  // WebSocket leg closes. Send a normal hub close frame so Angular does not
  // convert the failure into a full WoS session re-auth refresh.
  if (p === '/api/wosnxcorews' || p.startsWith('/api/wosnxcorews/')) {
    return new Response('{"type":7}\x1e', { status: 200, headers: jsonHeaders });
  }

  return null;
}

export function proQuestFailureFallbackResponse(target, upstreamResp) {
  if (!isProQuestProxyHost(target?.host) || !upstreamResp || upstreamResp.status < 500) return null;

  const path = String(target?.path || '').toLowerCase();
  // ProQuest uses Tapestry deferred panels for optional related-content widgets.
  // Some of those endpoints return a full exception page through the proxy and
  // the client opens a disruptive "encountered a problem" popup. The primary
  // page/search/docview flow is already loaded; suppress only deferred widgets.
  if (path.includes('longdeferreddisplay:longdeferreddisplayaction')) {
    return new Response(null, {
      status: 204,
      headers: new Headers({ 'Cache-Control': 'no-store' }),
    });
  }

  return null;
}

export function webOfScienceDynamicRedirectHost(location, target, session = {}) {
  if (!location) return '';
  if (!isWebOfScienceSurface({ host: session.origin_host || target?.host }, {
    productSlug: session.product_slug,
  })) {
    return '';
  }
  if (!isWebOfScienceGatewayRedirectSurface(target)) return '';

  try {
    const loc = new URL(location);
    if (loc.protocol !== 'https:' && loc.protocol !== 'http:') return '';
    const host = normalizeHost(loc.hostname);
    if (!host) return '';
    const currentHost = normalizeHost(target?.host);
    return host === currentHost ? '' : host;
  } catch {
    return '';
  }
}

function isWebOfScienceGatewayRedirectSurface(target) {
  const host = normalizeHost(target?.host);
  const path = String(target?.path || '');
  return (isWebOfScienceProxyHost(host) && path.startsWith('/api/gateway')) ||
    host === 'ct.prod.getft.io';
}

export function getFtrEmbeddedTargetUrl(target) {
  if (normalizeHost(target?.host) !== 'ct.prod.getft.io') return null;
  const candidates = String(target?.path || '')
    .replace(/^\/+/, '')
    .split(/[/.]/)
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const normalized = candidate.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = atob(padded);
      const match = decoded.match(/https?:\/\/[^,\s]+/i);
      if (!match) continue;
      const url = new URL(match[0]);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      return url;
    } catch {
      // Try the next token-like segment.
    }
  }
  return null;
}

export function scienceDirectDynamicRedirectHost(location, target, session = {}) {
  if (!location) return '';
  if (!isScienceDirectSurface({ host: session.origin_host || target?.host }, {
    productSlug: session.product_slug,
  })) {
    return '';
  }
  if (!isScienceDirectDoiRedirectSurface(target)) return '';

  try {
    const loc = new URL(location);
    if (loc.protocol !== 'https:' && loc.protocol !== 'http:') return '';
    const host = normalizeHost(loc.hostname);
    if (!isScienceDirectDoiChainHost(host) && !isScienceDirectProxyHost(host)) return '';
    const currentHost = normalizeHost(target?.host);
    return host === currentHost ? '' : host;
  } catch {
    return '';
  }
}

function isScienceDirectDoiRedirectSurface(target) {
  const host = normalizeHost(target?.host);
  return host === 'doi.org' ||
    host === 'dx.doi.org' ||
    host === 'linkinghub.elsevier.com';
}

function isScienceDirectDoiChainHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'doi.org' ||
    normalized === 'dx.doi.org' ||
    normalized === 'linkinghub.elsevier.com';
}

async function handleSessionHostRedirectWrapper(request, env, url, session, sessionId = '') {
  const raw = url.searchParams.get('redirectUrl') || url.searchParams.get('url') || '';
  if (!raw) return htmlError(400, 'redirectUrl eksik.');

  const proxyableHosts = await loadSessionProxyableHosts(env, session, sessionId);
  const fallback = new URL('/', url);

  let target;
  try {
    target = new URL(raw, `https://${url.hostname}/`);
  } catch {
    return redirectResponse(fallback.toString(), 302);
  }

  if (target.hostname === url.hostname) {
    return redirectResponse(`${target.pathname || '/'}${target.search}${target.hash}`, 302);
  }

  const rewritten = rewriteSessionHostLocationWithUpstreamCookie(
    target.toString(),
    url.hostname,
    session.origin_host,
    session.origin_host,
    proxyableHosts
  );
  if (!rewritten.location || rewritten.location === target.toString()) {
    return redirectResponse(fallback.toString(), 302);
  }

  const response = redirectResponse(rewritten.location, 302);
  if (rewritten.upstreamCookie) {
    response.headers.append('Set-Cookie', rewritten.upstreamCookie);
  }
  return response;
}

function shouldRewriteCurrentHostTextResponse(target, originHost, contentType) {
  if (!target || target.host === originHost) return false;
  return /\b(javascript|ecmascript|json|text\/html|text\/plain|text\/css)/i.test(contentType || '');
}

export function shouldRewritePublisherTextBody(target, contentType = '') {
  if (!target) return true;
  if (/\btext\/html\b/i.test(contentType || '')) return true;
  return !isCloudflareChallengeAssetTarget(target);
}

function isCloudflareChallengeAssetTarget(target) {
  return isCloudflareChallengeAssetPath(target?.path);
}

function isCloudflareChallengeAssetPath(path) {
  return String(path || '').startsWith('/cdn-cgi/challenge-platform/');
}

function isCloudflareTelemetryPath(path) {
  const p = rewriteProxyChallengePath(String(path || ''));
  return p === '/cdn-cgi/rum' || p.startsWith('/cdn-cgi/rum?') ||
    p === '/cdn-cgi/beacon/expect-ct' || p === '/cdn-cgi/trace';
}

async function proxyWebSocket(wsUrl, upstreamHeaders) {
  upstreamHeaders.set('Upgrade', 'websocket');
  upstreamHeaders.set('Connection', 'Upgrade');

  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  let upstream = null;
  try {
    const upstreamResp = await fetch(wsUrl, { headers: upstreamHeaders });
    if (upstreamResp.webSocket) {
      upstream = upstreamResp.webSocket;
      upstream.accept();
    }
  } catch {
    // upstream connection failed
  }

  if (!upstream) {
    // Close gracefully — Angular/SignalR treats 1001 as temporary unavailability,
    // not auth failure, so it won't trigger a session re-auth page refresh.
    server.close(1001, '');
    return new Response(null, { status: 101, webSocket: client });
  }

  server.addEventListener('message', ({ data }) => { try { upstream.send(data); } catch {} });

  upstream.addEventListener('message', ({ data }) => {
    // Filter SignalR authorization error messages — relaying them causes WoS
    // Angular to trigger a full session re-auth redirect loop.
    if (typeof data === 'string' && data.toLowerCase().includes('authorization')) return;
    try { server.send(data); } catch {}
  });

  server.addEventListener('close', ({ code, reason }) => { try { upstream.close(code, reason); } catch {} });

  upstream.addEventListener('close', ({ code, reason }) => {
    // Map auth-related close reasons to 1001 so Angular doesn't re-auth.
    const isAuth = String(reason || '').toLowerCase().includes('authorization');
    try { server.close(isAuth ? 1001 : code, isAuth ? '' : reason); } catch {}
  });

  server.addEventListener('error', () => { try { upstream.close(1011); } catch {} });
  upstream.addEventListener('error', () => { try { server.close(1001, ''); } catch {} });

  return new Response(null, { status: 101, webSocket: client });
}

function isWebOfScienceProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'webofscience.com' ||
    normalized.endsWith('.webofscience.com') ||
    normalized === 'webofknowledge.com' ||
    normalized.endsWith('.webofknowledge.com') ||
    normalized === 'clarivate.com' ||
    normalized.endsWith('.clarivate.com');
}

function isWebOfScienceSurface(target, context = {}) {
  return isWebOfScienceProxyHost(target?.host) ||
    String(context.productSlug || '').toLowerCase().includes('web-of-science') ||
    String(context.productSlug || '').toLowerCase().includes('webofscience') ||
    String(context.productSlug || '').toLowerCase().includes('wos');
}

function isScienceDirectProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'sciencedirect.com' ||
    normalized.endsWith('.sciencedirect.com');
}

function isScienceDirectSurface(target, context = {}) {
  const slug = String(context.productSlug || '').toLowerCase();
  return isScienceDirectProxyHost(target?.host) ||
    slug.includes('science-direct') ||
    slug.includes('sciencedirect');
}

function isScopusProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'scopus.com' || normalized.endsWith('.scopus.com');
}

function isElsevierProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'elsevier.com' ||
    normalized.endsWith('.elsevier.com') ||
    normalized === 'id.elsevier.com' ||
    normalized === 'els-cdn.com' ||
    normalized.endsWith('.els-cdn.com') ||
    normalized === 'components.scopus.com' ||
    normalized === 'linkinghub.elsevier.com' ||
    isScienceDirectProxyHost(normalized) ||
    isScopusProxyHost(normalized);
}

function isWileyProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'wiley.com' ||
    normalized.endsWith('.wiley.com') ||
    normalized === 'onlinelibrary.wiley.com' ||
    normalized.endsWith('.onlinelibrary.wiley.com') ||
    normalized === 'wileyonlinelibrary.com' ||
    normalized.endsWith('.wileyonlinelibrary.com') ||
    normalized === 'interscience.wiley.com' ||
    normalized.endsWith('.interscience.wiley.com');
}

function isProQuestProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'proquest.com' || normalized.endsWith('.proquest.com');
}

function isSpringerProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'springer.com' ||
    normalized.endsWith('.springer.com') ||
    normalized === 'springerlink.com' ||
    normalized.endsWith('.springerlink.com');
}

function isNatureProxyHost(host) {
  const normalized = normalizeHost(host);
  return normalized === 'nature.com' || normalized.endsWith('.nature.com');
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
  let out = String(text || '').replaceAll(
    `globalNav('//www.cambridge.org/tools/packages/cambridge_themes/`,
    `globalNav('/tools/packages/cambridge_themes/`
  );
  for (const targetHost of exactProxyableHosts(proxyableHosts)) {
    // Nature's Verify endpoint intentionally stays cross-origin. Nature handles
    // that failure path; rewriting it to the proxy turns it into /verify/status
    // and triggers institutionalLogin errors in Chrome profiles.
    if (targetHost === 'verify.nature.com') continue;

    const proxyOrigin = targetHost === originHost
      ? `https://${proxyHostname}`
      : `https://${proxyHostname}${SESSION_ALT_HOST_PREFIX}${encodeHost(targetHost)}`;
    const escapedProxyOrigin = proxyOrigin.replaceAll('/', '\\/');
    const encodedProxyOrigin = encodeURIComponent(proxyOrigin);
    const doubleEncodedProxyOrigin = encodeURIComponent(encodedProxyOrigin);

    const plainHost = proxyOrigin.replace(/^https:\/\//, '');
    out = out
      .replaceAll(`https://${targetHost}`, proxyOrigin)
      .replaceAll(`http://${targetHost}`, proxyOrigin)
      .replaceAll(`//${targetHost}`, proxyOrigin.replace(/^https:/, ''))
      .replaceAll(`"${targetHost}"`, `"${plainHost}"`)
      .replaceAll(`'${targetHost}'`, `'${plainHost}'`)
      .replaceAll(`"${targetHost}/`, `"${plainHost}/`)
      .replaceAll(`'${targetHost}/`, `'${plainHost}/`)
      .replaceAll(`=${targetHost}/`, `=${plainHost}/`)
      .replaceAll(`&${targetHost}/`, `&${plainHost}/`)
      .replaceAll(`https:\\/\\/${targetHost}`, escapedProxyOrigin)
      .replaceAll(`http:\\/\\/${targetHost}`, escapedProxyOrigin)
      .replaceAll(`\\/\\/${targetHost}`, escapedProxyOrigin.replace(/^https:\\/, ''))
      .replaceAll(`https%3A%2F%2F${targetHost}`, encodedProxyOrigin)
      .replaceAll(`http%3A%2F%2F${targetHost}`, encodedProxyOrigin)
      .replaceAll(`https%253A%252F%252F${targetHost}`, doubleEncodedProxyOrigin)
      .replaceAll(`http%253A%252F%252F${targetHost}`, doubleEncodedProxyOrigin);

    // Obfuscated hostname (dots replaced with __): e.g. www__webofscience__com
    // Publishers use this to bypass naive proxy text rewriters.
    const obfuscatedTarget = targetHost.replace(/\./g, '__');
    if (obfuscatedTarget !== targetHost) {
      const obfuscatedProxy = proxyHostname.replace(/\./g, '__');
      out = out.replaceAll(obfuscatedTarget, obfuscatedProxy);
    }
  }

  out = applyStanzaTextRewrites(out, proxyHostname);

  return out
    .replace(
      /cookieDomain:\s*(['"])\.emis\.com\1/g,
      `cookieDomain: '${proxyHostname}'`
    );
}

function applyStanzaTextRewrites(text, proxyHostname) {
  const proxyOrigin = `https://${proxyHostname}`;
  const proxyOriginEncoded = encodeURIComponent(proxyOrigin);
  const proxyOriginDoubleEncoded = encodeURIComponent(proxyOriginEncoded);
  const natureEnsightenProxy = `${proxyHostname}${SESSION_ALT_HOST_PREFIX}${encodeHost('nexus.ensighten.com')}`;
  return String(text || '')
    // Nature EZproxy stanza compatibility:
    // Find nexus.ensighten.com / Replace ^pnexus.ensighten.com^
    // Bare host strings are later combined with a protocol/path by Nature's JS.
    .replace(/(["'=])nexus\.ensighten\.com(?=["'/:&?#])/gi, `$1${natureEnsightenProxy}`)
    // Nature loads YouTube iframes lazily with data-src; promote to src so the
    // embedded player link is usable through the proxied page.
    .replace(/<iframe\b([^>]*?)\sdata-src=(["'])https:\/\/www\.youtube\.com\//gi, '<iframe$1 src=$2https://www.youtube.com/')
    .replaceAll('window.location.host=="congressional.proquest.com"', 'true')
    .replace(
      /if\(!document\.location\.hostname\.toLowerCase\(\)\.endsWith\(pqDomain\)\)/g,
      'if(false)'
    )
    .replaceAll(
      'window.location.replace(redirectURL)',
      `window.location.replace(String(redirectURL||'').replace(/^https:\\/\\/www\\.proquest\\.com/i, ${JSON.stringify(proxyOrigin)}))`
    )
    .replaceAll('["APP_DOMAIN"] = "www.scopus.com";', `["APP_DOMAIN"] = "${proxyHostname}";`)
    .replaceAll('["APP_DOMAIN"]="www.scopus.com";', `["APP_DOMAIN"]="${proxyHostname}";`)
    .replaceAll('redirect_uri=https%3A%2F%2Fwww.scopus.com', `redirect_uri=${proxyOriginEncoded}`)
    .replaceAll('redirect_uri=https%3A%2F%2Fwww.sciencedirect.com', `redirect_uri=${proxyOriginEncoded}`)
    .replaceAll('redirect_uri=https://www.scopus.com', `redirect_uri=${proxyOrigin}`)
    .replaceAll('redirect_uri=https://www.sciencedirect.com', `redirect_uri=${proxyOrigin}`)
    .replaceAll('gsUrl%22%3A%22https%3A%2F%2Fwww.scopus.com%2F', `gsUrl%22%3A%22${proxyOriginEncoded}%2F`)
    .replaceAll('gsUrl%22%3A%22https%3A%2F%2Fwww.sciencedirect.com%2F', `gsUrl%22%3A%22${proxyOriginEncoded}%2F`)
    .replaceAll('pdfurl%3D%22https%3A%2F%2Fwww.sciencedirect.com%2F', `pdfurl%3D%22${proxyOriginEncoded}%2F`)
    .replaceAll('pdfurl="//www.sciencedirect.com/', `pdfurl="//${proxyHostname}/`)
    .replaceAll('%22%3A%22https%3A%2F%2Fsciverse-shindig.elsevier.com%2F', `%22%3A%22${proxyOriginEncoded}%2F__ra-host%2Fsciverse--shindig-elsevier-com%2F`)
    .replaceAll('https%253A%252F%252Fwww.scopus.com', proxyOriginDoubleEncoded)
    .replaceAll('https%253A%252F%252Fwww.sciencedirect.com', proxyOriginDoubleEncoded)
    .replace(/"null\//g, `"//${proxyHostname}/`);
}

export function injectSessionHostLinkProxyScript(text, proxyHostname, originHost, proxyableHosts) {
  const html = String(text || '');

  const hosts = proxyableHostPatterns(proxyableHosts);
  if (!hosts.length || !normalizeHost(proxyHostname) || !normalizeHost(originHost)) return html;

  const scripts = [];
  if (!html.includes('__raReservedPathProxy')) {
    scripts.push(buildSessionHostReservedPathProxyScript());
  }
  if (!html.includes('__raFullTextProxyV1')) {
    scripts.push(buildSessionHostFullTextProxyScript(proxyHostname, originHost, hosts));
  }
  if (!html.includes('__raSessionHostLinkProxy')) {
    scripts.push(hardenSessionHostLinkProxyScript(
      buildSessionHostLinkProxyScript(proxyHostname, originHost, hosts)
    ));
  }
  if (!scripts.length) return html;

  const script = scripts.join('');
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  }
  if (/<script\b/i.test(html)) {
    return html.replace(/<script\b/i, `${script}<script`);
  }
  return `${script}${html}`;
}

function buildSessionHostLinkProxyScript(proxyHostname, originHost, hosts) {
  const safeProxyHost = JSON.stringify(proxyHostname).replace(/<\/script/gi, '<\\/script');
  const safeOriginHost = JSON.stringify(originHost).replace(/<\/script/gi, '<\\/script');
  const safeHosts = JSON.stringify(hosts).replace(/<\/script/gi, '<\\/script');
  return `<script>(function(){try{if(window.__raSessionHostLinkProxy)return;Object.defineProperty(window,'__raSessionHostLinkProxy',{value:1});var proxyHost=${safeProxyHost};var originHost=${safeOriginHost};var hosts=${safeHosts};var allowed={};var wild=[];for(var i=0;i<hosts.length;i++){var hh=hosts[i];if(String(hh).indexOf('*.')===0)wild.push(String(hh).slice(2));else allowed[hh]=1;}function ok(h){if(allowed[h])return true;for(var i=0;i<wild.length;i++){if(h.length>wild[i].length&&h.slice(-(wild[i].length+1))==='.'+wild[i])return true;}return false;}var attrs=['href','action','data-href','data-url','data-link','data-target','data-destination'];function enc(h){h=String(h||'').toLowerCase();var o='';for(var i=0;i<h.length;i++){var c=h.charAt(i);o+=c==='.'?'-':(c==='-'?'--':c);}return o;}function proxify(raw){try{if(!raw||/^(#|mailto:|tel:|javascript:)/i.test(raw))return raw;var u=new URL(raw,location.href);var h=u.hostname.toLowerCase();if(h===proxyHost||!ok(h))return raw;var p=u.pathname||'/';return location.origin+(h===originHost?p:('/__ra-host/'+enc(h)+p))+u.search+u.hash;}catch(e){return raw;}}try{var ow=window.open;if(ow)window.open=function(u,n,f){var nu=proxify(u);return ow.call(window,nu||u,n,f);};var lp=window.Location&&window.Location.prototype;if(lp){var oa=lp.assign;if(oa)lp.assign=function(u){return oa.call(this,proxify(u)||u);};var or=lp.replace;if(or)lp.replace=function(u){return or.call(this,proxify(u)||u);};}}catch(e){}function fixel(el){try{if(!el||!el.getAttribute)return;for(var i=0;i<attrs.length;i++){var a=attrs[i];var v=el.getAttribute(a);var n=proxify(v);if(n&&n!==v)el.setAttribute(a,n);}}catch(e){}}function scan(root){try{root=root||document;if(root.nodeType===1)fixel(root);(root.querySelectorAll?root.querySelectorAll('a[href],area[href],form[action],[data-href],[data-url],[data-link],[data-target],[data-destination]'):[]).forEach(fixel);}catch(e){}}document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href],area[href],[data-href],[data-url],[data-link],[data-target],[data-destination]');if(!a)return;var before=a.getAttribute('href')||a.getAttribute('data-href')||a.getAttribute('data-url')||a.getAttribute('data-link')||a.getAttribute('data-target')||a.getAttribute('data-destination');fixel(a);var after=a.getAttribute('href')||a.getAttribute('data-href')||a.getAttribute('data-url')||a.getAttribute('data-link')||a.getAttribute('data-target')||a.getAttribute('data-destination');if(after&&after!==before&&!/^(a|area)$/i.test(a.tagName||'')){e.preventDefault();location.href=after;}},true);document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.getAttribute)return;fixel(f);},true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan(document);});else scan(document);try{new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==='attributes')fixel(m.target);for(var i=0;i<m.addedNodes.length;i++)scan(m.addedNodes[i]);});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:attrs});}catch(e){}}catch(e){}})();</script>`;
}

function buildSessionHostReservedPathProxyScript() {
  const prefix = CF_CHALLENGE_PROXY_PREFIX.replace(/<\/script/gi, '<\\/script');
  return `<script>(function(){try{if(window.__raReservedPathProxy)return;Object.defineProperty(window,'__raReservedPathProxy',{value:1});var prefix='${prefix}';function fixu(u){try{var s=typeof u==='string'?u:(u&&u.href?String(u.href):(u&&u.url?String(u.url):''));if(!s)return u;if(s.indexOf('/cdn-cgi/')===0)return prefix+s.slice('/cdn-cgi/'.length);var o=location.origin+'/cdn-cgi/';if(s.indexOf(o)===0)return location.origin+prefix+s.slice(o.length);return u;}catch(e){return u;}}try{var sf=navigator&&navigator.sendBeacon;if(sf)navigator.sendBeacon=function(u,d){return sf.call(this,fixu(u),d);};}catch(e){}try{var of=window.fetch;if(of)window.fetch=function(i,o){try{if(typeof i==='string')i=fixu(i);else if(i&&i.url&&typeof Request==='function'){var fu=fixu(i.url);if(fu!==i.url)i=new Request(fu,i);}}catch(e){}return of.call(this,i,o);};}catch(e){}try{var xo=XMLHttpRequest&&XMLHttpRequest.prototype&&XMLHttpRequest.prototype.open;if(xo)XMLHttpRequest.prototype.open=function(m,u){arguments[1]=fixu(u);return xo.apply(this,arguments);};}catch(e){}}catch(e){}})();</script>`;
}

function buildSessionHostFullTextProxyScript(proxyHostname, originHost, hosts) {
  const safeProxyHost = JSON.stringify(proxyHostname).replace(/<\/script/gi, '<\\/script');
  const safeOriginHost = JSON.stringify(originHost).replace(/<\/script/gi, '<\\/script');
  const safeHosts = JSON.stringify(hosts).replace(/<\/script/gi, '<\\/script');
  return `<script>(function(){try{if(window.__raFullTextProxyV1)return;Object.defineProperty(window,'__raFullTextProxyV1',{value:1});var proxyHost=${safeProxyHost};var originHost=${safeOriginHost};var hosts=${safeHosts};var allowed={};var wild=[];for(var i=0;i<hosts.length;i++){var hh=hosts[i];if(String(hh).indexOf('*.')===0)wild.push(String(hh).slice(2));else allowed[hh]=1;}function ok(h){if(allowed[h])return true;for(var i=0;i<wild.length;i++){if(h.length>wild[i].length&&h.slice(-(wild[i].length+1))==='.'+wild[i])return true;}return false;}function enc(h){h=String(h||'').toLowerCase();var o='';for(var i=0;i<h.length;i++){var c=h.charAt(i);o+=c==='.'?'-':(c==='-'?'--':c);}return o;}function proxify(raw){try{if(!raw||/^(#|mailto:|tel:|javascript:)/i.test(raw))return raw;var s=String(raw);for(var ah in allowed){if(s===ah||s.indexOf(ah+'/')===0||s.indexOf(ah+'?')===0||s.indexOf(ah+'#')===0){s='https://'+s;break;}}var u=new URL(s,location.href);var h=u.hostname.toLowerCase();if(h===proxyHost||!ok(h))return raw;var p=u.pathname||'/';return location.origin+(h===originHost?p:('/__ra-host/'+enc(h)+p))+u.search+u.hash;}catch(e){return raw;}}function fix(a){try{if(!a||!a.getAttribute)return;var h=a.getAttribute('href')||a.href||'';var n=proxify(h);if(n&&n!==h)a.setAttribute('href',n);['data-href','data-url','data-target','data-link','data-fulltext-url','data-gateway-url'].forEach(function(k){var v=a.getAttribute(k);var nv=proxify(v);if(nv&&nv!==v)a.setAttribute(k,nv);});}catch(e){}}function scan(){try{document.querySelectorAll('a[href],a.full-record-links,.full-record-links a,[data-pendo*="GetFTR"],[id^="FRLinkTa-link"]').forEach(fix);}catch(e){}}document.addEventListener('click',function(e){try{var a=e.target&&e.target.closest&&e.target.closest('a[href],a.full-record-links,.full-record-links a,[data-pendo*="GetFTR"],[id^="FRLinkTa-link"]');if(!a)return;fix(a);var h=a.getAttribute('href')||'';var n=proxify(h);if(n&&n!==h){e.preventDefault();var tg=a.getAttribute('target')||'';if(tg&&tg.toLowerCase()!=='_self'&&window.open)window.open(n,tg);else location.href=n;}}catch(x){}},true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();var count=0;var id=setInterval(function(){scan();if(++count>80)clearInterval(id);},250);try{new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','data-href','data-url','data-target','data-link','data-fulltext-url','data-gateway-url']});}catch(e){}}catch(e){}})();</script>`;
}

function buildSessionHostFullTextProxyRuntime(proxyHostname, originHost, hosts) {
  return buildSessionHostFullTextProxyScript(proxyHostname, originHost, hosts)
    .replace(/^<script>/, '')
    .replace(/<\/script>$/, '');
}

export function injectSessionHostFullTextProxyRuntime(text, proxyHostname, originHost, proxyableHosts) {
  const js = String(text || '');
  if (js.includes('__raFullTextProxyV1')) return js;
  const hosts = proxyableHostPatterns(proxyableHosts);
  if (!hosts.length) return js;
  return `${buildSessionHostFullTextProxyRuntime(proxyHostname, originHost, hosts)}\n${js}`;
}

function hardenSessionHostLinkProxyScript(script) {
  const baseSelector = 'a[href],area[href],form[action],[data-href],[data-url],[data-link],[data-target],[data-destination]';
  const extendedSelector = `${baseSelector},[data-fulltext-url],[data-full-text-url],[data-full-text-link],[data-link-url],[data-gateway-url],[data-external-url],[data-resolved-url],[data-redirect-url],[data-target-url]`;
  const clickBaseSelector = 'a[href],area[href],[data-href],[data-url],[data-link],[data-target],[data-destination]';
  const clickExtendedSelector = `${clickBaseSelector},[data-fulltext-url],[data-full-text-url],[data-full-text-link],[data-link-url],[data-gateway-url],[data-external-url],[data-resolved-url],[data-redirect-url],[data-target-url]`;
  return String(script || '')
    .replace(
      "var attrs=['href','action','data-href','data-url','data-link','data-target','data-destination'];function enc",
      "var attrs=['href','action','data-href','data-url','data-link','data-target','data-destination','data-fulltext-url','data-full-text-url','data-full-text-link','data-link-url','data-gateway-url','data-external-url','data-resolved-url','data-redirect-url','data-target-url'];var navattrs=['href','data-href','data-url','data-link','data-destination'];function enc"
    )
    .replaceAll(baseSelector, extendedSelector)
    .replaceAll(clickBaseSelector, clickExtendedSelector)
    .replace(
      "var u=new URL(raw,location.href);var h=u.hostname.toLowerCase();",
      "var s=String(raw);for(var ah in allowed){if(s===ah||s.indexOf(ah+'/')===0||s.indexOf(ah+'?')===0||s.indexOf(ah+'#')===0){s='https://'+s;break;}}var u=new URL(s,location.href);var h=u.hostname.toLowerCase();"
    )
    .replace(
      "function fixel(el){",
      "function navval(el){try{for(var i=0;i<navattrs.length;i++){var v=el.getAttribute(navattrs[i]);if(v)return v;}}catch(e){}return '';}function fixel(el){"
    )
    .replace(
      "try{var ow=window.open;",
      "try{var sa=Element&&Element.prototype&&Element.prototype.setAttribute;if(sa)Element.prototype.setAttribute=function(n,v){try{var ln=String(n||'').toLowerCase();if(ln==='href'||ln==='src'||ln==='action'||ln.indexOf('url')>=0||ln.indexOf('link')>=0||ln.indexOf('target')>=0||ln.indexOf('destination')>=0){var nv=proxify(v);if(nv&&nv!==v)v=nv;}}catch(e){}return sa.call(this,n,v);};var ap=HTMLAnchorElement&&HTMLAnchorElement.prototype;var hd=ap&&Object.getOwnPropertyDescriptor(ap,'href');if(ap&&hd&&hd.set&&hd.get)Object.defineProperty(ap,'href',{configurable:true,get:function(){return hd.get.call(this);},set:function(v){var nv=proxify(v);return hd.set.call(this,nv||v);}});}catch(e){}try{var ow=window.open;"
    )
    .replace(
      "for(var i=0;i<attrs.length;i++){var a=attrs[i];var v=el.getAttribute(a);var n=proxify(v);if(n&&n!==v)el.setAttribute(a,n);}",
      "for(var i=0;i<attrs.length;i++){var a=attrs[i];var v=el.getAttribute(a);var n=proxify(v);if(n&&n!==v)el.setAttribute(a,n);}try{var all=el.attributes||[];for(var j=0;j<all.length;j++){var at=all[j];if(!at||!at.name||!at.value)continue;if(attrs.indexOf(at.name)>=0)continue;var nn=proxify(at.value);if(nn&&nn!==at.value)el.setAttribute(at.name,nn);}}catch(e){}"
    )
    .replace(
      `document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('${clickExtendedSelector}');if(!a)return;var before=a.getAttribute('href')||a.getAttribute('data-href')||a.getAttribute('data-url')||a.getAttribute('data-link')||a.getAttribute('data-target')||a.getAttribute('data-destination');fixel(a);var after=a.getAttribute('href')||a.getAttribute('data-href')||a.getAttribute('data-url')||a.getAttribute('data-link')||a.getAttribute('data-target')||a.getAttribute('data-destination');if(after&&after!==before&&!/^(a|area)$/i.test(a.tagName||'')){e.preventDefault();location.href=after;}},true);`,
      `document.addEventListener('click',function(e){var t=e.target;if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable=\"\"],[contenteditable=\"true\"]'))return;var a=t&&t.closest&&t.closest('${clickExtendedSelector}');if(!a)return;var before=navval(a);var direct=proxify(before);fixel(a);var after=navval(a);var dest=(direct&&direct!==before)?direct:after;if(dest&&dest!==before){e.preventDefault();if(/^(a|area)$/i.test(a.tagName||'')){var tg=a.getAttribute('target')||'';if(tg&&tg.toLowerCase()!=='_self'&&window.open)window.open(dest,tg);else location.href=dest;}else location.href=dest;}},true);`
    )
    .replace(
      "document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.getAttribute)return;fixel(f);},true);",
      "document.addEventListener('click',function(e){try{var t=e.target;if(!t||!t.closest)return;var b=t.closest('.full-text-button,.viewPreprint,.mat-mdc-menu-trigger,[aria-haspopup=\"menu\"]');if(!b)return;[0,25,100,300].forEach(function(ms){setTimeout(function(){scan(document);},ms);});}catch(x){}},true);document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.getAttribute)return;fixel(f);},true);"
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
  return String(text || '')
    .replace(
      /\b(?:(?:window|self|document)\.)?location\.(hostname|host|origin|protocol|pathname|search|hash)\b/g,
      (_match, prop) => `window.__raPublisherLocation.${prop}`
    )
    .replace(
      /\b(?:(?:window|self|document)\.)?location\.href\b(?!\s*(?:[+\-*/%]?=))/g,
      'window.__raPublisherLocation.href'
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
    if (host === 'verify.nature.com') continue;
    const isMainScope = host === scopeHost || host === `www.${scopeHost}`;
    // Subdomains (e.g. verify.nature.com) need the /__ra-host/ prefix so that
    // JS that constructs URLs from a bare hostname string routes correctly.
    const replacement = isMainScope
      ? proxyHostname
      : `${proxyHostname}${SESSION_ALT_HOST_PREFIX}${encodeHost(host)}`;
    out = replaceQuotedHost(out, host, replacement);
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

function injectWileyConsentHide(text) {
  const html = String(text || '');
  if (html.includes('__raWileyConsentHide')) return html;
  // Osano (cookielaw) banner JS bloklanmış → X tuşu çalışmıyor. CSS ile gizle.
  // Aynı zamanda Osano consent cookie'sini set ederek banner'ı suskunlaştır.
  const style = `<style id="__raWileyConsentHide">.osano-cm-window,#osano-cm-window,.osano-cm-dialog,.osano-cm-info,.osano-cm-info-dialog,.cmplz-cookiebanner,#cookielaw-banner,#onetrust-banner-sdk,#onetrust-consent-sdk{display:none!important;visibility:hidden!important;pointer-events:none!important}html,body{overflow:auto!important}</style>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b([^>]*)>/i, `<head$1>${style}`);
  return `${style}${html}`;
}

function injectWileyBackForwardReload(text) {
  const html = String(text || '');
  if (html.includes('__raWileyBackForwardReload')) return html;
  // Wiley pages often restore from bfcache with a half-running JS state behind
  // the proxy. Force a single fresh load on browser back/forward restore.
  const script = `<script id="__raWileyBackForwardReload">(function(){try{if(window.__raWileyBackForwardReload)return;Object.defineProperty(window,'__raWileyBackForwardReload',{value:1});function shouldReload(e){try{if(e&&e.persisted)return true;var n=performance&&performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];return !!(n&&n.type==='back_forward');}catch(_){return false;}}window.addEventListener('pageshow',function(e){try{if(!shouldReload(e))return;var k='__ra_wiley_bf_reload__'+location.href;var now=Date.now();var last=Number(sessionStorage.getItem(k)||0);if(now-last<5000)return;sessionStorage.setItem(k,String(now));location.reload();}catch(_){location.reload();}},true);}catch(_){}})();</script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  return `${script}${html}`;
}

const WILEY_BLOCKED_SCRIPT_SRC_RE = /(?:assets\.adobedtm\.com|googletagmanager\.com|google-analytics\.com|googleadservices\.com|googlesyndication\.com|doubleclick\.net|connect\.facebook\.net|facebook\.com\/tr|static\.ads-twitter\.com|analytics\.twitter\.com|snap\.licdn\.com|px\.ads\.linkedin\.com|bat\.bing\.com|clarity\.ms|hm\.baidu\.com|rum-static\.pingdom\.net|pub\.doubleverify\.com|vtrk\.dv\.tech|cmp\.osano\.com|content\.wiley\.com\/analytics|beacon\.riskified\.com|img\.riskified\.com|servedbydoceree\.doceree\.com)/i;

function stripWileyThirdPartyScripts(text) {
  let html = String(text || '');
  if (!html || !/\btext|<html|<script/i.test(html)) return html;
  let removed = 0;
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (match, _before, _quote, src) => {
    if (!WILEY_BLOCKED_SCRIPT_SRC_RE.test(src)) return match;
    removed++;
    return `<!-- ra-wiley-script-diet: ${escapeHtmlComment(src)} -->`;
  });
  if (html.includes('__raWileyScriptDiet')) return html;
  const stub = `<script id="__raWileyScriptDiet">(function(){try{Object.defineProperty(window,'__raWileyScriptDiet',{value:1});window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments)};window.googletag=window.googletag||{cmd:[],pubads:function(){return this},setConfig:function(){},defineSlot:function(){return {addService:function(){return this},setTargeting:function(){return this},setConfig:function(){return this}}},enableServices:function(){},display:function(){}};window.fbq=window.fbq||function(){};window.twq=window.twq||function(){};window.uetq=window.uetq||[];window.clarity=window.clarity||function(){};window._satellite=window._satellite||{track:function(){},pageBottom:function(){},getVar:function(){},setCookie:function(){},readCookie:function(){return''},cookie:{get:function(){return''},set:function(){}}};window.__uspapi=window.__uspapi||function(cmd,ver,cb){try{cb&&cb({uspString:'1---'},true)}catch(e){}};}catch(e){}})();</script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b([^>]*)>/i, `<head$1>${stub}`);
  return `${stub}${html}`;
}

function escapeHtmlComment(value) {
  return String(value || '').replace(/--/g, '- -').slice(0, 180);
}

function injectScopusAnalyticsStub(text) {
  const html = String(text || '');
  if (html.includes('__raScopusAnalyticsStub')) return html;
  // _satellite (Adobe Launch) may be blocked by tracking prevention; stub known methods.
  // Simple stub — no Proxy, no DDM (Scopus needs DDM undefined to detect and load it).
  const script = `<script>(function(){try{Object.defineProperty(window,'__raScopusAnalyticsStub',{value:1});var n=function(){};if(typeof window._satellite==='undefined'){window._satellite={track:n,notify:n,pageBottom:n,setVar:n,getVar:n,_runScript:n,_runScript1:n,_runScript2:n,_runScript3:n,buildInfo:{}};}}catch(e){}})()</script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  if (/<script\b/i.test(html)) return html.replace(/<script\b/i, `${script}<script`);
  return `${script}${html}`;
}

function patchScopusNextData(text, originHost, proxyHostname) {
  // Patch bare hostname occurrences inside __NEXT_DATA__ JSON so React hydration
  // sees proxy URLs (not www.scopus.com), preventing duplicate header/footer renders.
  // rewriteSessionTextProxyUrls handles "https://..." patterns but misses bare
  // hostnames embedded in JSON values like "host":"www.scopus.com".
  return String(text || '').replace(
    /(<script\b[^>]*\bid\s*=\s*["']__NEXT_DATA__["'][^>]*>)([\s\S]*?)(<\/script>)/i,
    (_, open, json, close) => `${open}${json.replaceAll(originHost, proxyHostname)}${close}`
  );
}

export function relaxProxyMetaContentSecurityPolicy(text) {
  return String(text || '').replace(
    /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?content-security-policy["']?)[^>]*>/gi,
    ''
  );
}

function injectCloudflareChallengeCookieNamespaceScript(text, scopeHost) {
  if (scopeHost !== 'oup.com') return String(text || '');
  const html = String(text || '');
  if (html.includes('__raCfChallengeCookieNamespace')) return html;

  const safeScope = JSON.stringify(scopeHost).replace(/<\/script/gi, '<\\/script');
  const script = `<script>(function(){try{if(window.__raCfChallengeCookieNamespace)return;Object.defineProperty(window,'__raCfChallengeCookieNamespace',{value:1});var scope=${safeScope};var prefix='__cp_'+scope+'|';var names={cf_clearance:1,__cf_bm:1};function scoped(n){return names[n]||String(n||'').toLowerCase().indexOf('cf_chl_')===0;}var d=Object.getOwnPropertyDescriptor(Document.prototype,'cookie')||Object.getOwnPropertyDescriptor(HTMLDocument.prototype,'cookie');if(!d||!d.get||!d.set)return;Object.defineProperty(document,'cookie',{configurable:true,get:function(){var raw=d.get.call(document)||'';var out=[];raw.split(/;\\s*/).filter(Boolean).forEach(function(p){var i=p.indexOf('=');if(i<1){out.push(p);return;}var n=p.slice(0,i);if(n.indexOf(prefix)===0){var clean=n.slice(prefix.length);out.push(clean+p.slice(i));return;}if(scoped(n))return;out.push(p);});return out.join('; ');},set:function(v){var s=String(v||'');var semi=s.indexOf(';');var end=semi<0?s.length:semi;var eq=s.indexOf('=');if(eq>0&&eq<end){var n=s.slice(0,eq).trim();if(scoped(n)&&n.indexOf(prefix)!==0){s=prefix+n+s.slice(eq);s=s.replace(/;\\s*domain=[^;]*/ig,'');}}return d.set.call(document,s);}});}catch(e){}})();</script>`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  }
  if (/<script\b/i.test(html)) {
    return html.replace(/<script\b/i, `${script}<script`);
  }
  return `${script}${html}`;
}

function clearRawPublisherClearanceCookies(headers, scopeHost, domain) {
  if (scopeHost !== 'oup.com' && scopeHost !== 'sciencedirect.com') return;
  const expiry = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; Secure';
  headers.append('Set-Cookie', `cf_clearance=; ${expiry}; SameSite=Lax`);
  headers.append('Set-Cookie', `cf_clearance=; ${expiry}; SameSite=None`);
  headers.append('Set-Cookie', `cf_clearance=; ${expiry}; SameSite=None; Partitioned`);
  if (domain) {
    const clean = String(domain || '').replace(/^\.+/, '');
    headers.append('Set-Cookie', `cf_clearance=; Domain=${clean}; ${expiry}; SameSite=Lax`);
    headers.append('Set-Cookie', `cf_clearance=; Domain=${clean}; ${expiry}; SameSite=None`);
    headers.append('Set-Cookie', `cf_clearance=; Domain=${clean}; ${expiry}; SameSite=None; Partitioned`);
    headers.append('Set-Cookie', `cf_clearance=; Domain=.${clean}; ${expiry}; SameSite=Lax`);
    headers.append('Set-Cookie', `cf_clearance=; Domain=.${clean}; ${expiry}; SameSite=None`);
    headers.append('Set-Cookie', `cf_clearance=; Domain=.${clean}; ${expiry}; SameSite=None; Partitioned`);
  }
}

function shouldInjectRaLinkAuditScript(session, contentType) {
  return isAdminAuditSession(session) && /\btext\/html\b/i.test(contentType || '');
}

function injectRaLinkAuditScript(text, session) {
  const html = String(text || '');
  if (!isAdminAuditSession(session) || html.includes('__raLinkAudit')) return html;

  const script = `<script>(function(){try{if(window.__raLinkAudit)return;Object.defineProperty(window,'__raLinkAudit',{value:1});var endpoint='${LINK_AUDIT_PATH}';var attrs=['href','src','action','data-href','data-url','data-link','data-target','data-destination','data-fulltext-url','data-full-text-url','data-link-url','data-gateway-url','data-external-url','data-resolved-url','data-redirect-url','data-target-url'];var selector='a[href],area[href],form[action],iframe[src],frame[src],script[src],link[href],[data-href],[data-url],[data-link],[data-target],[data-destination],[data-fulltext-url],[data-full-text-url],[data-link-url],[data-gateway-url],[data-external-url],[data-resolved-url],[data-redirect-url],[data-target-url]';var seen={};var queue=[];function norm(v){try{if(!v)return null;var s=String(v).trim();if(!s||/^(javascript|mailto|tel|data|blob):/i.test(s))return null;var u=new URL(s,location.href);if(!/^https?:$/.test(u.protocol))return null;if(u.hostname===location.hostname)return null;return u.href;}catch(e){return null;}}function add(el,a,v){var u=norm(v);if(!u)return;var key=(el.tagName||'').toLowerCase()+'|'+a+'|'+u;if(seen[key])return;seen[key]=1;queue.push({element:(el.tagName||'').toLowerCase(),attr:a,url:u,text:(el.textContent||el.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().slice(0,120)});}function scan(root){try{var nodes=(root&&root.querySelectorAll)?root.querySelectorAll(selector):[];for(var i=0;i<nodes.length&&queue.length<120;i++){var el=nodes[i];for(var j=0;j<attrs.length;j++){var a=attrs[j];var v=el.getAttribute&&el.getAttribute(a);if(v)add(el,a,v);}}flushSoon();}catch(e){}}var timer=0;function flushSoon(){if(timer)return;timer=setTimeout(flush,700);}function flush(){timer=0;if(!queue.length)return;var items=queue.splice(0,80);var body=JSON.stringify({source_url:location.href,source_host:location.hostname,source_path:location.pathname+location.search,items:items});try{if(navigator.sendBeacon){navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'}));return;}}catch(e){}try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true,cache:'no-store'});}catch(e){}}setTimeout(function(){scan(document);},250);setTimeout(function(){scan(document);},1800);try{var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var n=muts[i].target;if(n&&n.nodeType===1)scan(n);}});mo.observe(document.documentElement||document,{childList:true,subtree:true,attributes:true,attributeFilter:attrs});}catch(e){}document.addEventListener('click',function(e){try{var t=e.target&&e.target.closest&&e.target.closest(selector);if(t){scan(t.parentNode||document);flush();}}catch(x){}},true);}catch(e){}})();</script>`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  }
  if (/<script\b/i.test(html)) {
    return html.replace(/<script\b/i, `${script}<script`);
  }
  return `${script}${html}`;
}

export function injectPublisherCookieNamespaceScript(text, scopeHost, originHost = '', debugEnabled = false) {
  const html = String(text || '');
  if (!scopeHost || html.includes('__raPublisherCookieNamespace')) return html;

  const script = buildPublisherCookieNamespaceScript(scopeHost, originHost, debugEnabled);
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  }
  if (/<script\b/i.test(html)) {
    return html.replace(/<script\b/i, `${script}<script`);
  }
  return `${script}${html}`;
}

function buildPublisherCookieNamespaceScript(scopeHost, originHost = '', debugEnabled = false) {
  const safeScope = JSON.stringify(String(scopeHost || '').toLowerCase()).replace(/<\/script/gi, '<\\/script');
  const safeOriginHost = JSON.stringify(normalizeHost(originHost) || String(originHost || '').toLowerCase()).replace(/<\/script/gi, '<\\/script');
  const debugScript = debugEnabled
    ? `var dbg=function(k,m){try{var b=JSON.stringify({kind:k,message:String(m||'').slice(0,300),path:location.pathname});if(navigator.sendBeacon)navigator.sendBeacon('${CLIENT_DEBUG_PATH}',new Blob([b],{type:'application/json'}));else fetch('${CLIENT_DEBUG_PATH}',{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true});}catch(e){}};var dbgurl=function(k,u){u=String(u||'');if(/cdn-cgi|challenge|chl_/i.test(u))dbg(k,u);};window.addEventListener('error',function(e){dbg('error',(e.message||'')+' '+(e.filename||'')+':'+(e.lineno||''));});window.addEventListener('unhandledrejection',function(e){dbg('unhandledrejection',e.reason&&e.reason.message?e.reason.message:e.reason);});setTimeout(function(){try{dbg('ready','publisher-cookie-shim path='+location.pathname+location.search+' cookies='+(document.cookie||'').split(/;\\s*/).map(function(p){return p.split('=')[0];}).filter(Boolean).join(','));}catch(e){dbg('ready','publisher-cookie-shim');}},0);`
    : `var dbg=function(){};var dbgurl=function(){};`;
  return `<script>(function(){try{var scope=${safeScope};var originHost=${safeOriginHost}||('www.'+scope);var origin='https://'+originHost;${debugScript}var fixu=function(u){try{if(typeof u==='string'){var raw=u;var s=raw.replace(/^\\/cdn-cgi\\//,'${CF_CHALLENGE_PROXY_PREFIX}').replace(location.origin+'/cdn-cgi/',location.origin+'${CF_CHALLENGE_PROXY_PREFIX}');return s;}return u;}catch(e){return u;}};var isSdApi=function(u){try{var x=new URL(String(u&&u.url?u.url:u),location.href);return x.origin===location.origin&&x.pathname==='/search/api';}catch(e){return false;}};try{var of=window.fetch;if(of)window.fetch=function(i,o){dbgurl('fetch',typeof i==='string'?i:(i&&i.url));if(typeof i==='string'){i=fixu(i);if(isSdApi(i))o=Object.assign({},o||{},{credentials:'include'});}else if(i&&i.url&&typeof Request==='function'){var fu=fixu(i.url);if(fu!==i.url)i=new Request(fu,i);if(isSdApi(i))i=new Request(i,{credentials:'include'});}return of.call(this,i,o);};var xo=XMLHttpRequest&&XMLHttpRequest.prototype&&XMLHttpRequest.prototype.open;if(xo)XMLHttpRequest.prototype.open=function(m,u){dbgurl('xhr',u);arguments[1]=fixu(u);if(isSdApi(arguments[1]))this.withCredentials=true;return xo.apply(this,arguments);};var ap=Node&&Node.prototype&&Node.prototype.appendChild;if(ap)Node.prototype.appendChild=function(n){try{dbgurl('append',(n&&(n.src||n.href||n.action))||'');}catch(e){}return ap.apply(this,arguments);};var ib=Node&&Node.prototype&&Node.prototype.insertBefore;if(ib)Node.prototype.insertBefore=function(n,r){try{dbgurl('insert',(n&&(n.src||n.href||n.action))||'');}catch(e){}return ib.apply(this,arguments);};}catch(e){}window.__raPublisherLocation={protocol:'https:',hostname:originHost,host:originHost,origin:origin,get pathname(){return location.pathname;},get search(){return location.search;},get hash(){return location.hash;},get href(){return origin+location.pathname+location.search+location.hash;}};var prefix='__cp_'+scope+'|';var names={cf_clearance:1,__cf_bm:1,EMER_SessionId:1,OptanonConsent:1,OptanonAlertBoxClosed:1};var consent={OptanonConsent:1,OptanonAlertBoxClosed:1};var lskey=function(n){return'__ra_'+scope+'_'+n;};var remember=function(n,v){try{if(consent[n])localStorage.setItem(lskey(n),v);}catch(e){}};var recall=function(parts,seen){try{for(var n in consent){if(!seen[n]){var v=localStorage.getItem(lskey(n));if(v){seen[n]=1;parts.push(n+'='+v);}}}}catch(e){}return parts;};var domains={};domains[scope]=1;domains['.'+scope]=1;domains[originHost]=1;domains['.'+originHost]=1;var d=Object.getOwnPropertyDescriptor(Document.prototype,'cookie')||Object.getOwnPropertyDescriptor(HTMLDocument.prototype,'cookie');if(!d||!d.get||!d.set||window.__raPublisherCookieNamespace)return;Object.defineProperty(window,'__raPublisherCookieNamespace',{value:1});Object.defineProperty(document,'cookie',{configurable:true,get:function(){var raw=d.get.call(document)||'';var scoped={};var seen={};var parts=raw.split(/;\\s*/).filter(Boolean).map(function(p){var i=p.indexOf('=');if(i<1)return p;var n=p.slice(0,i);if(n.indexOf(prefix)===0){var clean=n.slice(prefix.length);scoped[clean]=1;seen[clean]=1;return clean+p.slice(i);}seen[n]=1;return p;}).filter(function(p){var i=p.indexOf('=');if(i<1)return true;var n=p.slice(0,i);if(scoped[n])return false;return true;});return recall(parts,seen).join('; ');},set:function(v){var s=String(v||'');var semi=s.indexOf(';');var end=semi<0?s.length:semi;var eq=s.indexOf('=');if(eq>0&&eq<end){var n=s.slice(0,eq).trim();var val=s.slice(eq+1,end);if(consent[n])remember(n,val);var dm=/;\\s*domain=([^;]*)/i.exec(s);var cd=dm?String(dm[1]||'').trim().toLowerCase():'';var publisherDomain=!!(cd&&domains[cd]);var shouldScope=!!(publisherDomain||names[n]);if(shouldScope||n.indexOf('cf_chl_')===0)dbg('cookie-set',n);if(shouldScope&&n.indexOf(prefix)!==0){s=prefix+n+s.slice(eq);}if(shouldScope||publisherDomain){s=s.replace(/;\\s*domain=[^;]*/ig,'');}}return d.set.call(document,s);}});if(scope==='scopus.com'){try{var nd=document.getElementById('__NEXT_DATA__');if(nd&&nd.textContent){var ph=location.hostname;var oh=originHost||('www.'+scope);var raw=nd.textContent;var patched=raw.split(oh).join(ph);if(patched!==raw){nd.textContent=patched;dbg('patched-next-data',oh+'->'+ph);}}}catch(e){dbg('patch-err',e&&e.message);}var fixFetch=window.fetch;if(fixFetch)window.fetch=function(u,o){if(typeof u==='string'&&u.indexOf(originHost)>=0){u=u.replace(new RegExp('https?:\\/\\/'+originHost.replace(/\./g,'\\.'),'g'),'https://'+location.hostname);}return fixFetch.call(this,u,o);};var fixXHR=XMLHttpRequest&&XMLHttpRequest.prototype&&XMLHttpRequest.prototype.open;if(fixXHR)XMLHttpRequest.prototype.open=function(m,u){if(typeof u==='string'&&u.indexOf(originHost)>=0){u=u.replace(new RegExp('https?:\\/\\/'+originHost.replace(/\./g,'\\.'),'g'),'https://'+location.hostname);}return fixXHR.apply(this,arguments);};}if(scope==='sciencedirect.com'){var dropRaw=function(){try{var raw=d.get.call(document)||'';if(raw.indexOf('cf_clearance=')<0)return;var exp='=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/; secure; samesite=lax';var host=location.hostname;var base=host.split('.').slice(-2).join('.');d.set.call(document,'cf_clearance'+exp);d.set.call(document,'cf_clearance'+exp+'; domain='+host);if(base)d.set.call(document,'cf_clearance'+exp+'; domain='+base);if(base)d.set.call(document,'cf_clearance'+exp+'; domain=.'+base);dbg('drop-raw-cf-clearance',host);}catch(e){}};dropRaw();setInterval(dropRaw,250);}var hideOt=function(){try{['onetrust-banner-sdk','onetrust-consent-sdk','onetrust-pc-sdk'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});document.querySelectorAll('.onetrust-pc-dark-filter,.ot-sdk-container,.ot-sdk-row').forEach(function(el){if(el&&/onetrust|ot-/i.test(el.className||''))el.style.display='none';});}catch(e){}};var setOt=function(reject){try{var stamp=(new Date()).toISOString();var groups=reject?'C0001:1,C0002:0,C0003:0,C0004:0':'C0001:1,C0002:1,C0003:1,C0004:1';document.cookie='OptanonAlertBoxClosed='+encodeURIComponent(stamp)+'; path=/; max-age=31536000';document.cookie='OptanonConsent='+encodeURIComponent('groups='+groups+'&isGpcEnabled=0&datestamp='+stamp)+'; path=/; max-age=31536000';hideOt();}catch(e){}};document.addEventListener('click',function(e){try{var t=e.target&&e.target.closest&&e.target.closest('#onetrust-accept-btn-handler,#accept-recommended-btn-handler,#onetrust-reject-all-handler,.ot-pc-refuse-all-handler,.save-preference-btn-handler');if(!t)return;var id=((t.id||'')+' '+(t.className||'')).toLowerCase();setOt(/reject|refuse/.test(id));e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();}catch(x){}},true);setTimeout(function(){if((document.cookie||'').indexOf('OptanonAlertBoxClosed=')>=0)hideOt();},0);}catch(e){}})();</script>`;
}

// path_proxy cross-domain kontrolü için — ürünün ra_host_allowlist_json'unu yükler.
// OIDC, federated SSO gibi multi-origin akışlarda aynı oturum farklı hostlara
// yönlenebilir; bunların allowlist'te olması gerekir.
async function loadProductAllowedHosts(db, productSlug, originHost) {
  const hosts = new HostAllowlist([originHost]);
  const product = await db
    .prepare('SELECT ra_host_allowlist_json FROM products WHERE slug = ?')
    .bind(productSlug)
    .first();
  if (product && product.ra_host_allowlist_json) {
    try {
      const list = JSON.parse(product.ra_host_allowlist_json);
      if (Array.isArray(list)) {
        for (const h of list) {
          hosts.add(h);
        }
      }
    } catch {
      // Bozuk JSON — sadece origin ile devam et
    }
  }
  return hosts;
}

async function loadSessionProxyableHosts(envOrDb, session, sessionId = '') {
  const db = envOrDb?.DB || envOrDb;
  const hosts = new HostAllowlist([session.origin_host]);
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
          hosts.add(rawHost);
        }
      }
    } catch {
      // Malformed admin config: keep origin-only rather than failing all access.
    }
  }
  if (shouldLoadDynamicSessionProxyHosts(session)) {
    for (const host of await loadDynamicSessionProxyHosts(envOrDb, sessionId)) {
      hosts.add(host);
    }
  }
  // Publisher hosts for WoS full-text linking are loaded lazily in
  // proxySessionSurface only for GetFTR/gateway requests (see below).
  // Do NOT load them here — scanning large JS bundles for hundreds of hosts causes 503.
  return hosts;
}

function shouldLoadDynamicSessionProxyHosts(session = {}) {
  return session.product_slug === 'web-of-science' ||
    session.product_slug === 'sciencedirect';
}

const _wosPublisherHostsCache = new Map(); // institutionId → { hosts, expiresAt }

async function loadWosPublisherHosts(db, institutionId) {
  const now = Date.now();
  const cached = _wosPublisherHostsCache.get(institutionId);
  if (cached && cached.expiresAt > now) return cached.hosts;

  const subs = await db.prepare(
    `SELECT p.ra_origin_host, p.ra_host_allowlist_json
     FROM institution_subscriptions s
     JOIN products p ON s.product_slug = p.slug
     WHERE s.institution_id = ? AND (s.status IS NULL OR s.status = 'active') AND p.ra_enabled = 1`
  ).bind(institutionId).all();

  const hosts = [];
  for (const sub of (subs.results || [])) {
    if (sub.ra_origin_host) hosts.push(sub.ra_origin_host);
    if (sub.ra_host_allowlist_json) {
      try {
        const list = JSON.parse(sub.ra_host_allowlist_json);
        if (Array.isArray(list)) {
          for (const h of list) {
            if (!String(h).startsWith('*.')) hosts.push(h);
          }
        }
      } catch { /* malformed */ }
    }
  }
  _wosPublisherHostsCache.set(institutionId, { hosts, expiresAt: now + 30000 });
  return hosts;
}

async function loadDynamicSessionProxyHosts(envOrDb, sessionId) {
  if (!sessionId || !envOrDb?.RA_UPSTREAM_SESSIONS) return [];
  try {
    const parsed = await envOrDb.RA_UPSTREAM_SESSIONS.get(
      `${WOS_DYNAMIC_HOSTS_PREFIX}${sessionId}`,
      'json'
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHost).filter(Boolean);
  } catch {
    return [];
  }
}

async function persistDynamicSessionProxyHost(env, sessionId, host) {
  const normalized = normalizeHost(host);
  if (!normalized || !sessionId || !env?.RA_UPSTREAM_SESSIONS) return;
  const key = `${WOS_DYNAMIC_HOSTS_PREFIX}${sessionId}`;
  const existing = await loadDynamicSessionProxyHosts(env, sessionId);
  const hosts = new Set(existing);
  hosts.add(normalized);
  try {
    await env.RA_UPSTREAM_SESSIONS.put(
      key,
      JSON.stringify([...hosts].slice(-50)),
      { expirationTtl: SESSION_TTL_SEC }
    );
  } catch {
    // Dynamic publisher hosts only improve full-text redirect continuity.
  }
}

/**
 * loadProductWafBrowserFlag — returns true if the product has ra_waf_browser = 1.
 * Used to route CF Managed Challenge publishers (Emerald, OUP, Wiley, CAB) to
 * the ra-browser Playwright service instead of the Go HTTP client.
 *
 * @param {D1Database} db
 * @param {string} productSlug
 * @returns {Promise<boolean>}
 */
async function loadProductWafBrowserFlag(db, productSlug) {
  try {
    const row = await db
      .prepare('SELECT ra_waf_browser FROM products WHERE slug = ?')
      .bind(productSlug)
      .first();
    return row?.ra_waf_browser === 1;
  } catch {
    // Column may not exist yet (pre-migration). Fall through to egressFetch.
    return false;
  }
}

// 'scoped' (default) → mevcut __cp_<scope>|<name> prefix sistemi
// 'host' → per-session host izolasyonu (vetis-tarzı), prefix yok
async function loadProductCookieMode(db, productSlug) {
  try {
    const row = await db
      .prepare('SELECT ra_cookie_mode FROM products WHERE slug = ?')
      .bind(productSlug)
      .first();
    return row?.ra_cookie_mode === 'host' ? 'host' : 'scoped';
  } catch {
    return 'scoped';
  }
}

function normalizeHost(rawHost) {
  const host = String(rawHost || '').trim().toLowerCase();
  if (!host) return '';
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)
    ? host
    : '';
}

function normalizeHostPattern(rawHost) {
  let host = String(rawHost || '').trim().toLowerCase();
  if (!host) return '';
  host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (host.startsWith('*.')) {
    const suffix = normalizeHost(host.slice(2));
    return suffix ? `*.${suffix}` : '';
  }
  return normalizeHost(host);
}

class HostAllowlist extends Set {
  constructor(entries = []) {
    super();
    this.wildcardSuffixes = [];
    for (const entry of entries) this.add(entry);
  }

  add(rawHost) {
    const pattern = normalizeHostPattern(rawHost);
    if (!pattern) return this;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      if (!this.wildcardSuffixes.includes(suffix)) this.wildcardSuffixes.push(suffix);
      return this;
    }
    return super.add(pattern);
  }

  has(rawHost) {
    const host = normalizeHost(rawHost);
    if (!host) return false;
    if (super.has(host)) return true;
    return this.wildcardSuffixes.some((suffix) => host.endsWith(`.${suffix}`));
  }

  patterns() {
    return [...super.values(), ...this.wildcardSuffixes.map((suffix) => `*.${suffix}`)];
  }
}

function proxyableHostPatterns(proxyableHosts) {
  const raw = typeof proxyableHosts?.patterns === 'function'
    ? proxyableHosts.patterns()
    : [...(proxyableHosts || [])];
  return [...new Set(raw.map(normalizeHostPattern).filter(Boolean))];
}

function exactProxyableHosts(proxyableHosts) {
  return proxyableHostPatterns(proxyableHosts)
    .filter((host) => !host.startsWith('*.'))
    .map(normalizeHost)
    .filter(Boolean);
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

function readProxySessionCookie(header) {
  return readCookie(header, SESSION_COOKIE) || readCookie(header, COMPAT_SESSION_COOKIE);
}

function readAllowedUpstreamHostCookie(cookieHeader, proxyableHosts) {
  const host = normalizeHost(readCookie(cookieHeader, UPSTREAM_HOST_COOKIE));
  if (!host || !proxyableHosts.has(host)) return null;
  // Never-proxy host (analytics/teaser) cookie'de takıldıysa görmezden gel,
  // yoksa sonraki relative URL'ler yanlış hosta gidip 404 alır.
  if (isNeverProxyHost(host)) return null;
  return host;
}

function readRefererAltHost(referer, proxyHostname, proxyableHosts) {
  if (!referer || !proxyHostname) return null;
  try {
    const ref = new URL(referer);
    if (normalizeHost(ref.hostname) !== normalizeHost(proxyHostname)) return null;
    if (!ref.pathname.startsWith(SESSION_ALT_HOST_PREFIX)) return null;
    const rest = ref.pathname.slice(SESSION_ALT_HOST_PREFIX.length);
    const slashIdx = rest.indexOf('/');
    const encodedHost = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    if (!isValidEncodedHost(encodedHost)) return null;
    const host = decodeHost(encodedHost);
    return proxyableHosts.has(host) ? host : null;
  } catch {
    return null;
  }
}

function buildSessionCookie(sid, baseHost) {
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
    `Domain=${baseHost}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    `Max-Age=${SESSION_TTL_SEC}`
  );
}

function buildCompatSessionCookie(sid, baseHost) {
  return (
    `${COMPAT_SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
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

function isStagingEnv(env) {
  return String(env?.ENVIRONMENT || '').toLowerCase() === 'staging';
}

async function handleClientDebug(request, env, session, url) {
  if (!isStagingEnv(env) || request.method !== 'POST' || !env?.DB) {
    return new Response(null, { status: 204 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const kind = String(payload.kind || 'client').slice(0, 60);
  const message = String(payload.message || '').slice(0, 300);
  const path = String(payload.path || '').slice(0, 180);
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
        session?.product_slug || null,
        session?.institution_id || null,
        session?.origin_host || null,
        path || '[client]',
        CLIENT_DEBUG_PATH,
        truncateHeader(url.toString(), 500),
        null,
        `client:${kind}`,
        truncateHeader(message, 240),
        JSON.stringify(cookieNames(request.headers.get('Cookie')).sort()),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(clientHintHeaderNames(request.headers || new Headers())),
        JSON.stringify([]),
        truncateHeader(request.headers.get('Referer') || '', 500),
        null,
        truncateHeader(request.headers.get('User-Agent') || '', 240)
      )
      .run();
  } catch (err) {
    console.warn('ra client debug write failed', err);
  }

  return new Response(null, { status: 204 });
}

async function handleLinkAudit(request, env, session, url, sessionId) {
  if (request.method !== 'POST' || !env?.DB || !isAdminAuditSession(session)) {
    return new Response(null, { status: 204 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const items = Array.isArray(payload.items) ? payload.items.slice(0, 80) : [];
  if (!items.length) return new Response(null, { status: 204 });

  const originHost = sessionOriginHost(session);
  const allowlist = await loadProductAllowedHosts(env.DB, session.product_slug, originHost);
  const now = Math.floor(Date.now() / 1000);
  const sourceUrl = sanitizeAuditUrl(payload.source_url || request.headers.get('Referer') || '');
  const sourcePath = sanitizeAuditPath(payload.source_path || '');
  const sourceHost = normalizeHost(payload.source_host || url.hostname);

  try {
    await ensureRaLinkAuditSchema(env.DB);
    for (const item of items) {
      const found = parseAuditUrl(item?.url, url);
      if (!found) continue;
      const classification = classifyAuditUrl(found, url.hostname, allowlist);
      if (classification.kind === 'ok_proxy') continue;
      const element = String(item?.element || '').slice(0, 24).toLowerCase();
      const attr = String(item?.attr || '').slice(0, 40).toLowerCase();
      const foundUrl = sanitizeAuditUrl(found.toString());
      const foundHost = normalizeHost(found.hostname);
      const keyHash = simpleAuditHash([
        session.product_slug || '',
        sourceHost,
        sourcePath,
        foundHost,
        foundUrl,
        element,
        attr,
        classification.kind,
      ].join('|'));

      await env.DB.prepare(
        `INSERT INTO ra_link_audit_findings (
           key_hash, product_slug, institution_id, user_id, session_id,
           source_host, source_path, source_url,
           found_host, found_url, element, attr,
           classification, reason, sample_text, count, first_seen, last_seen
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(key_hash) DO UPDATE SET
           count = count + 1,
           last_seen = excluded.last_seen,
           sample_text = COALESCE(NULLIF(excluded.sample_text, ''), sample_text)`
      )
        .bind(
          keyHash,
          session.product_slug || null,
          session.institution_id || null,
          session.user_id || null,
          String(sessionId || '').slice(0, 80),
          sourceHost || null,
          sourcePath || null,
          sourceUrl || null,
          foundHost || null,
          foundUrl || null,
          element || null,
          attr || null,
          classification.kind,
          classification.reason,
          String(item?.text || '').replace(/\s+/g, ' ').trim().slice(0, 160) || null,
          now,
          now
        )
        .run();
    }
  } catch (err) {
    console.warn('ra link audit write failed', err);
  }

  return new Response(null, { status: 204 });
}

function isAdminAuditSession(session) {
  return Number(session?.subscription_id) === 0;
}

function sessionOriginHost(session = {}) {
  return normalizeHost(session.origin_host || session.target_host);
}

async function ensureRaLinkAuditSchema(db) {
  if (linkAuditSchemaEnsured) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ra_link_audit_findings (
      key_hash TEXT PRIMARY KEY,
      product_slug TEXT,
      institution_id INTEGER,
      user_id INTEGER,
      session_id TEXT,
      source_host TEXT,
      source_path TEXT,
      source_url TEXT,
      found_host TEXT,
      found_url TEXT,
      element TEXT,
      attr TEXT,
      classification TEXT NOT NULL,
      reason TEXT,
      sample_text TEXT,
      count INTEGER NOT NULL DEFAULT 1,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    )`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ra_link_audit_product_seen
       ON ra_link_audit_findings(product_slug, last_seen DESC)`
  ).run();
  linkAuditSchemaEnsured = true;
}

function parseAuditUrl(raw, requestUrl) {
  const value = String(raw || '').trim();
  if (!value || value.length > 2000) return null;
  if (/^(javascript|mailto|tel|data|blob):/i.test(value)) return null;
  try {
    const parsed = new URL(value, requestUrl.toString());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function classifyAuditUrl(foundUrl, proxyHostname, allowlist) {
  const foundHost = normalizeHost(foundUrl.hostname);
  const proxyHost = normalizeHost(proxyHostname);
  if (!foundHost) return { kind: 'invalid', reason: 'URL host parse edilemedi.' };
  if (foundHost === proxyHost) return { kind: 'ok_proxy', reason: 'Proxy hostu.' };
  if (foundHost.endsWith('.selmiye.com')) return { kind: 'ok_proxy', reason: 'RA proxy hostu.' };
  if (isAllowedExternalAuditHost(foundHost)) {
    return { kind: 'allowed_external', reason: 'Bilerek proxy dışı bırakılabilecek referans/identity linki.' };
  }
  if (allowlist?.has(foundHost)) {
    return { kind: 'rewrite_failed', reason: 'Host allowlist içinde ama sayfada doğrudan publisher URL olarak kalmış.' };
  }
  return { kind: 'missing_allowlist', reason: 'Host allowlist içinde değil; proxylenmesi gerekiyorsa ürün allowlist veya rewrite kuralı eklenmeli.' };
}

function isAllowedExternalAuditHost(host) {
  const h = normalizeHost(host);
  return h === 'doi.org' ||
    h === 'dx.doi.org' ||
    h === 'orcid.org' ||
    h === 'crossref.org' ||
    h === 'creativecommons.org' ||
    h === 'pubmed.ncbi.nlm.nih.gov' ||
    h === 'scholar.google.com';
}

function sanitizeAuditPath(raw) {
  const path = String(raw || '').trim();
  if (!path || !path.startsWith('/')) return '/';
  return path.replace(/[\r\n]/g, '').slice(0, 260);
}

function sanitizeAuditUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|session|parent|sid|jti|state|code|auth|accountid|t$/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    parsed.hash = '';
    return parsed.toString().slice(0, 700);
  } catch {
    return value.replace(/[\r\n]/g, '').slice(0, 700);
  }
}

function simpleAuditHash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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
    if (name === SESSION_COOKIE || name === COMPAT_SESSION_COOKIE || name === UPSTREAM_HOST_COOKIE) continue;
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

function ensureCookiePair(cookieHeader, name, value) {
  const wantedName = String(name || '').trim();
  if (!wantedName) return cookieHeader || '';
  const map = new Map();
  for (const pair of String(cookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const n = pair.slice(0, idx).trim();
    if (n) map.set(n, pair.slice(idx + 1).trim());
  }
  if (!map.has(wantedName)) map.set(wantedName, String(value || ''));
  return [...map.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
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
  ['cambridge.org', 'cambridge.org'],
  ['emerald.com', 'emerald.com'],
  ['nejm.org', 'nejm.org'],
  ['cabdirect.org', 'cabdirect.org'],
  ['acs.org', 'acs.org'],
  ['nature.com', 'nature.com'],
  ['proquest.com', 'proquest.com'],
  ['sciencedirect.com', 'sciencedirect.com'],
  ['scopus.com', 'scopus.com'],
  ['onlinelibrary.wiley.com', 'onlinelibrary.wiley.com'],
  ['wiley.com', 'wiley.com'],
  ['oup.com', 'oup.com'],
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

function isLikelyProxyToken(token) {
  const raw = String(token || '').trim();
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw);
}

export function rewritePublisherCookieHeaderForUpstream(cookieHeader, scopeHost, options = {}) {
  const scopedNames = new Set();
  const allowChallengeRuntime = !!options.allowCloudflareChallengeRuntimeCookies;
  for (const pair of String(cookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim();
    const prefixed = parsePublisherCookieName(name);
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
        if (scopeHost && isCloudflareChallengeRuntimeCookieName(prefixed.name) && !allowChallengeRuntime) continue;
        map.set(prefixed.name, value);
      }
      continue;
    }

    if (scopeHost && isCloudflareChallengeRuntimeCookieName(name) && !allowChallengeRuntime) continue;
    if (scopeHost && isPublisherTrackingCookieName(name)) continue;
    if (scopeHost && isPublisherScopedCookieName(name) && scopedNames.has(name.toLowerCase())) continue;
    if (scopeHost && isPublisherScopedCookieName(name) && !shouldAllowRawPublisherCookieFallback(name, scopeHost)) continue;
    if (!map.has(name)) map.set(name, value);
  }
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function ensurePublisherScopedCookiesForwarded(cookieHeader, browserCookieHeader, scopeHost, options = {}) {
  const browserCookies = rewritePublisherCookieHeaderForUpstream(
    stripSessionCookie(browserCookieHeader),
    scopeHost,
    options
  );
  if (!browserCookies) return cookieHeader || '';
  return mergeSessionHostCookieJar(cookieHeader || '', browserCookies);
}

function addPublisherCookiePromotionHeaders(headers, browserCookieHeader, scopeHost, domain) {
  // Preserve raw Cloudflare clearance cookies during a challenge loop. The
  // upstream WAF decides whether a clearance is valid; deleting it here can
  // keep the browser from ever settling into a completed challenge state.
}

function appendOtherPublisherCookieClearHeaders(headers, browserCookieHeader, currentScopeHost, domain) {
  if (!headers || !browserCookieHeader || !currentScopeHost || !domain) return;
  const names = new Set();
  for (const pair of String(browserCookieHeader || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim();
    const parsed = parsePublisherCookieName(name);
    if (!parsed || parsed.scopeHost === currentScopeHost) continue;
    names.add(name);
  }
  const cleanDomain = normalizeHost(domain);
  if (!cleanDomain) return;
  const expired = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
  for (const name of names) {
    headers.append('Set-Cookie', `${name}=; Domain=${cleanDomain}; Path=/; ${expired}; Secure; SameSite=Lax`);
    headers.append('Set-Cookie', `${name}=; Domain=.${cleanDomain}; Path=/; ${expired}; Secure; SameSite=Lax`);
    headers.append('Set-Cookie', `${name}=; Path=/; ${expired}; Secure; SameSite=Lax`);
  }
}

function scienceDirectCookieCleanupRedirect(request, url, target, cookieDomain) {
  if (!isScienceDirectProxyHost(target?.host)) return null;
  if (!isDocumentNavigation(request.headers)) return null;
  if (String(target?.path || '').startsWith('/search/api')) return null;
  const cookieHeader = request.headers.get('Cookie') || '';
  const hasRawClearance = hasCookieName(cookieHeader, 'cf_clearance');
  if (hasCookieName(cookieHeader, '__ra_sd_clean') && !hasRawClearance) return null;

  const headers = new Headers({ Location: `${url.pathname}${url.search}` });
  appendOtherPublisherCookieClearHeaders(
    headers,
    cookieHeader,
    'sciencedirect.com',
    cookieDomain
  );
  clearRawPublisherClearanceCookies(headers, 'sciencedirect.com', cookieDomain);
  if (!headers.has('Set-Cookie')) return null;
  headers.append('Set-Cookie', '__ra_sd_clean=1; Path=/; Max-Age=300; Secure; SameSite=Lax');
  return new Response(null, { status: 302, headers });
}

export function clearPublisherClearanceOnChallenge(headers, upstreamResp, scopeHost, domain, currentPath = '/') {
  // Do not clear cf_chl_* runtime cookies on challenge responses. They are
  // part of Cloudflare's in-browser challenge state and may be required by the
  // next /cdn-cgi/challenge-platform request.
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

function isCloudflareChallengeRuntimeCookieName(name) {
  return String(name || '').toLowerCase().startsWith('cf_chl_');
}

function shouldAllowRawPublisherCookieFallback(name, scopeHost = '') {
  if (scopeHost === 'oup.com' || scopeHost === 'sciencedirect.com') return false;
  return String(name || '').toLowerCase() === 'cf_clearance';
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
// ADMIN — WAF clearance management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /__ra-admin/waf-clearance
 *
 * Body (JSON):
 *   { product_slug: string, scope_host: string, clearance: string, updated_by?: string }
 *
 * Auth: Authorization: Bearer <RA_ADMIN_SECRET>
 *
 * Upserts a cf_clearance value for the given (product_slug, scope_host) pair.
 * The proxy egress IP that solved the Cloudflare challenge should call this
 * endpoint after obtaining a fresh clearance value so that subsequent user
 * sessions can bootstrap from it.
 *
 * GET /__ra-admin/waf-clearance?product_slug=...&scope_host=...
 *   Returns the stored clearance row (for diagnostics).
 */
async function handleAdminWafClearance(request, env) {
  const secret = String(env?.RA_ADMIN_SECRET || '').trim();
  if (!secret) {
    return htmlError(503, 'Admin route tanımlanmamış.');
  }

  const auth = request.headers.get('Authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!provided || provided !== secret) {
    return new Response(JSON.stringify({ error: 'Yetkisiz' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env?.DB) {
    return new Response(JSON.stringify({ error: 'DB bağlantısı yok' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);

  if (request.method === 'GET') {
    const productSlug = url.searchParams.get('product_slug') || '';
    const scopeHost   = url.searchParams.get('scope_host') || '';
    if (!productSlug || !scopeHost) {
      return new Response(JSON.stringify({ error: 'product_slug ve scope_host gerekli' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const row = await env.DB.prepare(
      'SELECT product_slug, scope_host, clearance, updated_at, updated_by FROM ra_waf_clearance WHERE product_slug = ? AND scope_host = ?'
    ).bind(productSlug, scopeHost).first();
    if (!row) {
      return new Response(JSON.stringify({ found: false }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ found: true, row }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'JSON body gerekli' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const productSlug = String(body?.product_slug || '').trim();
    const scopeHost   = String(body?.scope_host   || '').trim().toLowerCase();
    const clearance   = String(body?.clearance     || '').trim();
    const updatedBy   = String(body?.updated_by    || '').trim().slice(0, 120) || null;

    if (!productSlug || !scopeHost || !clearance) {
      return new Response(JSON.stringify({ error: 'product_slug, scope_host ve clearance gerekli' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (productSlug.length > 120 || scopeHost.length > 253 || clearance.length > 2048) {
      return new Response(JSON.stringify({ error: 'Alan değeri çok uzun' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO ra_waf_clearance (product_slug, scope_host, clearance, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (product_slug, scope_host)
       DO UPDATE SET clearance = excluded.clearance,
                     updated_at = excluded.updated_at,
                     updated_by = excluded.updated_by`
    ).bind(productSlug, scopeHost, clearance, now, updatedBy).run();

    return new Response(JSON.stringify({ success: true, product_slug: productSlug, scope_host: scopeHost, updated_at: now }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WAF clearance injection helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * injectStoredWafClearanceIfMissing
 *
 * If the effective upstream Cookie header does not contain a cf_clearance for
 * the given scope_host, look up the stored clearance value in D1 and inject
 * it so the egress IP can present a known-good clearance on the first request
 * of a new session.
 *
 * The injection is a best-effort hint. If the stored value is stale, the
 * upstream WAF will reject it and issue a new challenge. Update the stored
 * value via POST /__ra-admin/waf-clearance after the egress resolves it.
 *
 * @param {object} env         - Cloudflare env (env.DB required)
 * @param {string} productSlug - Product slug for DB lookup
 * @param {string} scopeHost   - Publisher cookie scope host (e.g. "nejm.org")
 * @param {string} cookieHeader - Current effective upstream Cookie header value
 * @returns {Promise<string>} Updated cookie header (possibly with injected cf_clearance)
 */
async function injectStoredWafClearanceIfMissing(env, productSlug, scopeHost, cookieHeader) {
  if (!scopeHost || !productSlug || !env?.DB) return cookieHeader || '';

  // Only inject when the upstream cookie header carries neither a raw
  // cf_clearance nor a namespaced __cp_<scope>|cf_clearance.
  const existing = String(cookieHeader || '');
  if (hasCookieName(existing, 'cf_clearance')) return existing;
  const namespacedKey = `${PUBLISHER_COOKIE_PREFIX}${scopeHost}|cf_clearance`;
  if (hasCookieName(existing, namespacedKey)) return existing;

  let row;
  try {
    row = await env.DB.prepare(
      'SELECT clearance FROM ra_waf_clearance WHERE product_slug = ? AND scope_host = ?'
    ).bind(productSlug, scopeHost).first();
  } catch (err) {
    console.warn('waf clearance db read failed', err);
    return existing;
  }

  if (!row?.clearance) return existing;

  const clearanceVal = String(row.clearance).trim();
  if (!clearanceVal) return existing;

  // Inject as raw cf_clearance — rewritePublisherCookieHeaderForUpstream has
  // already run at this point, so the namespaced prefix is never stripped.
  const injected = `cf_clearance=${clearanceVal}`;
  return existing ? `${existing}; ${injected}` : injected;
}
