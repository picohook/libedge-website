import { describe, expect, it, vi } from 'vitest';
import {
  reserveSupportCheckInvocation,
  supportCheckInvocationKey
} from '../../backend/src/assistant/support-check-invocation-budget.js';

function kv(initial = null, { getError = false, putError = false } = {}) {
  let value = initial;
  return {
    get: vi.fn(async () => {
      if (getError) throw new Error('read failed');
      return value;
    }),
    put: vi.fn(async (_key, next) => {
      if (putError) throw new Error('write failed');
      value = next;
    })
  };
}

describe('supportCheck invocation budget', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');

  it('uses a content-free UTC daily key', () => {
    expect(supportCheckInvocationKey(now)).toBe('assistant:supportcheck:invocations:2026-09-28');
  });

  it('fails closed when limit is missing/invalid or KV is unavailable', async () => {
    await expect(reserveSupportCheckInvocation({ RATE_LIMIT_KV: kv() }, now))
      .resolves.toMatchObject({ allowed: false, reason: 'INVOCATION_LIMIT_REQUIRED' });
    await expect(reserveSupportCheckInvocation({
      RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT: '10'
    }, now)).resolves.toMatchObject({ allowed: false, reason: 'INVOCATION_BUDGET_STORE_UNAVAILABLE' });
  });

  it('reserves one attempted invocation before transport', async () => {
    const store = kv('3');
    const result = await reserveSupportCheckInvocation({
      RATE_LIMIT_KV: store,
      RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT: '10'
    }, now);
    expect(result).toMatchObject({ allowed: true, limit: 10, used: 4 });
    expect(store.put).toHaveBeenCalledTimes(1);
    expect(store.put.mock.calls[0][0]).toBe('assistant:supportcheck:invocations:2026-09-28');
    expect(store.put.mock.calls[0][1]).toBe('4');
  });

  it('fails closed at the daily limit without incrementing', async () => {
    const store = kv('10');
    const result = await reserveSupportCheckInvocation({
      RATE_LIMIT_KV: store,
      RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT: '10'
    }, now);
    expect(result).toMatchObject({ allowed: false, reason: 'INVOCATION_BUDGET_EXHAUSTED', used: 10 });
    expect(store.put).not.toHaveBeenCalled();
  });

  it('fails closed on KV read or write failure', async () => {
    for (const store of [kv(null, { getError: true }), kv('0', { putError: true })]) {
      const result = await reserveSupportCheckInvocation({
        RATE_LIMIT_KV: store,
        RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT: '10'
      }, now);
      expect(result).toMatchObject({ allowed: false, reason: 'INVOCATION_BUDGET_STORE_FAILED' });
    }
  });
});
