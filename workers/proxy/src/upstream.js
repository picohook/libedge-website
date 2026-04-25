/**
 * workers/proxy/src/upstream.js
 *
 * Upstream fetch + response rewrite. POC:
 *  - Eğer institution_ra_settings.egress_endpoint set ise egress agent'tan
 *    HMAC imzalı çağrı (§10); değilse Worker → doğrudan upstream fetch.
 *  - HTMLRewriter ile href/src/action/form attribute'ları ve inline mutlak
 *    URL'ler (https://{targetHost}/...) proxy host'una yönlendirilir.
 *  - Location header ve Set-Cookie: Location rewrite edilir, Set-Cookie
 *    KV cookie jar'a yazılır (tarayıcıya iletilmez).
 */

import { encodeHost } from '../../../backend/src/ra/host.js';
import { egressFetch } from './egress-client.js';
import {
  ensureRecipeExecuted,
  loadRecipeForSession,
  maybeCaptureTokenAndForward,
  invalidateCapturedUserToken,
} from './recipe.js';

// Cookie jar kullanıcı + publisher host bazında kalıcı olarak tutulur.
// Pangram gibi session-cookie auth kullanan publisher'larda bu sayede
// kullanıcı bir kere login olduktan sonra sonraki "Erişime Git" ziyaretlerinde
// otomatik olarak session cookie'si ile geliyor. TTL publisher'ın session
// cookie'sinin kendi ömründen daha uzun olmamalı — Pangram 1 yıl veriyor
// ama 90 gün makul bir varsayılan (kurum abonelik süresi değişebilir).
const COOKIE_JAR_TTL = 90 * 24 * 60 * 60; // 90 gün = 7776000 sn

/**
 * Cookie jar KV key builder. User+host bazlı — kullanıcı-özel (aynı makineyi
 * paylaşan iki kullanıcının session cookie'leri birbirine karışmaz) ve
 * LibEdge proxy session'ından bağımsız (kullanıcı iki saat sonra tekrar
 * "Erişime Git"e bastığında yeni bir proxy session açılsa bile aynı jar'ı
 * okur → Pangram onu hâlâ login'li görür).
 */
export function buildCookieJarKey(session, targetHost) {
  return `jar:u${session.user_id}:${targetHost}`;
}

/**
 * @param {any} env
 * @param {object} session  {user_id, institution_id, subscription_id, product_slug, target_host}
 * @param {string} sessionId proxysess:{sid} anahtarı için
 * @param {Request} clientReq  kullanıcının Worker'a yaptığı istek
 * @param {string} proxyHost  proxy-staging.selmiye.com
 * @param {{ encodedLabel: string, remainingPath: string }} pathInfo
 * @returns {Promise<Response>}
 */
