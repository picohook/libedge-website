import { describe, expect, it, vi } from 'vitest';
import { readVerifiedResultCache, verifiedResultCacheEnabled, verifiedResultCacheKey, writeVerifiedResultCache } from '../../backend/src/assistant/verified-result-cache.js';

function kv() {
  const store = new Map();
  return { store, get: vi.fn(async (key) => store.get(key) ?? null), put: vi.fn(async (key, value) => { store.set(key, value); }) };
}
const secret = 'test-only-cache-hmac-secret';
const enabledEnv = (store, extra = {}) => ({ ENVIRONMENT: 'staging', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true', RESEARCH_VERIFIED_RESULT_CACHE_HMAC_SECRET: secret, ...extra });

describe('verified-result cache production guard', () => {
  it('is disabled by default', () => {
    expect(verifiedResultCacheEnabled({})).toBe(false);
  });
  it('can be explicitly enabled only in staging/local', () => {
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'staging', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(true);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'local', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(true);
  });
  it('fails closed for production, missing and unknown environments even when the flag is true', () => {
    expect(verifiedResultCacheEnabled({ RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    for (const ENVIRONMENT of ['prod', 'production', 'PRODUCTION', 'unknown']) {
      expect(verifiedResultCacheEnabled({ ENVIRONMENT, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    }
  });
});

describe('verified-result cache store', () => {
  it('does not touch KV in production even when the feature flag is true', async () => {
    const store = kv();
    const env = { ENVIRONMENT: 'production', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true', RESEARCH_VERIFIED_RESULT_CACHE_HMAC_SECRET: secret };
    expect(await readVerifiedResultCache({ env, identity: 'identity' })).toEqual({ hit: false, result: null });
    expect(await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } })).toBe(false);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });
  it('fails closed without the server-side HMAC secret', async () => {
    const store = kv();
    const env = { ENVIRONMENT: 'staging', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' };
    expect(await verifiedResultCacheKey('identity', env)).toBeNull();
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    expect(await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } })).toBe(false);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });
  it('uses an opaque HMAC key/value identity and a 15 minute TTL when enabled', async () => {
    const store = kv();
    const env = enabledEnv(store);
    const identity = 'canonical identity containing user scope and query digest';
    expect(await writeVerifiedResultCache({ env, identity, result: { ok: true } })).toBe(true);
    const [key, value, options] = store.put.mock.calls[0];
    expect(key).toBe(await verifiedResultCacheKey(identity, env));
    expect(key).not.toContain(identity);
    expect(value).not.toContain(identity);
    expect(JSON.parse(value).identity_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(options).toEqual({ expirationTtl: 900 });
    expect(await readVerifiedResultCache({ env, identity })).toEqual({ hit: true, result: { ok: true } });
  });
  it('binds the key to the server-side secret', async () => {
    const store = kv();
    const first = await verifiedResultCacheKey('identity', enabledEnv(store));
    const second = await verifiedResultCacheKey('identity', enabledEnv(store, { RESEARCH_VERIFIED_RESULT_CACHE_HMAC_SECRET: 'different-secret' }));
    expect(first).not.toBe(second);
  });
  it('caps configured TTL at 15 minutes', async () => {
    const store = kv();
    const env = enabledEnv(store, { RESEARCH_VERIFIED_RESULT_CACHE_TTL_SECONDS: '86400' });
    await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } });
    expect(store.put.mock.calls[0][2]).toEqual({ expirationTtl: 900 });
  });
  it('fails closed to MISS for corrupt or mismatched payloads and store errors', async () => {
    const store = kv();
    const env = enabledEnv(store);
    const key = await verifiedResultCacheKey('identity', env);
    store.store.set(key, '{bad json');
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    store.store.set(key, JSON.stringify({ schema_version: 'verified-result-v1', identity_digest: '0'.repeat(64), result: { ok: true } }));
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    store.get.mockRejectedValueOnce(new Error('kv down'));
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
  });
});
