const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(String(value || ''));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(secret) {
  const value = String(secret || '');
  if (value.length < 32) throw new Error('ASSISTANT_HISTORY_ENCRYPTION_SECRET must be at least 32 characters');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptAssistantHistory(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(String(value)));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptAssistantHistory(value, secret) {
  const [version, ivValue, ciphertext] = String(value || '').split('.');
  if (version !== 'v1' || !ivValue || !ciphertext) throw new Error('Invalid Assistant history ciphertext');
  const key = await encryptionKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivValue) }, key, fromBase64(ciphertext));
  return decoder.decode(plain);
}
