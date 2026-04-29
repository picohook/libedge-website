const DEFAULT_WINDOW_SEC = 60;
const DEFAULT_SESSION_RPM = 300;
const DEFAULT_INSTITUTION_RPM = 5000;

// Static asset path/extensions — proxy bunlar için rate-limit KV yazmaz.
// Bir sayfa açılışında 50-200 asset isteği olabilir; bunlar KV write quota'sını
// hızla tüketiyordu (Cloudflare free tier: 1000 write/day). Asset'ler abonelik
// kontrolünden geçti, kötüye kullanım riski düşük.
const STATIC_ASSET_EXTENSIONS = new Set([
  // styles & scripts
  'css', 'js', 'mjs', 'map',
  // fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // images
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif', 'bmp',
  // media
  'mp4', 'webm', 'mp3', 'ogg', 'wav', 'm4a', 'm4v', 'mov',
  // documents/data binary
  'pdf', 'zip', 'gz', 'br',
]);

const STATIC_ASSET_PATH_PREFIXES = [
  '/_next/static/',
  '/_next/image',
  '/_next/data/',
  '/_nuxt/',
  '/static/',
  '/assets/',
  '/dist/',
  '/build/',
  '/wp-content/',
  '/wp-includes/',
];

export function isStaticAssetPath(pathname) {
  if (!pathname) return false;
  const lower = pathname.toLowerCase();
  if (lower === '/favicon.ico' || lower === '/robots.txt') return true;
  for (const prefix of STATIC_ASSET_PATH_PREFIXES) {
    if (lower.startsWith(prefix)) return true;
  }
  // Last path segment extension check
  const lastSlash = lower.lastIndexOf('/');
  const last = lastSlash >= 0 ? lower.slice(lastSlash + 1) : lower;
  // Strip query if present (defensive — pathname'de ?query olmaz ama emin olalım)
  const dotIdx = last.lastIndexOf('.');
  if (dotIdx <= 0) return false;
  const ext = last.slice(dotIdx + 1);
  return STATIC_ASSET_EXTENSIONS.has(ext);
}

export async function enforceProxyRateLimit(env, sessionId, session = {}, pathname = '') {
  if (!env?.RATE_LIMIT_KV || String(env.RA_PROXY_RATE_LIMIT_ENABLED || '1') === '0') {
    return null;
  }

  // Static asset'ler için rate-limit'i atla — KV write maliyeti tasarrufu.
  // Bir publisher sayfası ortalama 50-200 asset isteği üretir; bunların her
  // birinde KV.put çağırmak quota'yı çabuk tüketiyordu.
  if (isStaticAssetPath(pathname)) {
    return null;
  }

  const windowSec = readPositiveInt(env.RA_PROXY_RATE_WINDOW_SEC, DEFAULT_WINDOW_SEC);
  const checks = [
    {
      scope: 'session',
      id: sessionId,
      max: readPositiveInt(env.RA_PROXY_SESSION_RPM, DEFAULT_SESSION_RPM),
    },
    {
      scope: 'institution',
      id: session.institution_id,
      max: readPositiveInt(env.RA_PROXY_INSTITUTION_RPM, DEFAULT_INSTITUTION_RPM),
    },
  ];

  for (const check of checks) {
    if (!check.id) continue;
    const result = await checkFixedWindowLimit(
      env.RATE_LIMIT_KV,
      `ra:proxy:${check.scope}`,
      String(check.id),
      check.max,
      windowSec
    );
    if (result.isLimited) {
      return { ...result, scope: check.scope };
    }
  }

  return null;
}

export async function checkFixedWindowLimit(kv, prefix, identifier, maxRequests, windowSec, nowSec = null) {
  if (!kv) return { isLimited: false, remaining: maxRequests, retryAfter: 0 };

  const now = Number.isFinite(nowSec) ? Math.floor(nowSec) : Math.floor(Date.now() / 1000);
  const safeWindow = Math.max(1, Math.floor(windowSec || DEFAULT_WINDOW_SEC));
  const safeMax = Math.max(1, Math.floor(maxRequests || DEFAULT_SESSION_RPM));
  const windowStart = Math.floor(now / safeWindow) * safeWindow;
  const retryAfter = Math.max(1, windowStart + safeWindow - now);
  const key = `${prefix}:${hashIdentifier(identifier)}:${windowStart}`;

  let count = 0;
  try {
    const raw = await kv.get(key);
    count = Math.max(0, Number(raw || 0)) + 1;
    await kv.put(key, String(count), { expirationTtl: safeWindow + 30 });
  } catch (err) {
    console.warn('proxy rate limit failed open', err);
    return { isLimited: false, remaining: safeMax, retryAfter: 0 };
  }

  return {
    isLimited: count > safeMax,
    remaining: Math.max(0, safeMax - count),
    retryAfter,
  };
}

function readPositiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function hashIdentifier(value) {
  let hash = 5381;
  const s = String(value || '');
  for (let i = 0; i < s.length; i += 1) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
