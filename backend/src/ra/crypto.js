/**
 * backend/src/ra/crypto.js
 *
 * AES-256-GCM credential encryption — publisher kullanıcı adı/şifresi
 * D1'de şifreli tutulur. Master key wrangler secret (`RA_CREDS_MASTER_KEY`,
 * 32-byte base64).
 *
 * Stored format: `v1:{iv_b64}:{ct_b64}`
 *   - v1 = versioning (key rotation için ileride v2 eklenebilir)
 *   - AES-GCM'de tag ciphertext'e gömülü — ayrı saklamıyoruz
 *   - IV 12 byte, her encrypt'te random
 *
 * WebCrypto Cloudflare Workers runtime'ında native destekli, dependency yok.
 */

const VERSION = 'v1';

/**
 * @param {string} plaintext Encrypt edilecek metin (JSON.stringify'lanmış {username,password})
 * @param {string} masterKeyB64 32-byte base64 master key (wrangler secret)
 * @returns {Promise<string>} "v1:{iv_b64}:{ct_b64}"
 */
export async function encryptCredential(plaintext, masterKeyB64) {
  if (!plaintext) throw new Error('plaintext required');
  if (!masterKeyB64) throw new Error('RA_CREDS_MASTER_KEY missing');

  const keyBytes = b64decode(masterKeyB64);
  if (keyBytes.byteLength !== 32) {
    throw new Error('RA_CREDS_MASTER_KEY must be 32 bytes (base64)');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return `${VERSION}:${b64encode(iv)}:${b64encode(new Uint8Array(ctBuf))}`;
}

/**
 * @param {string} stored "v1:{iv_b64}:{ct_b64}"
 * @param {string} masterKeyB64 32-byte base64 master key
 * @returns {Promise<string>} decrypted plaintext
 */
export async function decryptCredential(stored, masterKeyB64) {
  if (!stored) throw new Error('stored ciphertext required');
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('malformed ciphertext');
  const [version, ivB64, ctB64] = parts;
  if (version !== VERSION) throw new Error(`unsupported version: ${version}`);

  const keyBytes = b64decode(masterKeyB64);
  const iv = b64decode(ivB64);
  const ct = b64decode(ctB64);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );

  return new TextDecoder().decode(ptBuf);
}

/**
 * HMAC-SHA256 — egress agent ile imzalı istek için kullanılır.
 *
 * @param {string} secret Paylaşımlı secret (base64 veya düz)
 * @param {string} message Signed olacak payload (method|url|ts|bodyhash)
 * @returns {Promise<string>} hex HMAC
 */
export async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );
  return bufToHex(new Uint8Array(sig));
}

/**
 * SHA-256 — body hash için
 * @param {string | ArrayBuffer | Uint8Array} input
 * @returns {Promise<string>} hex
 */
export async function sha256(input) {
  let bytes;
  if (typeof input === 'string') bytes = new TextEncoder().encode(input);
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = input;
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  return bufToHex(new Uint8Array(hashBuf));
}

// ──────────────────────────────────────────────────────────────────────────
// Base64 / hex helper'ları (Workers runtime'ında atob/btoa native)
// ──────────────────────────────────────────────────────────────────────────
function b64encode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function bufToHex(bytes) {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
