/**
 * backend/src/ra/jwt.js
 *
 * Main Worker ↔ Proxy Worker arasında geçici erişim token'ı — HS256 JWT.
 * Hono'nun built-in hono/jwt helper'ı yerine minimal bir implementasyon
 * kullanıyoruz çünkü hem Main hem Proxy Worker aynı kodu paylaşabilsin
 * (Proxy Worker'da Hono import etmemeyi tercih ediyoruz — saf fetch handler).
 *
 * Tek kullanımlık: jti RATE_LIMIT_KV'de `ra:jti:{jti}` key'iyle 10dk TTL
 * ile işaretlenir, ikinci kullanımda reddedilir.
 */

const HEADER = { alg: 'HS256', typ: 'JWT' };

/**
 * @typedef {Object} ProxyTokenPayload
 * @property {string} iss 'ra-main'
 * @property {string} aud 'ra-proxy'
 * @property {string} sub user.id
 * @property {string} iid institution.id
 * @property {number} sid institution_subscriptions.id
 * @property {string} pid product.id
 * @property {string} tgt hyphen-encoded target host (www-sciencedirect-com)
 * @property {number} exp unix ts (issued_at + 300)
 * @property {string} jti random nonce (ulid veya crypto.randomUUID)
 */

/**
 * @param {ProxyTokenPayload} payload
 * @param {string} secret HS256 shared secret (RA_PROXY_TOKEN_SECRET wrangler secret)
 * @returns {Promise<string>} compact JWT
 */
export async function signProxyToken(payload, secret) {
  const h = b64urlEncode(JSON.stringify(HEADER));
  const p = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${h}.${p}`;
  const sig = await hmac(secret, signingInput);
  return `${signingInput}.${b64urlFromBytes(sig)}`;
}

/**
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<ProxyTokenPayload>}
 * @throws Error — invalid signature, expired, malformed
 */
export async function verifyProxyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, s] = parts;

  const expectedSig = await hmac(secret, `${h}.${p}`);
  const actualSig = b64urlToBytes(s);
  if (!timingSafeEqual(expectedSig, actualSig)) {
    throw new Error('invalid signature');
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p));
  } catch {
    throw new Error('invalid payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    throw new Error('expired');
  }
  if (payload.iss !== 'ra-main') throw new Error('wrong issuer');
  if (payload.aud !== 'ra-proxy') throw new Error('wrong audience');

  return payload;
}

// ──────────────────────────────────────────────────────────────────────────
async function hmac(secret, input) {
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
    new TextEncoder().encode(input)
  );
  return new Uint8Array(sig);
}

function timingSafeEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function b64urlEncode(str) {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function b64urlDecode(b64u) {
  const bytes = b64urlToBytes(b64u);
  return new TextDecoder().decode(bytes);
}

function b64urlFromBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(b64u) {
  const b64 = b64u
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(b64u.length / 4) * 4, '=');
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export function newJti() {
  // crypto.randomUUID() Workers runtime'ında native
  return crypto.randomUUID().replace(/-/g, '');
}
