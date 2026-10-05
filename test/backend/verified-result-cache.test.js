import { describe, expect, it, vi } from 'vitest';
import { readVerifiedResultCache, verifiedResultCacheKey, writeVerifiedResultCache } from '../../backend/src/assistant/verified-result-cache.js';

function kv() {
  const store = new Map();
  return { store, get: vi.fn(async (key) => store.get(key) ?? null), put: vi.fn(async (key, value) => { store.set(key, value); }) };
}

describe('verified-result cache store', () => {
  it('is disabled by default', async () => {
    const store = kv();
    const env = { RATE_LIMIT_KV: store };
    expect(await readVerifiedResultCache({ env, identity: 'identity' })).toEqual({ hit: false, result: null });
    expect(await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } })).toBe(false);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it('uses an opaque digest key and a 24 hour TTL when enabled', async () => {
    const store = kv();
    const env = { RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' };
    const identity = 'canonical identity containing no raw query';
    expect(await writeVerifiedResultCache({ env, identity, result: { ok: true } })).toBe(true);
    const [key, , options] = store.put.mock.calls[0];
    expect(key).toBe(`research:verified-result:v1:${await verifiedResultCacheKey(identity)}`);
    expect(key).not.toContain(identity);
    expect(options).toEqual({ expirationTtl: 86400 });
    expect(await readVerifiedResultCache({ env, identity })).toEqual({ hit: true, result: { ok: true } });
  });

  it('caps configured TTL at 24 hours', async () => {
    const store = kv();
    const env = { RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true', RESEARCH_VERIFIED_RESULT_CACHE_TTL_SECONDS: '172800' };
    await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } });
    expect(store.put.mock.calls[0][2]).toEqual({ expirationTtl: 86400 });
  });

  it('fails closed to MISS for corrupt or mismatched payloads and store errors', async () => {
    const store = kv();
    const env = { RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' };
    const key = `research:verified-result:v1:${await verifiedResultCacheKey('identity')}`;
    store.store.set(key, '{bad json');
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    store.store.set(key, JSON.stringify({ schema_version: 'verified-result-v1', identity: 'other', result: { ok: true } }));
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    store.get.mockRejectedValueOnce(new Error('kv down'));
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
  });
});
