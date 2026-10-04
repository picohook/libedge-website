export function verifiedResultCacheEnabled(env) {
  const environment = String(env?.ENVIRONMENT || '').trim().toLowerCase();
  if (!['staging', 'local'].includes(environment)) return false;
  return String(env?.RESEARCH_VERIFIED_RESULT_CACHE_ENABLED || '').trim().toLowerCase() === 'true';
}
