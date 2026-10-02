import { describe, expect, it } from 'vitest';
import { assistantUsageScopeState, assistantUsageScopeStateKey } from '../../backend/src/assistant/usage-scope-state.js';

function kv(value = null, throws = false) {
  return {
    async get() { if (throws) throw new Error('kv down'); return value; },
    async put() {}
  };
}

describe('Assistant usage-scope state', () => {
  const scope = { type: 'institution', id: '42' };

  it('defaults a valid scope to active when no runtime state exists', async () => {
    await expect(assistantUsageScopeState({ RATE_LIMIT_KV: kv(null) }, scope))
      .resolves.toMatchObject({ active: true, state: 'active', source: 'default' });
  });

  it('reads paused and active runtime states', async () => {
    await expect(assistantUsageScopeState({ RATE_LIMIT_KV: kv('paused') }, scope))
      .resolves.toMatchObject({ active: false, state: 'paused', reason: 'ASSISTANT_USAGE_SCOPE_PAUSED' });
    await expect(assistantUsageScopeState({ RATE_LIMIT_KV: kv('active') }, scope))
      .resolves.toMatchObject({ active: true, state: 'active', source: 'runtime' });
  });

  it('fails closed for missing store, invalid state, read failure, or invalid scope', async () => {
    await expect(assistantUsageScopeState({}, scope)).resolves.toMatchObject({ active: false, reason: 'USAGE_SCOPE_STATE_STORE_UNAVAILABLE' });
    await expect(assistantUsageScopeState({ RATE_LIMIT_KV: kv('maybe') }, scope)).resolves.toMatchObject({ active: false, reason: 'USAGE_SCOPE_STATE_INVALID' });
    await expect(assistantUsageScopeState({ RATE_LIMIT_KV: kv(null, true) }, scope)).resolves.toMatchObject({ active: false, reason: 'USAGE_SCOPE_STATE_STORE_READ_FAILED' });
    await expect(assistantUsageScopeState({ RATE_LIMIT_KV: kv(null) }, null)).resolves.toMatchObject({ active: false, reason: 'USAGE_SCOPE_REQUIRED' });
  });

  it('uses content-free scope keys', () => {
    expect(assistantUsageScopeStateKey({ type: 'user', id: '7' })).toBe('assistant:usage-scope:state:user:7');
  });
});