export async function proxyToUpstream(env, session, sessionId, clientReq, proxyHost, pathInfo) {
  const url = new URL(clientReq.url);
  const targetHost = session.target_host;
  const encodedLabel = pathInfo?.encodedLabel || encodeHost(targetHost);
  const remainingPath = pathInfo?.remainingPath || url.pathname || '/';
  const productConfig = await loadProductProxyConfig(env.DB, session.product_slug);
  const egressSettings = await loadInstitutionRaSettings(env.DB, session.institution_id);
  const proxyableHosts = buildProxyableHosts(
    targetHost,
    productConfig && productConfig.ra_host_allowlist_json,
    egressSettings && egressSettings.egress_endpoint
      ? egressSettings.egress_endpoint
      : null
  );

  // Recipe executor: ürün için ra_login_recipe_json tanımlıysa ve abonelikte
  // credential varsa, auto-login burada yapılır. Sonuç (form_post = cookies
  // jar'a yazılı, spa_token = bearer token) proxy request'lere uygulanır.
  // Başarısızlık durumunda auth uygulanmaz — kullanıcı normal proxy akışında
  // login sayfasını kendi görür.
  const authState = await ensureRecipeExecuted(env, session, sessionId);

  // Upstream URL: proxy path + query (?t ve ?tgt çıkarılır; clean URL)
  const search = new URLSearchParams(url.search);
  search.delete('t');
  search.delete('tgt');
  const searchStr = search.toString();
  const upstreamUrl =
    `https://${targetHost}${remainingPath}${searchStr ? '?' + searchStr : ''}`;

  // Request header'ları: kullanıcının Host'u temizlendi, Cookie jar'dan ekle
  const upstreamHeaders = new Headers();
  for (const [k, v] of clientReq.headers.entries()) {
    const kl = k.toLowerCase();
    if (kl === 'host' || kl === 'cookie' || kl === 'cf-connecting-ip' ||
        kl === 'cf-ray' || kl === 'x-forwarded-for' || kl === 'x-real-ip') continue;
    upstreamHeaders.set(k, v);
  }
  upstreamHeaders.set('Host', targetHost);
  // Upstream Cookie jar (KV) — user+host bazlı, proxy session'dan bağımsız
  const jarKey = buildCookieJarKey(session, targetHost);
  const storedCookies = await env.RA_UPSTREAM_SESSIONS.get(jarKey);
  if (storedCookies) upstreamHeaders.set('Cookie', storedCookies);

  // spa_token modu: recipe login sonrası ele geçen bearer token header olarak
  // eklenir. Client tarafında localStorage inject HTML akışında yapılır (aşağıda).
  if (authState && authState.ok && authState.mode === 'spa_token' && authState.token) {
    const { header_name, header_prefix, value } = authState.token;
    upstreamHeaders.set(header_name || 'Authorization', `${header_prefix || ''}${value}`);
  }

  // Body
  let body = null;
  if (clientReq.method !== 'GET' && clientReq.method !== 'HEAD') {
    body = await clientReq.arrayBuffer();
  }

  // Fetch — önce egress agent varsa oradan, yoksa direkt
  let upstreamResp;
  try {
    upstreamResp = await tryEgressOrDirect(env, egressSettings, upstreamUrl, {
      method: clientReq.method,
      headers: upstreamHeaders,
      body,
      redirect: 'manual', // redirect'i elle rewrite edeceğiz
    });
  } catch (err) {
    console.error('upstream fetch failed', err);
    return new Response(
      `Upstream fetch hatası: ${escapeHtml(err.message)}`,
      { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  // Token capture: recipe'de capture_token_on_login_path tanımlıysa ve
  // şu anki request bu path'e gidiyorsa, response body'sinden token çıkarılıp
  // ra_user_credentials'a yazılır. upstreamResp body tüketildiği için
  // reconstruct edilip yerine konur. Pangram gibi per-user invite'lı
  // publisher'larda kullanıcı ilk manuel login'inde transparan olarak
  // token yakalanır — sonraki session'larda replay edilir.
  const recipe = await loadRecipeForSession(env, session);
  if (recipe && recipe.capture_token_on_login_path) {
    upstreamResp = await maybeCaptureTokenAndForward(
      env, session, sessionId, recipe, remainingPath, upstreamResp
    );
  }

  // Stored token geçersiz (401/403) — kullanıcı yeniden login yapsın diye
  // hem DB kaydını hem raauth cache'ini sil. Sadece spa_token replay'den
  // aktif oturumlarda gerekli (authState.mode='spa_token' ve captured mode).
  if ((upstreamResp.status === 401 || upstreamResp.status === 403)
      && authState && authState.ok && authState.mode === 'spa_token'
      && recipe && recipe.capture_token_on_login_path) {
    try {
      await invalidateCapturedUserToken(env, session, sessionId);
    } catch (err) {
      console.warn('token invalidation failed', err);
    }
  }

  // Response header'larını işle: Set-Cookie'leri jar'a; Location'u rewrite et
  const respHeaders = new Headers();
  const setCookies = [];
  for (const [k, v] of upstreamResp.headers.entries()) {
    const kl = k.toLowerCase();
    if (kl === 'set-cookie') { setCookies.push(v); continue; }
    if (kl === 'content-security-policy' || kl === 'content-security-policy-report-only') {
      // CSP'yi geçici kaldır — inline rewrite/eval için POC'de zorluk çıkarır
      continue;
    }
    if (kl === 'strict-transport-security') {
      // HSTS da aynı şekilde — upstream HSTS proxy host'a uymaz
      continue;
    }
    if (kl === 'location') {
      const newLoc = rewriteUrl(v, proxyableHosts, proxyHost, encodedLabel);
      respHeaders.set('Location', newLoc);
      continue;
    }
    respHeaders.append(k, v);
  }

  if (setCookies.length) {
    // Cookie'leri normalize edip Cookie header formatına çevir (Set-Cookie syntax → Cookie syntax)
    const merged = mergeCookieJar(storedCookies || '', setCookies);
    await env.RA_UPSTREAM_SESSIONS.put(jarKey, merged, { expirationTtl: COOKIE_JAR_TTL });
  }

  // Content-Type ile HTML mi kontrol et — öyleyse HTMLRewriter ile linkleri çevir
  const ct = upstreamResp.headers.get('content-type') || '';
  if (/text\/html/i.test(ct)) {
    // spa_token modu: token'ı client'ın localStorage'ına enjekte et —
    // modern SPA'lar auth durumu için localStorage'a bakıyor; sadece
    // Authorization header yetmez, ilk HTML dönüşünde tarayıcı tarafında
    // da token görünmeli.
    const lsInject = (authState && authState.ok && authState.mode === 'spa_token'
      && authState.token && authState.token.ls_key)
      ? { key: authState.token.ls_key, value: authState.token.value }
      : null;

    const rewriter = makeHtmlRewriter(proxyableHosts, proxyHost, encodedLabel, lsInject);
    const rewritten = rewriter.transform(upstreamResp);
    return new Response(rewritten.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: respHeaders,
    });
  }

  // Non-HTML: body stream pass-through
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: respHeaders,
  });
}

