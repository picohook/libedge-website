export const SUPPORT_CHECK_PAUSE_KEY = 'assistant:supportcheck:paused';

export async function supportCheckRuntimePause(env) {
  if (!env?.RATE_LIMIT_KV) return { paused: true, reason: 'PAUSE_STORE_UNAVAILABLE' };
  try {
    const raw = await env.RATE_LIMIT_KV.get(SUPPORT_CHECK_PAUSE_KEY);
    const value = String(raw || '').trim().toLowerCase();
    if (value === 'false' || value === '0' || value === 'resume') {
      return { paused: false, reason: null };
    }
    return { paused: true, reason: value ? 'OPERATIONALLY_PAUSED' : 'PAUSE_STATE_UNSET' };
  } catch {
    return { paused: true, reason: 'PAUSE_STORE_READ_FAILED' };
  }
}
