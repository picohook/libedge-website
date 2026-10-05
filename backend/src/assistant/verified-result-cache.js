const DEFAULT_TTL_SECONDS = 86400;
const MAX_TTL_SECONDS = 86400;
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

async function identityDigest(identity) {
  if (typeof identity !== 'string' || !identity) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifiedResultCacheKey(identity) {
  const digest = await identityDigest(identity);
  return digest ? `research:verified-result:v1:${digest}` : null;
}

export async function readVerifiedResultCache({ env, identity } = {}) {
  if (!verifiedResultCacheEnabled(env) || !env?.RATE_LIMIT_KV || typeof env.RATE_LIMIT_KV.get !== 'function') return { hit: false, result: null };
  const digest = await identityDigest(identity);
  if (!digest) return { hit: false, result: null };
  try {
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
  const digest = await identityDigest(identity);
  if (!digest) return false;
  try {
    await env.RATE_LIMIT_KV.put(`research:verified-result:v1:${digest}`, JSON.stringify({ schema_version: VERIFIED_RESULT_CACHE_SCHEMA, identity_digest: digest, result }), { expirationTtl: ttlSeconds(env) });
    return true;
  } catch {
    return false;
  }
}
