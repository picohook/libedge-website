const DEFAULT_TTL_SECONDS = 900;
const MAX_TTL_SECONDS = 900;
export const VERIFIED_RESULT_CACHE_SCHEMA = 'verified-result-v1';

export function verifiedResultCacheEnabled(env) {
  const environment = String(env?.ENVIRONMENT || '').trim().toLowerCase();
  if (!['staging', 'local'].includes(environment)) return false;
  return String(env?.RESEARCH_VERIFIED_RESULT_CACHE_ENABLED || '').trim().toLowerCase() === 'true';
}

function ttlSeconds(env) {
  const value = Number.parseInt(String(env?.RESEARCH_VERIFIED_RESULT_CACHE_TTL_SECONDS || DEFAULT_TTL_SECONDS), 10);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, MAX_TTL_SECONDS) : DEFAULT_TTL_SECONDS;
}

async function hmacIdentity(identity, env) {
  if (typeof identity !== 'string' || !identity) return null;
  const secret = String(env?.RESEARCH_VERIFIED_RESULT_CACHE_HMAC_SECRET || '');
  if (!secret) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(identity));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifiedResultCacheKey(identity, env) {
  const digest = await hmacIdentity(identity, env);
  return digest ? `research:verified-result:v1:${digest}` : null;
}

export async function readVerifiedResultCache({ env, identity } = {}) {
  if (!verifiedResultCacheEnabled(env) || !env?.RATE_LIMIT_KV || typeof env.RATE_LIMIT_KV.get !== 'function') return { hit: false, result: null };
  try {
    const digest = await hmacIdentity(identity, env);
    if (!digest) return { hit: false, result: null };
    const raw = await env.RATE_LIMIT_KV.get(`research:verified-result:v1:${digest}`);
    if (!raw) return { hit: false, result: null };
    const payload = JSON.parse(raw);
    if (payload?.schema_version !== VERIFIED_RESULT_CACHE_SCHEMA || payload?.identity_digest !== digest || !payload?.result || typeof payload.result !== 'object' || Array.isArray(payload.result)) return { hit: false, result: null };
    return { hit: true, result: payload.result };
  } catch {
    return { hit: false, result: null };
  }
}

export async function writeVerifiedResultCache({ env, identity, result } = {}) {
  if (!verifiedResultCacheEnabled(env) || !env?.RATE_LIMIT_KV || typeof env.RATE_LIMIT_KV.put !== 'function' || !result || typeof result !== 'object' || Array.isArray(result)) return false;
  try {
    const digest = await hmacIdentity(identity, env);
    if (!digest) return false;
    await env.RATE_LIMIT_KV.put(`research:verified-result:v1:${digest}`, JSON.stringify({ schema_version: VERIFIED_RESULT_CACHE_SCHEMA, identity_digest: digest, result }), { expirationTtl: ttlSeconds(env) });
    return true;
  } catch {
    return false;
  }
}
