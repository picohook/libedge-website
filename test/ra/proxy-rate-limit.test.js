import { describe, it, expect } from 'vitest';
import { checkFixedWindowLimit, enforceProxyRateLimit } from '../../workers/proxy/src/rate-limit.js';

function memoryKV() {
  const map = new Map();
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async put(key, value) {
      map.set(key, value);
    },
  };
}

describe('proxy rate limiting', () => {
  it('limits after the configured fixed-window count', async () => {
    const kv = memoryKV();
    const first = await checkFixedWindowLimit(kv, 'p', 'session-a', 2, 60, 100);
    const second = await checkFixedWindowLimit(kv, 'p', 'session-a', 2, 60, 101);
    const third = await checkFixedWindowLimit(kv, 'p', 'session-a', 2, 60, 102);

    expect(first.isLimited).toBe(false);
    expect(second.isLimited).toBe(false);
    expect(third.isLimited).toBe(true);
    expect(third.retryAfter).toBe(18);
  });

  it('checks session before institution', async () => {
    const env = {
      RATE_LIMIT_KV: memoryKV(),
      RA_PROXY_SESSION_RPM: 1,
      RA_PROXY_INSTITUTION_RPM: 100,
      RA_PROXY_RATE_WINDOW_SEC: 60,
    };

    expect(await enforceProxyRateLimit(env, 'sid', { institution_id: 7 })).toBeNull();
    const limited = await enforceProxyRateLimit(env, 'sid', { institution_id: 7 });

    expect(limited.scope).toBe('session');
    expect(limited.isLimited).toBe(true);
  });

  it('fails open when KV is unavailable', async () => {
    const env = { RATE_LIMIT_KV: null };
    expect(await enforceProxyRateLimit(env, 'sid', { institution_id: 7 })).toBeNull();
  });
});
