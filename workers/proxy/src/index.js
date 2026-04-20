/**
 * workers/proxy/src/index.js
 *
 * Remote Access Proxy Worker — *.proxy.libedge.com wildcard'ına bağlı.
 * Main Worker'dan bağımsız deploy edilir, Hono kullanmaz (saf fetch
 * handler — minimal overhead, streaming-friendly).
 *
 * Akış:
 *   1. İstek URL'i parse et: `https://www-sciencedirect-com.proxy.libedge.com/article/123`
 *      → targetEncoded = "www-sciencedirect-com"
 *   2. Proxy session cookie'si var mı?
 *      - Yoksa → hash fragment'ta veya ?t= query'de token arar
 *      - Token'ı verify et (Main Worker'ın imzası), jti check
 *      - Session cookie set et (proxy.libedge.com Domain), 302 redirect ile URL temizle
 *   3. Session varken:
 *      - Hedef origin'e fetch (ya egress agent üzerinden ya direkt)
 *      - Upstream login (cookie jar) — §9
 *      - HTML body rewrite — §9 host_allowlist + proxy subdomain'e map
 *      - Response'u stream et, Set-Cookie'leri YAKALA (kullanıcıya iletme)
 */

import { verifyProxyToken } from '../../../backend/src/ra/jwt.js';
import { decodeHost, isValidEncodedHost } from '../../../backend/src/ra/host.js';

const SESSION_COOKIE = 'ra_proxy_session';
const SESSION_TTL_SEC = 3600;

