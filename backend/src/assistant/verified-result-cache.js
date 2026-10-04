export function verifiedResultCacheEnabled(env) {
  if (String(env?.ENVIRONMENT || '').trim().toLowerCase() === 'production') return false;
  return String(env?.RESEARCH_VERIFIED_RESULT_CACHE_ENABLED || '').trim().toLowerCase() === 'true';
}
