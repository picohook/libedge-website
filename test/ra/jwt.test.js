import { describe, it, expect } from 'vitest';
import {
  signProxyToken,
  verifyProxyToken,
  newJti,
} from '../../backend/src/ra/jwt.js';

const SECRET = 'test-secret-not-for-production-please-rotate';

function validPayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'ra-main',
    aud: 'ra-proxy',
    sub: 42,
    iid: 7,
    sid: 100,
    pid: 'example-product',
    tgt: 'www-jove-com',
    exp: now + 300,
    jti: newJti(),
    ...overrides,
  };
}

describe('signProxyToken / verifyProxyToken', () => {
  it('round-trips a valid payload', async () => {
    const payload = validPayload();
    const token = await signProxyToken(payload, SECRET);
    expect(token.split('.')).toHaveLength(3);
    const decoded = await verifyProxyToken(token, SECRET);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.iid).toBe(payload.iid);
    expect(decoded.jti).toBe(payload.jti);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signProxyToken(validPayload(), SECRET);
    await expect(verifyProxyToken(token, 'other-secret')).rejects.toThrow(
      /signature/i
    );
  });

  it('rejects a tampered payload', async () => {
    const token = await signProxyToken(validPayload(), SECRET);
    const [h, p, s] = token.split('.');
    // Decode payload, flip sub, re-encode, keep original signature.
    const payload = JSON.parse(
      Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    payload.sub = 999999;
    const tampered = Buffer.from(JSON.stringify(payload))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await expect(
      verifyProxyToken(`${h}.${tampered}.${s}`, SECRET)
    ).rejects.toThrow(/signature/i);
  });

  it('rejects a malformed token', async () => {
    await expect(verifyProxyToken('not.a.jwt', SECRET)).rejects.toThrow();
    await expect(verifyProxyToken('onlyonepart', SECRET)).rejects.toThrow(
      /malformed/
    );
  });

  it('rejects expired tokens', async () => {
    const token = await signProxyToken(
      validPayload({ exp: Math.floor(Date.now() / 1000) - 1 }),
      SECRET
    );
    await expect(verifyProxyToken(token, SECRET)).rejects.toThrow(/expired/);
  });

  it('rejects wrong issuer / audience', async () => {
    const wrongIss = await signProxyToken(
      validPayload({ iss: 'attacker' }),
      SECRET
    );
    await expect(verifyProxyToken(wrongIss, SECRET)).rejects.toThrow(
      /issuer/
    );

    const wrongAud = await signProxyToken(
      validPayload({ aud: 'somewhere-else' }),
      SECRET
    );
    await expect(verifyProxyToken(wrongAud, SECRET)).rejects.toThrow(
      /audience/
    );
  });
});

describe('newJti', () => {
  it('returns a 32-character lowercase hex string', () => {
    const jti = newJti();
    expect(jti).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns distinct values across calls', () => {
    const a = newJti();
    const b = newJti();
    expect(a).not.toBe(b);
  });
});
