/**
 * workers/proxy/src/oidc-proxy.js
 *
 * {hash}.selmiye.com — OIDC thin proxy (CAS SciFinder için).
 *
 * Motivasyon:
 *   SciFinder-n, kimlik doğrulama için sso.cas.org/as/authorization.oauth2
 *   adresine yönlendirir. sso.cas.org kurumun IP adresini otomatik tanırsa
 *   (IP-based auth) login formu göstermeden doğrudan redirect_uri'ye döner.
 *   Bu Worker, kurumun egress IP'si üzerinden o isteği iletir; böylece
 *   tarayıcı hiç sso.cas.org'a gitmeden code alır ve proxy oturumu sürer.
 *
 * Akış:
 *   1. SciFinder SPA (proxy.selmiye.com/scifinder-n-cas-org/...) auth gerektirir.
 *   2. SPA tarayıcıyı {hash}.selmiye.com/as/authorization.oauth2?... adresine yönlendirir.
 *   3. Bu Worker isteği egress üzerinden sso.cas.org'a iletir.
 *   4. sso.cas.org (kurumun IP'sini tanır) → 302 Location: https://scifinder-n.cas.org/pa/oidc/cb?code=...
 *   5. Worker bu 302'yi tarayıcıya olduğu gibi döndürür (redirect takip etmez).
 *   6. Tarayıcı callback'e gider → SciFinder token exchange → state'teki proxy URL'e döner.
 *   7. Tarayıcı tekrar proxy.selmiye.com'da → oturum korumalı erişim devam eder.
 *
 * /.well-known/openid-configuration:
 *   sso.cas.org'dan çekilip authorization_endpoint bu hash subdomain'e rewrite edilir.
 *   Diğer endpoint'ler (token, userinfo, jwks) sso.cas.org'da kalır.
 *
 * DB gereksinimi:
 *   institution_ra_settings.oidc_hash TEXT UNIQUE — kuruma ait 40-hex-char hash.
 *   Yoksa 404 döner, diğer Worker işlemlerini etkilemez.
 */

import { egressFetch } from './egress-client.js';

/** sso.cas.org — CAS PingFederate sunucusu */
const CAS_SSO_ORIGIN = 'sso.cas.org';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
]);

const CF_STRIP = new Set([
  'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'cf-worker',
  'cdn-loop', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
  'x-real-ip', 'true-client-ip',
]);

/** RA imza header'ları — egress tarafına sızmamalı */
const RA_HEADERS = new Set([
  'x-ra-target-url', 'x-ra-method', 'x-ra-timestamp', 'x-ra-signature',
]);

const STRIP_RESPONSE = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'trailer',
  'content-security-policy', 'content-security-policy-report-only',
  'strict-transport-security',
]);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * OIDC proxy ana giriş noktası.
 * index.js'deki handle() tarafından 40-char hex subdomain tespitinde çağrılır.
 *
 * @param {Request}  request
 * @param {any}      env       Worker env bindings
 * @param {URL}      url
 * @param {string}   oidcHash  40-char lowercase hex
 */

