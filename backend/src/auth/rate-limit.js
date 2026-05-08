// Fixed-window rate limiting via Cloudflare KV (RATE_LIMIT_KV binding).
// KV is shared across Worker instances.
export async function checkRateLimit(kv, endpoint, identifier, maxRequests = 10, windowSeconds = 300, options = {}) {
  const failClosed = options.failClosed === true;
  const now = Date.now();

  if (!kv) {
    if (failClosed) {
      console.error('RATE_LIMIT_KV binding missing on protected endpoint', endpoint);
      return {
        isLimited: true,
        remaining: 0,
        resetTime: now + windowSeconds * 1000
      };
    }
    return {
      isLimited: false,
      remaining: maxRequests,
      resetTime: now + windowSeconds * 1000
    };
  }

  const safeEndpoint = String(endpoint || 'unknown').trim().toLowerCase();
  const safeIdentifier = String(identifier || 'anonymous').trim().toLowerCase();
  const key = `rate:${safeEndpoint}:${safeIdentifier}`;

  try {
    const raw = await kv.get(key);
    let record = raw ? JSON.parse(raw) : null;

    if (!record || now > Number(record.resetTime || 0)) {
      record = {
        count: 1,
        resetTime: now + windowSeconds * 1000
      };
    } else {
      record.count += 1;
    }

    await kv.put(key, JSON.stringify(record), {
      expirationTtl: windowSeconds
    });

    return {
      isLimited: record.count > maxRequests,
      remaining: Math.max(0, maxRequests - record.count),
      resetTime: record.resetTime
    };
  } catch (err) {
    if (failClosed) {
      console.error('rate limit failed closed', err);
      return {
        isLimited: true,
        remaining: 0,
        resetTime: now + windowSeconds * 1000
      };
    }
    console.warn('rate limit failed open', err);
    return {
      isLimited: false,
      remaining: maxRequests,
      resetTime: now + windowSeconds * 1000
    };
  }
}

export function isStrictRateLimitEnv(env = {}) {
  const value = String(env.ENVIRONMENT || '').trim().toLowerCase();
  return value === 'production' || value === 'staging';
}

export function checkProtectedRateLimit(c, endpoint, identifier, maxRequests = 10, windowSeconds = 300) {
  return checkRateLimit(c.env.RATE_LIMIT_KV, endpoint, identifier, maxRequests, windowSeconds, {
    failClosed: isStrictRateLimitEnv(c.env)
  });
}
