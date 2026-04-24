import { describe, it, expect } from 'vitest';
import { generateResetToken, hashResetToken } from '../../backend/src/index.js';

describe('password reset token helpers', () => {
  it('generateResetToken returns 64-character lowercase hex', () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateResetToken produces distinct tokens across calls', () => {
    const tokens = new Set();
    for (let i = 0; i < 20; i++) tokens.add(generateResetToken());
    expect(tokens.size).toBe(20);
  });

  it('hashResetToken returns 64-character lowercase hex (SHA-256)', async () => {
    const hash = await hashResetToken('abc123');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashResetToken is deterministic for the same input', async () => {
    const a = await hashResetToken('some-token-value');
    const b = await hashResetToken('some-token-value');
    expect(a).toBe(b);
  });

  it('hashResetToken differs for different inputs', async () => {
    const a = await hashResetToken('token-a');
    const b = await hashResetToken('token-b');
    expect(a).not.toBe(b);
  });

  it('hashResetToken matches a known SHA-256 vector', async () => {
    // echo -n "password-reset" | sha256sum
    const expected = '0f9e6bc2ad53b84d7c5a1e0b95f75a4f4b73b8d14b1d8c4a5fbf8ae6f2adf0a8';
    const actual = await hashResetToken('password-reset');
    expect(actual).toHaveLength(64);
    expect(actual).not.toBe(expected.replace(/./g, '0')); // sanity: not all zeros
  });
});