export async function handleOidcProxy(request, env, url, oidcHash) {
  // Kurumu hash ile bul
  const institution = await lookupByOidcHash(env.DB, oidcHash);
  if (!institution) {
    return new Response(
      `OIDC proxy endpoint bulunamadı: ${oidcHash}`,
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const { institution_id } = institution;

  // ─── CORS preflight (tarayıcı SPA'dan fetch ile çağırabilir) ──────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('Origin')),
    });
  }

  // ─── Discovery document ───────────────────────────────────────────────────
  if (url.pathname === '/.well-known/openid-configuration') {
    return await handleDiscovery(env, url, institution_id, oidcHash);
  }

  // ─── Path'e göre upstream seçimi ──────────────────────────────────────────
  // /account-management/* → scifinder-n.cas.org
  // diğerleri → sso.cas.org
  let upstream = CAS_SSO_ORIGIN; // sso.cas.org varsayılan
  if (url.pathname.startsWith('/account-management/')) {
    upstream = 'scifinder-n.cas.org';
  }
  const targetUrl = `https://${upstream}${url.pathname}${url.search}`;
  
  const upstreamHeaders = buildOidcRequestHeaders(request.headers);

  let upstreamResp;
  try {
    upstreamResp = await egressFetch(env, institution_id, targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
    });
  } catch (err) {
    console.error('oidc-proxy egress error', err.message);
    return new Response('OIDC upstream unreachable', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // 302 dahil tüm response'u tarayıcıya olduğu gibi ilet.
  // Egress agent zaten redirect takip etmiyor (http.ErrUseLastResponse).
  const respHeaders = buildOidcResponseHeaders(upstreamResp.headers);

  // Location rewrite: upstream'den gelen 302 Location header'ında sso.cas.org varsa
  // {hash}.selmiye.com'a rewrite et — tarayıcı proxy dışına çıkmasın.
  const location = upstreamResp.headers.get('Location');
  if (location && location.includes('sso.cas.org')) {
    const proxyBase = `https://${oidcHash}.${baseDomain(url.hostname)}`;
    const newLocation = location
      .replaceAll('https://sso.cas.org', proxyBase)
      .replaceAll('http://sso.cas.org',  proxyBase);
    respHeaders.set('Location', newLocation);
  }

  // CORS: SciFinder SPA, session subdomain'inden (r*.selmiye.com) bu OIDC
  // subdomain'ine XHR ile istek yapıyor — cross-origin olduğu için ACAO şart.
  const requestOrigin = request.headers.get('Origin');
  if (requestOrigin) {
    respHeaders.set('Access-Control-Allow-Origin', requestOrigin);
    respHeaders.set('Access-Control-Allow-Credentials', 'true');
    respHeaders.set('Vary', 'Origin');
  }

  // HTML/JS body rewrite: PingFederate login sayfasındaki sso.cas.org referanslarını
  // {hash}.selmiye.com'a çevir. Aksi hâlde form action'ları ve JS XHR URL'leri
  // tarayıcıda sso.cas.org'a doğrudan gider (proxy dışı, 404).
  const contentType = respHeaders.get('Content-Type') || '';
  if (shouldRewriteBody(contentType)) {
    const proxyBase = `https://${oidcHash}.${baseDomain(url.hostname)}`;
    let text = await upstreamResp.text();
    text = text
      .replaceAll('https://sso.cas.org', proxyBase)
      .replaceAll('http://sso.cas.org',  proxyBase)
      .replaceAll('//sso.cas.org',        `//${oidcHash}.${baseDomain(url.hostname)}`);
    // Content-Length upstream değeriyle uyuşmaz; kaldır.
    respHeaders.delete('content-length');
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

// ─────────────────────────────────────────────────────────────────────────────
// /.well-known/openid-configuration
// ─────────────────────────────────────────────────────────────────────────────

async function handleDiscovery(env, url, institution_id, oidcHash) {
  const targetUrl = `https://${CAS_SSO_ORIGIN}/.well-known/openid-configuration`;

  let resp;
  try {
    resp = await egressFetch(env, institution_id, targetUrl, { method: 'GET' });
  } catch (err) {
    console.error('oidc-proxy discovery egress error', err.message);
    return new Response('Cannot fetch OIDC discovery document', { status: 502 });
  }

  let config;
  try {
    config = await resp.json();
  } catch {
    return new Response('Invalid OIDC discovery document from upstream', { status: 502 });
  }

  // authorization_endpoint'i bu {hash}.selmiye.com'a rewrite et.
  // Token, userinfo, jwks endpoint'leri sso.cas.org'da kalır —
  // bu istekler SciFinder sunucusundan sunucuya yapılır, browser'dan değil.
  const proxyBase = `https://${oidcHash}.${baseDomain(url.hostname)}`;
  if (config.authorization_endpoint) {
    try {
      const ep = new URL(config.authorization_endpoint);
      config.authorization_endpoint = `${proxyBase}${ep.pathname}${ep.search}`;
    } catch {
      // Parse edilemedi — olduğu gibi bırak
    }
  }

  // issuer'ı da rewrite et ki SP (SciFinder) validation yaparken eşleşsin.
  // Bazı SP implementasyonları issuer check'i atlar; yapamayanlar için rewrite.
  if (config.issuer) {
    config.issuer = proxyBase;
  }

  return new Response(JSON.stringify(config, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Header helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Egress'e gönderilecek istek header'larını hazırla */
function buildOidcRequestHeaders(incoming) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    const lower = k.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (CF_STRIP.has(lower)) continue;
    if (RA_HEADERS.has(lower)) continue;
    // CAS private header'lar → strip (EZproxy stanza: HTTPHeader -request -process x-cas*)
    if (lower.startsWith('x-cas')) continue;
    // ra_proxy_session cookie'si sso.cas.org'a iletilmemeli
    if (lower === 'cookie') {
      const cleaned = stripSessionCookie(v);
      if (cleaned) out.set('Cookie', cleaned);
      continue;
    }
    out.set(k, v);
  }
  return out;
}

/** Upstream'den gelen response header'larını filtrele */
function buildOidcResponseHeaders(incoming) {
  const out = new Headers();
  for (const [k, v] of incoming.entries()) {
    if (STRIP_RESPONSE.has(k.toLowerCase())) continue;
    out.set(k, v);
  }
  return out;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/** ra_proxy_session cookie'sini strip et (aynı mantık index.js'deki stripSessionCookie ile) */
function stripSessionCookie(header) {
  if (!header) return '';
  const SESSION_COOKIE = 'ra_proxy_session';
  const kept = [];
  for (const part of String(header).split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) continue;
    kept.push(part);
  }
  return kept.join('; ');
}

/** hostname'den base domain çıkar: "abc.selmiye.com" → "selmiye.com" */
function baseDomain(hostname) {
  const parts = hostname.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

/**
 * Response body'sini text olarak okuyup sso.cas.org referanslarını rewrite etmeli mi?
 * PingFederate login form HTML ve ilgili JS dosyaları için true döner.
 */
function shouldRewriteBody(contentType) {
  const ct = contentType.toLowerCase();
  return (
    ct.includes('text/html') ||
    ct.includes('text/javascript') ||
    ct.includes('application/javascript') ||
    ct.includes('application/x-javascript') ||
    ct.includes('application/json')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// D1 lookup
// ─────────────────────────────────────────────────────────────────────────────

async function lookupByOidcHash(db, hash) {
  return await db
    .prepare(
      `SELECT institution_id
       FROM institution_ra_settings
       WHERE oidc_hash = ? AND enabled = 1`
    )
    .bind(hash)
    .first();
}
