import { describe, expect, it } from 'vitest';
import {
  assistantUsageScopeKey,
  assistantUsageScopeLimit,
  reserveAssistantUsageScopeRequest,
  resolveAssistantUsageScope,
  USAGE_SCOPE_DAILY_LIMIT_KEY,
  assistantUsageScopeLimitOverrideKey
} from '../../backend/src/assistant/usage-scope-quota.js';

function kv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); }
  };
}

function enabledEnv(store = kv(), limit = '3') {
  return {
    RESEARCH_ASSISTANT_USAGE_SCOPE_QUOTA_ENABLED: 'true',
    RESEARCH_ASSISTANT_USAGE_SCOPE_DAILY_REQUEST_LIMIT: limit,
    RATE_LIMIT_KV: store
  };
}

describe('Assistant usage-scope shared request pool', () => {
  it('resolves institution scope first and falls back to a B2C user scope', () => {
    expect(resolveAssistantUsageScope({ user_id: 7, institution_id: 42 })).toEqual({ type: 'institution', id: '42' });
    expect(resolveAssistantUsageScope({ user_id: 7, institution_id: null })).toEqual({ type: 'user', id: '7' });
  });

  it('lets two institution users consume the same shared pool without per-user allocation', async () => {
    const store = kv();
    const env = enabledEnv(store, '2');
    const now = new Date('2026-10-02T10:00:00Z');

    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 1, institution_id: 9 }, now)).allowed).toBe(true);
    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 2, institution_id: 9 }, now)).allowed).toBe(true);
    const third = await reserveAssistantUsageScopeRequest(env, { user_id: 1, institution_id: 9 }, now);

    expect(third).toMatchObject({ allowed: false, reason: 'ASSISTANT_USAGE_SCOPE_QUOTA_EXHAUSTED', used: 2 });
    expect(store.store.get(assistantUsageScopeKey({ type: 'institution', id: '9' }, now))).toBe('2');
  });

  it('keeps different institutions in different pools', async () => {
    const store = kv();
    const env = enabledEnv(store, '1');
    const now = new Date('2026-10-02T10:00:00Z');

    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 1, institution_id: 9 }, now)).allowed).toBe(true);
    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 2, institution_id: 10 }, now)).allowed).toBe(true);
  });

  it('gives B2C users separate user-scoped pools', async () => {
    const store = kv();
    const env = enabledEnv(store, '1');
    const now = new Date('2026-10-02T10:00:00Z');

    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 1 }, now)).allowed).toBe(true);
    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 2 }, now)).allowed).toBe(true);
    expect((await reserveAssistantUsageScopeRequest(env, { user_id: 1 }, now)).reason).toBe('ASSISTANT_USAGE_SCOPE_QUOTA_EXHAUSTED');
  });

  it('prefers a scope-specific override over the runtime default and env fallback', async () => {
    const scope = { type: 'institution', id: '42' };
    const runtime = kv({
      [USAGE_SCOPE_DAILY_LIMIT_KEY]: '7',
      [assistantUsageScopeLimitOverrideKey(scope)]: '11'
    });
    await expect(assistantUsageScopeLimit(enabledEnv(runtime, '3'), scope)).resolves.toMatchObject({
      enabled: true, limit: 11, source: 'scope-runtime'
    });
  });

  it('uses a valid runtime override and fails safely on an invalid runtime value', async () => {
    const runtime = kv({ [USAGE_SCOPE_DAILY_LIMIT_KEY]: '7' });
    await expect(assistantUsageScopeLimit(enabledEnv(runtime, '3'))).resolves.toMatchObject({ enabled: true, limit: 7, source: 'runtime' });

    runtime.store.set(USAGE_SCOPE_DAILY_LIMIT_KEY, 'bad');
    await expect(assistantUsageScopeLimit(enabledEnv(runtime, '3'))).resolves.toMatchObject({ enabled: true, limit: null, source: 'runtime', reason: 'USAGE_SCOPE_LIMIT_INVALID' });
  });

  it('is dormant unless explicitly enabled, preserving current production behavior on merge', async () => {
    await expect(reserveAssistantUsageScopeRequest({}, { user_id: 1 })).resolves.toMatchObject({ allowed: true, enabled: false });
  });
});