export default {
  /**
   * @param {Request} request
   * @param {any} env
   * @param {ExecutionContext} ctx
   */
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

  // 1. Subdomain parse: *.proxy.libedge.com veya *.proxy-staging.libedge.com
  const parsed = parseProxyHost(url.hostname, env.RA_PROXY_BASE_HOST || inferBaseHost(url.hostname));
  if (!parsed) {
    return htmlError(400, 'Geçersiz proxy alt alan adı.');
  }
  const { encodedLabel, baseHost } = parsed;

  if (!isValidEncodedHost(encodedLabel)) {
    return htmlError(400, 'Hedef adres çözümlenemedi.');
  }
  const targetHost = decodeHost(encodedLabel);

  // 2. Session cookie?
  const sessionCookie = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  let session = sessionCookie
    ? await loadProxySession(env, sessionCookie)
    : null;

  if (!session) {
    // Token kabul — hash fragment server'a gönderilmez, client-side script
    // gerekiyor. Pratikte Main Worker #t=... yerine ?t=... ile de gönderebilir.
    const token = url.searchParams.get('t');
    if (token) {
      const redirected = await acceptTokenAndRedirect(request, env, token, url);
      if (redirected) return redirected;
    }

    // Hash fragment fallback: client-side minik HTML servis et, token'ı
    // ?t=...'e çevirip yönlendirsin.
    if (!token) {
      return hashToQueryBridge();
    }

    return htmlError(401, 'Oturum kurulamadı. Lütfen portal üzerinden tekrar deneyin.');
  }

  // 3. Session valid — upstream'e relay
  // Session: { user_id, institution_id, subscription_id, product_slug, target_host }
  // targetHost header'dan gelen subdomain, session'daki ile uyumlu mu?
  if (session.target_host !== targetHost) {
    // Farklı publisher'a atlamış; token'sız cross-publisher izni verilmez.
    return htmlError(
      403,
      'Bu oturum bu kaynağa ait değil. Portal üzerinden ilgili kaynağa yeniden erişin.'
    );
  }

  // Upstream URL inşası (hedef host + path + query)
  const targetUrl = new URL(`https://${targetHost}${url.pathname}${url.search}`);

  // TODO: upstream login recipe, cookie jar, egress dispatch — §9, §10
  // Bu dosya şimdilik iskelet: gerçek fetch çağrısı upstream.js ve
  // egress-client.js'te. Proxy Worker çağrı sırası:
  //
  //   const sess = await ensureUpstreamSession(env, session);
  //   const resp = await egressFetch(env, session.institution_id, targetUrl, { ... });
  //   return streamWithRewrite(resp, env, { baseHost, session });

  return new Response(
    `Proxy session OK\n` +
      `target: ${targetUrl.toString()}\n` +
      `user: ${session.user_id}\n` +
      `institution: ${session.institution_id}\n` +
      `product: ${session.product_slug}\n\n` +
      `[upstream relay yet to be implemented — §9 upstream.js + §10 egress-client.js]`,
    { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Host parse: "www-sciencedirect-com.proxy.libedge.com" →
//   { encodedLabel: "www-sciencedirect-com", baseHost: "proxy.libedge.com" }
// ──────────────────────────────────────────────────────────────────────────
function parseProxyHost(hostname, baseHost) {
  if (!hostname.endsWith('.' + baseHost)) return null;
  const label = hostname.slice(0, -('.' + baseHost).length);
  if (!label) return null;
  return { encodedLabel: label, baseHost };
}

function inferBaseHost(hostname) {
  // hostname: "www-sciencedirect-com.proxy.libedge.com"
  // Ortadaki noktaları say: baseHost en az 2 parça (proxy.libedge.com)
  const parts = hostname.split('.');
  if (parts.length < 3) return hostname;
  return parts.slice(1).join('.');
}

// ──────────────────────────────────────────────────────────────────────────
// Token kabul → session oluştur → 302 ile URL'i temizle
// ──────────────────────────────────────────────────────────────────────────
async function acceptTokenAndRedirect(request, env, token, url) {
  let payload;
  try {
    payload = await verifyProxyToken(token, env.RA_PROXY_TOKEN_SECRET);
  } catch (err) {
    return htmlError(401, 'Token geçersiz veya süresi dolmuş.', err.message);
  }

  // jti tek kullanımlık — RATE_LIMIT_KV'da daha önce harcandı mı?
  const jtiKey = `ra:jti:${payload.jti}`;
  const existing = await env.RATE_LIMIT_KV.get(jtiKey);
  if (existing === 'used') {
    return htmlError(401, 'Bu oturum linki zaten kullanılmış. Lütfen tekrar erişim isteyin.');
  }
  await env.RATE_LIMIT_KV.put(jtiKey, 'used', { expirationTtl: 600 });

  // Session oluştur (random id, KV'da)
  const sid = crypto.randomUUID();
  // payload field'ları: sub=user_id(INTEGER), iid=institution_id(INTEGER),
  // sid=subscription_id(INTEGER), pid=product_slug(TEXT), tgt=encoded host
  const session = {
    user_id: payload.sub,
    institution_id: payload.iid,
    subscription_id: payload.sid,
    product_slug: payload.pid,
    target_host: decodeHost(payload.tgt),
    created_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  await env.RA_UPSTREAM_SESSIONS.put(
    `proxysess:${sid}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SEC }
  );

  // 302: aynı URL ama token'sız
  const clean = new URL(url);
  clean.searchParams.delete('t');
  return new Response(null, {
    status: 302,
    headers: {
      Location: clean.toString(),
      'Set-Cookie': buildSessionCookie(sid, url.hostname),
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Hash fragment bridge — tarayıcıda JS'le fragment → query'ye taşı
// ──────────────────────────────────────────────────────────────────────────
function hashToQueryBridge() {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Yönlendiriliyor…</title></head><body>
<script>
(function () {
  var h = window.location.hash || '';
  var m = h.match(/[#&]t=([^&]+)/);
  if (!m) { document.body.innerText = 'Oturum bilgisi eksik.'; return; }
  var u = new URL(window.location.href);
  u.hash = '';
  u.searchParams.set('t', m[1]);
  window.location.replace(u.toString());
})();
</script>
Yönlendiriliyor…
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// KV session lookup
// ──────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ──────────────────────────────────────────────────────────────────────────
function readCookie(header, name) {
  if (!header) return null;
  const parts = header.split(';').map((s) => s.trim());
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx < 0) continue;
    if (p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return null;
}

function buildSessionCookie(sid, hostname) {
  // Domain = proxy.libedge.com (2 eksenli base host)
  const baseHost = inferBaseHost(hostname);
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
    `Domain=.${baseHost}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    `Max-Age=${SESSION_TTL_SEC}`
  );
}

// ──────────────────────────────────────────────────────────────────────────
function htmlError(status, message, detail) {
  const body = `<!doctype html><html><head><meta charset="utf-8">
<title>Uzaktan Erişim — Hata</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;background:#f5f5f5;color:#222;padding:3rem;max-width:640px;margin:auto}
h1{color:#b00020;font-size:1.4rem}p{line-height:1.5}code{background:#eee;padding:2px 6px;border-radius:4px}</style>
</head><body>
<h1>Erişim hatası (${status})</h1>
<p>${escapeHtml(message)}</p>
${detail ? `<p><small>Detay: <code>${escapeHtml(detail)}</code></small></p>` : ''}
<p><a href="https://libedge.com/profile.html">← Portal'a dön</a></p>
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