// ──────────────────────────────────────────────────────────────────────────
async function tryEgressOrDirect(env, settings, targetUrl, init) {
  // Egress agent check
  try {
    if (settings && settings.enabled && settings.egress_endpoint) {
      return await egressFetch(env, settings.institution_id, targetUrl, init);
    }
  } catch (err) {
    console.warn('egress lookup failed, falling back to direct', err);
  }
  // Direct fetch
  return await fetch(targetUrl, init);
}

// ──────────────────────────────────────────────────────────────────────────
// URL rewrite: absolute URL (https://target/...) → https://proxy/...
// Non-target host'lar olduğu gibi bırakılır.
// ──────────────────────────────────────────────────────────────────────────
function rewriteUrl(u, proxyableHosts, proxyHost, encodedLabel) {
  if (!u) return u;
  try {
    if (u.startsWith('/')) {
      return `https://${proxyHost}/${encodedLabel}${u}`;
    }
    // Relative URL ise olduğu gibi bırak (browser proxy host üzerinden çözer)
    if (!/^https?:\/\//i.test(u) && !u.startsWith('//')) return u;
    // Protocol-relative (//www.jove.com/x) destekle
    const abs = u.startsWith('//') ? `https:${u}` : u;
    const parsed = new URL(abs);
    if (proxyableHosts.has(parsed.hostname)) {
      return `https://${proxyHost}/${encodeHost(parsed.hostname)}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return u;
  } catch {
    return u;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// HTMLRewriter — href/src/action/poster/formaction attribute'ları
// ──────────────────────────────────────────────────────────────────────────
function makeHtmlRewriter(proxyableHosts, proxyHost, encodedLabel, lsInject) {
  const attrHandler = (attr) => ({
    element(el) {
      const v = el.getAttribute(attr);
      if (!v) return;
      const n = rewriteUrl(v, proxyableHosts, proxyHost, encodedLabel);
      if (n !== v) el.setAttribute(attr, n);
    },
  });
  const rewriter = new HTMLRewriter()
    .on('a[href]', attrHandler('href'))
    .on('link[href]', attrHandler('href'))
    .on('area[href]', attrHandler('href'))
    .on('base[href]', attrHandler('href'))
    .on('script[src]', attrHandler('src'))
    .on('img[src]', attrHandler('src'))
    .on('iframe[src]', attrHandler('src'))
    .on('video[src]', attrHandler('src'))
    .on('audio[src]', attrHandler('src'))
    .on('source[src]', attrHandler('src'))
    .on('track[src]', attrHandler('src'))
    .on('embed[src]', attrHandler('src'))
    .on('form[action]', attrHandler('action'))
    .on('video[poster]', attrHandler('poster'))
    .on('button[formaction]', attrHandler('formaction'))
    .on('input[formaction]', attrHandler('formaction'));

  if (lsInject && lsInject.key && lsInject.value) {
    const js = buildLocalStorageInjectScript(lsInject.key, lsInject.value);
    rewriter.on('head', {
      element(el) {
        el.prepend(js, { html: true });
      },
    });
  }
  return rewriter;
}

function buildLocalStorageInjectScript(key, value) {
  // JSON.stringify hem güvenli escaping sağlıyor hem de </script> sızıntısını
  // önlemek için ikinci bir pass ile slashelenmeli
  const safeKey = JSON.stringify(String(key)).replace(/<\/script/gi, '<\\/script');
  const safeVal = JSON.stringify(String(value)).replace(/<\/script/gi, '<\\/script');
  return `<script>try{localStorage.setItem(${safeKey},${safeVal});}catch(e){}</script>`;
}

async function loadInstitutionRaSettings(db, institutionId) {
  return await db
    .prepare(
      `SELECT institution_id, egress_endpoint, enabled
       FROM institution_ra_settings WHERE institution_id = ?`
    )
    .bind(institutionId)
    .first();
}

async function loadProductProxyConfig(db, slug) {
  return await db
    .prepare(
      `SELECT ra_host_allowlist_json
       FROM products
       WHERE slug = ?`
    )
    .bind(slug)
    .first();
}

function buildProxyableHosts(targetHost, allowlistJson, egressEndpoint) {
  const hosts = new Set([targetHost]);
  addCommonHostAliases(hosts, targetHost);

  if (allowlistJson) {
    try {
      const parsed = JSON.parse(allowlistJson);
      if (Array.isArray(parsed)) {
        for (const host of parsed) {
          if (typeof host === 'string' && host.trim()) {
            hosts.add(host.trim().toLowerCase());
            addCommonHostAliases(hosts, host);
          }
        }
      }
    } catch {
      // allowlist parse edilemiyorsa sadece ana hostlarla devam et
    }
  }

  if (!egressEndpoint) return hosts;
  try {
    hosts.add(new URL(egressEndpoint).hostname);
  } catch {
    // egress endpoint bozuksa rewrite set'ine ekleme yapma
  }
  return hosts;
}

function addCommonHostAliases(hosts, rawHost) {
  const host = String(rawHost || '').trim().toLowerCase();
  if (!host) return;
  if (host.startsWith('www.')) {
    hosts.add(host.slice(4));
  } else {
    hosts.add(`www.${host}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cookie jar: mevcut "name=value; name=value" + yeni Set-Cookie başlıkları
// Her Set-Cookie'den name=value parçasını al, aynı isim varsa override et.
// ──────────────────────────────────────────────────────────────────────────
function mergeCookieJar(existing, newSetCookies) {
  const map = new Map();
  if (existing) {
    for (const pair of existing.split(';')) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (name) map.set(name, value);
      }
    }
  }
  for (const sc of newSetCookies) {
    const firstSemi = sc.indexOf(';');
    const pair = firstSemi < 0 ? sc : sc.slice(0, firstSemi);
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name) map.set(name, value);
    }
  }
  const out = [];
  for (const [k, v] of map.entries()) out.push(`${k}=${v}`);
  return out.join('; ');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
