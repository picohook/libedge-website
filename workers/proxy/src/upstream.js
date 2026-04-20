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

import { egressFetch } from './egress-client.js';

const COOKIE_JAR_TTL = 3600;

/**
 * @param {any} env
 * @param {object} session  {user_id, institution_id, subscription_id, product_slug, target_host}
 * @param {string} sessionId proxysess:{sid} anahtarı için
 * @param {Request} clientReq  kullanıcının Worker'a yaptığı istek
 * @param {string} proxyHost  proxy-staging.selmiye.com
 * @returns {Promise<Response>}
 */
export async function proxyToUpstream(env, session, sessionId, clientReq, proxyHost) {
  const url = new URL(clientReq.url);
  const targetHost = session.target_host;

  // Upstream URL: proxy path + query (?t ve ?tgt çıkarılır; clean URL)
  const search = new URLSearchParams(url.search);
  search.delete('t');
  search.delete('tgt');
  const searchStr = search.toString();
  const upstreamUrl =
    `https://${targetHost}${url.pathname}${searchStr ? '?' + searchStr : ''}`;

  // Request header'ları: kullanıcının Host'u temizlendi, Cookie jar'dan ekle
  const upstreamHeaders = new Headers();
  for (const [k, v] of clientReq.headers.entries()) {
    const kl = k.toLowerCase();
    if (kl === 'host' || kl === 'cookie' || kl === 'cf-connecting-ip' ||
        kl === 'cf-ray' || kl === 'x-forwarded-for' || kl === 'x-real-ip') continue;
    upstreamHeaders.set(k, v);
  }
  upstreamHeaders.set('Host', targetHost);
  // Upstream Cookie jar (KV) — yalnız bu target_host için
  const jarKey = `jar:${sessionId}:${targetHost}`;
  const storedCookies = await env.RA_UPSTREAM_SESSIONS.get(jarKey);
  if (storedCookies) upstreamHeaders.set('Cookie', storedCookies);

  // Body
  let body = null;
  if (clientReq.method !== 'GET' && clientReq.method !== 'HEAD') {
    body = await clientReq.arrayBuffer();
  }

  // Fetch — önce egress agent varsa oradan, yoksa direkt
  let upstreamResp;
  try {
    upstreamResp = await tryEgressOrDirect(env, session.institution_id, upstreamUrl, {
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
      const newLoc = rewriteUrl(v, targetHost, proxyHost);
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
    const rewriter = makeHtmlRewriter(targetHost, proxyHost);
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
async function tryEgressOrDirect(env, institutionId, targetUrl, init) {
  // Egress agent check
  try {
    const settings = await env.DB.prepare(
      `SELECT egress_endpoint, enabled FROM institution_ra_settings WHERE institution_id = ?`
    ).bind(institutionId).first();
    if (settings && settings.enabled && settings.egress_endpoint) {
      return await egressFetch(env, institutionId, targetUrl, init);
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
function rewriteUrl(u, targetHost, proxyHost) {
  if (!u) return u;
  try {
    // Relative URL ise olduğu gibi bırak (browser proxy host üzerinden çözer)
    if (!/^https?:\/\//i.test(u) && !u.startsWith('//')) return u;
    // Protocol-relative (//www.jove.com/x) destekle
    const abs = u.startsWith('//') ? `https:${u}` : u;
    const parsed = new URL(abs);
    if (parsed.hostname === targetHost) {
      parsed.hostname = proxyHost;
      parsed.protocol = 'https:';
      return parsed.toString();
    }
    return u;
  } catch {
    return u;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// HTMLRewriter — href/src/action/poster/formaction attribute'ları
// ──────────────────────────────────────────────────────────────────────────
function makeHtmlRewriter(targetHost, proxyHost) {
  const attrHandler = (attr) => ({
    element(el) {
      const v = el.getAttribute(attr);
      if (!v) return;
      const n = rewriteUrl(v, targetHost, proxyHost);
      if (n !== v) el.setAttribute(attr, n);
    },
  });
  return new HTMLRewriter()
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
