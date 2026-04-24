/**
 * workers/proxy/src/index.js
 *
 * Remote Access Proxy Worker — POC (query-param target encoding).
 * Tek hostname üzerinden çalışır: proxy-staging.selmiye.com / proxy.selmiye.com
 * (wildcard SSL gerekmez — Universal SSL *.selmiye.com'u kapsar).
 *
 * Akış:
 *   1. İlk istek: https://proxy-staging.selmiye.com/?tgt=www-jove-com#t=TOKEN
 *      - Token ve hedef host client-side bridge ile query'ye taşınır (hash
 *        fragment server'a gitmez)
 *      - Token verify → session cookie set (target_host token'dan gelir)
 *      - 302 ile ?tgt ve ?t parametreleri temizlenmiş URL'e yönlendirilir
 *   2. Sonraki istekler: oturum cookie'si var, target_host session'dan okunur.
 *      Upstream'e fetch, HTML rewrite ile linkler proxy host'una çevrilir.
 *
 * Not: Main Worker ile paylaşılan KV (RA_UPSTREAM_SESSIONS) ve HS256 secret
 * (RA_PROXY_TOKEN_SECRET) sayesinde token doğrulaması ve jti replay koruması.
 */

import { verifyProxyToken } from '../../../backend/src/ra/jwt.js';
import { decodeHost, isValidEncodedHost } from '../../../backend/src/ra/host.js';
import { proxyToUpstream } from './upstream.js';

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
  const proxyHost = url.hostname; // proxy-staging.selmiye.com

  // 1. Token kabul akışı: ?t=... varsa token verify + session oluştur
  const tokenParam = url.searchParams.get('t');
  if (tokenParam) {
    return await acceptTokenAndRedirect(request, env, tokenParam, url);
  }

  // 2. Session cookie?
  const sessionCookie = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  const session = sessionCookie ? await loadProxySession(env, sessionCookie) : null;

  if (!session) {
    // Hash fragment'ta token gelmiş olabilir — JS bridge ile ?t='e çevir
    return hashToQueryBridge();
  }

  // 3. target_host session'dan (cross-publisher atlayışını engellemek için
  // URL query'deki ?tgt göz ardı edilir). Upstream'e proxy et.
  return await proxyToUpstream(env, session, sessionCookie, request, proxyHost);
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

  // tgt claim'i token içinde — query'deki ?tgt ile eşleşmeli (tampering guard)
  const encodedTgt = payload.tgt;
  if (!encodedTgt || !isValidEncodedHost(encodedTgt)) {
    return htmlError(400, 'Token hedef host bilgisi geçersiz.');
  }
  const tgtFromQuery = url.searchParams.get('tgt');
  if (tgtFromQuery && tgtFromQuery !== encodedTgt) {
    return htmlError(400, 'Token ve URL hedef host tutarsız.');
  }
  const targetHost = decodeHost(encodedTgt);

  // jti tek kullanımlık — RATE_LIMIT_KV'da daha önce harcandı mı?
  const jtiKey = `ra:jti:${payload.jti}`;
  const existing = await env.RATE_LIMIT_KV.get(jtiKey);
  if (existing === 'used') {
    return htmlError(401, 'Bu oturum linki zaten kullanılmış. Lütfen tekrar erişim isteyin.');
  }
  await env.RATE_LIMIT_KV.put(jtiKey, 'used', { expirationTtl: 600 });

  // Session oluştur (random id, KV'da)
  const sid = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const session = {
    user_id: payload.sub,           // INTEGER
    institution_id: payload.iid,    // INTEGER
    subscription_id: payload.sid,   // INTEGER
    product_slug: payload.pid,      // TEXT
    target_host: targetHost,        // örn. www.jove.com
    created_at: now,
    expires_at: now + SESSION_TTL_SEC,
  };
  await env.RA_UPSTREAM_SESSIONS.put(
    `proxysess:${sid}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SEC }
  );

  // 302 clean URL — ?t ve ?tgt çıkarılır, landing path varsa origin
  // üzerinde belirtilen ilk path'e yönlendirilir (Pangram için '/login' gibi).
  const clean = new URL(url);
  clean.searchParams.delete('t');
  clean.searchParams.delete('tgt');

  const landing = normalizeLandingPath(payload.lp);
  if (landing && landing !== '/') {
    // landing zaten '/'la başlar, pathname + opsiyonel querystring olabilir.
    const qIdx = landing.indexOf('?');
    if (qIdx >= 0) {
      clean.pathname = landing.slice(0, qIdx) || '/';
      // JWT'den gelen querystring'i mevcut query ile birleştir (override).
      const extra = new URLSearchParams(landing.slice(qIdx + 1));
      for (const [k, v] of extra) clean.searchParams.set(k, v);
    } else {
      clean.pathname = landing;
    }
  } else if (!clean.pathname || clean.pathname === '') {
    clean.pathname = '/';
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: clean.toString(),
      'Set-Cookie': buildSessionCookie(sid, url.hostname),
    },
  });
}

function normalizeLandingPath(raw) {
  if (!raw) return '/';
  const trimmed = String(raw).trim();
  if (!trimmed) return '/';
  if (/^[a-z]+:\/\//i.test(trimmed)) return '/';
  if (trimmed.includes('..')) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Hash fragment bridge — tarayıcıda JS'le #t=... → ?t='e çevir
// ──────────────────────────────────────────────────────────────────────────
function hashToQueryBridge() {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Yönlendiriliyor…</title></head><body>
<script>
(function () {
  var h = window.location.hash || '';
  var m = h.match(/[#&]t=([^&]+)/);
  if (!m) {
    document.body.innerText = 'Oturum bilgisi eksik — portal üzerinden tekrar erişin.';
    return;
  }
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
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, private',
    },
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
  // Host-only cookie daha güvenli ve tarayıcılar arasında daha tutarlı.
  // Domain belirtmeyince cookie yalnızca mevcut proxy host'u için geçerli olur.
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
    `Path=/; HttpOnly; Secure; SameSite=Lax; ` +
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
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, private',
    },
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
