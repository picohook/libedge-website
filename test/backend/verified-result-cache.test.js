import { describe, expect, it, vi } from 'vitest';
import { readVerifiedResultCache, verifiedResultCacheEnabled, verifiedResultCacheKey, writeVerifiedResultCache } from '../../backend/src/assistant/verified-result-cache.js';

function kv() {
  const store = new Map();
  return { store, get: vi.fn(async (key) => store.get(key) ?? null), put: vi.fn(async (key, value) => { store.set(key, value); }) };
}

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
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'prod', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'production', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'PRODUCTION', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
  });
});

describe('verified-result cache store', () => {
  it('does not touch KV in production even when the feature flag is true', async () => {
    const store = kv();
    const env = { ENVIRONMENT: 'production', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' };
    expect(await readVerifiedResultCache({ env, identity: 'identity' })).toEqual({ hit: false, result: null });
    expect(await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } })).toBe(false);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it('uses an opaque digest key/value identity and a 24 hour TTL when enabled', async () => {
    const store = kv();
    const env = { ENVIRONMENT: 'staging', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' };
    const identity = 'canonical identity containing user scope and query digest';
    expect(await writeVerifiedResultCache({ env, identity, result: { ok: true } })).toBe(true);
    const [key, value, options] = store.put.mock.calls[0];
    expect(key).toBe(await verifiedResultCacheKey(identity));
    expect(key).not.toContain(identity);
    expect(value).not.toContain(identity);
    expect(JSON.parse(value).identity_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(options).toEqual({ expirationTtl: 86400 });
    expect(await readVerifiedResultCache({ env, identity })).toEqual({ hit: true, result: { ok: true } });
  });

  it('caps configured TTL at 24 hours', async () => {
    const store = kv();
    const env = { ENVIRONMENT: 'local', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true', RESEARCH_VERIFIED_RESULT_CACHE_TTL_SECONDS: '172800' };
    await writeVerifiedResultCache({ env, identity: 'identity', result: { ok: true } });
    expect(store.put.mock.calls[0][2]).toEqual({ expirationTtl: 86400 });
  });

  it('fails closed to MISS for corrupt or mismatched payloads and store errors', async () => {
    const store = kv();
    const env = { ENVIRONMENT: 'staging', RATE_LIMIT_KV: store, RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' };
    const key = await verifiedResultCacheKey('identity');
    store.store.set(key, '{bad json');
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    store.store.set(key, JSON.stringify({ schema_version: 'verified-result-v1', identity_digest: '0'.repeat(64), result: { ok: true } }));
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
    store.get.mockRejectedValueOnce(new Error('kv down'));
    expect((await readVerifiedResultCache({ env, identity: 'identity' })).hit).toBe(false);
  });
});
