export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltArray = Array.from(salt);

  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

// Returns { matched, legacy }. `legacy: true` means the stored hash is
// an unsalted SHA-256 digest from before PBKDF2 was introduced.
export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return { matched: false, legacy: false };
  }

  if (!storedHash.includes(':')) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return { matched: timingSafeEqual(hashHex, storedHash), legacy: true };
  }

  const [saltHex, existingHashHex] = storedHash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return { matched: timingSafeEqual(hashHex, existingHashHex), legacy: false };
}

export function generateSecureTokenHex(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export async function hashTokenValue(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token || '')));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateResetToken() {
  return generateSecureTokenHex(32);
}

export async function hashResetToken(token) {
  return hashTokenValue(token);
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
