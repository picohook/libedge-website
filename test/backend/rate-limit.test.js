import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../../backend/src/index.js';

/**
 * Minimal in-memory KV compatible with the ~2-method surface
 * checkRateLimit actually uses: .get(key) and .put(key, value, opts).
 * TTL is stored but only used for assertions; the KV is recreated for
 * each test so expiry is not exercised here.
 */
function memoryKV() {
  const store = new Map();
  return {
    store,
    async get(k) {
      return store.has(k) ? store.get(k).value : null;
    },
    async put(k, v, opts = {}) {
      store.set(k, { value: v, expirationTtl: opts.expirationTtl });
    },
  };
}

describe('checkRateLimit', () => {
  let kv;

  beforeEach(() => {
    kv = memoryKV();
  });

  it('allows the first N requests then flags limited', async () => {
    const endpoint = 'login:ip';
    const id = '1.2.3.4';
    const max = 3;
    const window_ = 60;

    const r1 = await checkRateLimit(kv, endpoint, id, max, window_);
    const r2 = await checkRateLimit(kv, endpoint, id, max, window_);
    const r3 = await checkRateLimit(kv, endpoint, id, max, window_);
    const r4 = await checkRateLimit(kv, endpoint, id, max, window_);

    expect(r1.isLimited).toBe(false);
    expect(r2.isLimited).toBe(false);
    expect(r3.isLimited).toBe(false);
    expect(r4.isLimited).toBe(true);

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
    expect(r4.remaining).toBe(0);
  });

  it('tracks separate buckets per (endpoint, identifier)', async () => {
    await checkRateLimit(kv, 'login:ip', 'a', 2, 60);
    await checkRateLimit(kv, 'login:ip', 'a', 2, 60);
    const overA = await checkRateLimit(kv, 'login:ip', 'a', 2, 60);
    expect(overA.isLimited).toBe(true);

    // different identifier, same endpoint — fresh bucket
    const firstB = await checkRateLimit(kv, 'login:ip', 'b', 2, 60);
    expect(firstB.isLimited).toBe(false);

    // different endpoint, same identifier — fresh bucket
    const firstRegister = await checkRateLimit(kv, 'register:ip', 'a', 2, 60);
    expect(firstRegister.isLimited).toBe(false);
  });

  it('resets the window after resetTime has passed', async () => {
    // Seed the KV with an already-expired record.
    await kv.put(
      'rate:login:ip:1.2.3.4',
      JSON.stringify({ count: 99, resetTime: Date.now() - 1000 }),
      {}
    );
    const result = await checkRateLimit(kv, 'login:ip', '1.2.3.4', 5, 60);
    expect(result.isLimited).toBe(false);
    expect(result.remaining).toBe(4);
  });

  it('fails open when KV binding is missing', async () => {
    const result = await checkRateLimit(undefined, 'login:ip', '1.2.3.4', 5, 60);
    expect(result.isLimited).toBe(false);
    expect(result.remaining).toBe(5);
  });

  it('normalises identifier case and whitespace to avoid trivial bypass', async () => {
    await checkRateLimit(kv, 'login:ip', '  1.2.3.4  ', 1, 60);
    const second = await checkRateLimit(kv, 'LOGIN:ip', '1.2.3.4', 1, 60);
    expect(second.isLimited).toBe(true);
  });
});
