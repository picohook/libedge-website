import { describe, it, expect } from 'vitest';
import {
  encryptCredential,
  decryptCredential,
  hmacSha256,
  sha256,
} from '../../backend/src/ra/crypto.js';

// 32-byte key, base64 encoded.
function randomMasterKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

describe('encryptCredential / decryptCredential', () => {
  it('round-trips a plaintext', async () => {
    const key = randomMasterKey();
    const plaintext = JSON.stringify({ username: 'u@example.com', password: 'hunter2' });
    const stored = await encryptCredential(plaintext, key);
    expect(stored.startsWith('v1:')).toBe(true);
    expect(stored.split(':')).toHaveLength(3);
    const decrypted = await decryptCredential(stored, key);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const key = randomMasterKey();
    const a = await encryptCredential('hello', key);
    const b = await encryptCredential('hello', key);
    expect(a).not.toBe(b);
    expect(await decryptCredential(a, key)).toBe('hello');
    expect(await decryptCredential(b, key)).toBe('hello');
  });

  it('fails to decrypt with the wrong key', async () => {
    const k1 = randomMasterKey();
    const k2 = randomMasterKey();
    const stored = await encryptCredential('secret', k1);
    await expect(decryptCredential(stored, k2)).rejects.toThrow();
  });

  it('rejects malformed ciphertexts', async () => {
    const key = randomMasterKey();
    await expect(decryptCredential('not-valid', key)).rejects.toThrow(/malformed/);
    await expect(decryptCredential('v1:only-two', key)).rejects.toThrow(/malformed/);
    await expect(decryptCredential('v2:aa:bb', key)).rejects.toThrow(/version/);
  });

  it('rejects empty plaintext or missing key', async () => {
    await expect(encryptCredential('', randomMasterKey())).rejects.toThrow(/plaintext/);
    await expect(encryptCredential('hi', '')).rejects.toThrow(/MASTER_KEY/);
  });

  it('rejects master keys that are not 32 bytes', async () => {
    const short = btoa('not-32-bytes-long');
    await expect(encryptCredential('hi', short)).rejects.toThrow(/32 bytes/);
  });
});

describe('hmacSha256 / sha256', () => {
  it('matches known SHA-256 vectors', async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(await sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    // SHA-256("abc")
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('matches known HMAC-SHA256 vector (RFC 4231 test case 1)', async () => {
    // key = 0x0b * 20, message = "Hi There"
    const key = String.fromCharCode(...new Array(20).fill(0x0b));
    const mac = await hmacSha256(key, 'Hi There');
    expect(mac).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    );
  });

  it('hmacSha256 differs from sha256 of the concatenation', async () => {
    const mac = await hmacSha256('k', 'msg');
    const plain = await sha256('kmsg');
    expect(mac).not.toBe(plain);
  });
});
