const DEFAULT_WINDOW_SEC = 60;
const DEFAULT_SESSION_RPM = 300;
const DEFAULT_INSTITUTION_RPM = 5000;

export async function enforceProxyRateLimit(env, sessionId, session = {}) {
  if (!env?.RATE_LIMIT_KV || String(env.RA_PROXY_RATE_LIMIT_ENABLED || '1') === '0') {
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
