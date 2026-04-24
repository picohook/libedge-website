import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  timingSafeEqual,
} from '../../backend/src/index.js';

describe('hashPassword / verifyPassword (PBKDF2)', () => {
  it('accepts a correct password', async () => {
    const stored = await hashPassword('hunter2');
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    const result = await verifyPassword('hunter2', stored);
    expect(result).toEqual({ matched: true, legacy: false });
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('hunter2');
    const result = await verifyPassword('not-it', stored);
    expect(result).toEqual({ matched: false, legacy: false });
  });

  it('produces different hashes for the same input (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect((await verifyPassword('same', a)).matched).toBe(true);
    expect((await verifyPassword('same', b)).matched).toBe(true);
  });

  it('handles empty / non-string stored hash safely', async () => {
    expect(await verifyPassword('x', null)).toEqual({ matched: false, legacy: false });
    expect(await verifyPassword('x', '')).toEqual({ matched: false, legacy: false });
    expect(await verifyPassword('x', 123)).toEqual({ matched: false, legacy: false });
  });
});

describe('verifyPassword — legacy unsalted SHA-256', () => {
  // An unsalted SHA-256 hex digest has no colon, matching the legacy format.
  const password = 'legacy-pass-123';
  const legacyHash =
    '0e3dbda1f31f5e68a5af30091b71a4cb2c5a08da3bfc9fbb96ea2c60ad5de3f8';
  // Sanity: compute it here to match what old code stored.
  async function sha256Hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  it('accepts a matching legacy hash and flags legacy=true', async () => {
    const stored = await sha256Hex(password);
    const result = await verifyPassword(password, stored);
    expect(result).toEqual({ matched: true, legacy: true });
  });

  it('rejects a non-matching legacy hash', async () => {
    const stored = await sha256Hex('different-password');
    const result = await verifyPassword(password, stored);
    expect(result).toEqual({ matched: false, legacy: true });
  });

  it('legacyHash fixture format is as expected (no colon, 64 hex)', () => {
    expect(legacyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(legacyHash.includes(':')).toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('returns false for differing strings of the same length', () => {
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
  });

  it('returns false for differing lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
  });
});
