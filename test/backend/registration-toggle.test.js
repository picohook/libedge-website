import { describe, expect, it, vi } from 'vitest';
import { registrationState, setRegistrationEnabled, REGISTRATION_DISABLED_KEY } from '../../backend/src/auth/registration-toggle.js';

function kv(initial = null) {
  let value = initial;
  return {
    get: vi.fn(async (key) => key === REGISTRATION_DISABLED_KEY ? value : null),
    put: vi.fn(async (key, next) => { if (key === REGISTRATION_DISABLED_KEY) value = next; }),
  };
}

describe('registration runtime toggle', () => {
  it('defaults fail-open when KV is unavailable', async () => {
    await expect(registrationState({})).resolves.toMatchObject({ enabled: true, reason: 'STORE_UNAVAILABLE' });
    await expect(registrationState({ RATE_LIMIT_KV: { get: async () => { throw new Error('down'); } } }))
      .resolves.toMatchObject({ enabled: true, reason: 'STORE_READ_FAILED' });
  });

  it('disables only for an explicit disabled value', async () => {
    await expect(registrationState({ RATE_LIMIT_KV: kv('true') })).resolves.toMatchObject({ enabled: false });
    await expect(registrationState({ RATE_LIMIT_KV: kv(null) })).resolves.toMatchObject({ enabled: true });
  });

  it('writes enabled and disabled states', async () => {
    const store = kv();
    await setRegistrationEnabled({ RATE_LIMIT_KV: store }, false);
    await expect(registrationState({ RATE_LIMIT_KV: store })).resolves.toMatchObject({ enabled: false });
    await setRegistrationEnabled({ RATE_LIMIT_KV: store }, true);
    await expect(registrationState({ RATE_LIMIT_KV: store })).resolves.toMatchObject({ enabled: true });
  });
});
