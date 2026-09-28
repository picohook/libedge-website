import { describe, expect, it, vi } from 'vitest';
import { SUPPORT_CHECK_PAUSE_KEY, supportCheckRuntimePause } from '../../backend/src/assistant/support-check-runtime-pause.js';

describe('supportCheck runtime pause', () => {
  it('fails closed without the KV binding', async () => {
    await expect(supportCheckRuntimePause({})).resolves.toEqual({ paused: true, reason: 'PAUSE_STORE_UNAVAILABLE' });
  });
  it('fails closed when pause state is unset', async () => {
    const get = vi.fn().mockResolvedValue(null);
    await expect(supportCheckRuntimePause({ RATE_LIMIT_KV: { get } })).resolves.toEqual({ paused: true, reason: 'PAUSE_STATE_UNSET' });
    expect(get).toHaveBeenCalledWith(SUPPORT_CHECK_PAUSE_KEY);
  });
  it('resumes only on an explicit resume value', async () => {
    for (const value of ['false', '0', 'resume']) {
      await expect(supportCheckRuntimePause({ RATE_LIMIT_KV: { get: vi.fn().mockResolvedValue(value) } }))
        .resolves.toEqual({ paused: false, reason: null });
    }
  });
  it('treats every other stored value as paused', async () => {
    await expect(supportCheckRuntimePause({ RATE_LIMIT_KV: { get: vi.fn().mockResolvedValue('true') } }))
      .resolves.toEqual({ paused: true, reason: 'OPERATIONALLY_PAUSED' });
  });
  it('fails closed on KV read errors', async () => {
    await expect(supportCheckRuntimePause({ RATE_LIMIT_KV: { get: vi.fn().mockRejectedValue(new Error('kv down')) } }))
      .resolves.toEqual({ paused: true, reason: 'PAUSE_STORE_READ_FAILED' });
  });
});
