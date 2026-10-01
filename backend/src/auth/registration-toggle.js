export const REGISTRATION_DISABLED_KEY = 'auth:registration:disabled';

export async function registrationState(env) {
  if (!env?.RATE_LIMIT_KV) return { enabled: true, reason: 'STORE_UNAVAILABLE' };
  try {
    const raw = await env.RATE_LIMIT_KV.get(REGISTRATION_DISABLED_KEY);
    const value = String(raw || '').trim().toLowerCase();
    const disabled = value === 'true' || value === '1' || value === 'disabled';
    return { enabled: !disabled, reason: disabled ? 'OPERATIONALLY_DISABLED' : null };
  } catch {
    return { enabled: true, reason: 'STORE_READ_FAILED' };
  }
}

export async function setRegistrationEnabled(env, enabled) {
  if (!env?.RATE_LIMIT_KV) throw new Error('Registration state store unavailable');
  await env.RATE_LIMIT_KV.put(REGISTRATION_DISABLED_KEY, enabled ? 'false' : 'true');
  return { enabled: Boolean(enabled) };
}
