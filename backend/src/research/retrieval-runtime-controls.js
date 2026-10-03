export const RESEARCH_RETRIEVAL_CONTROL_KEY = 'research:retrieval:controls:v1';

const ALLOWED_MODES = new Set(['lexical', 'semantic']);
const ALLOWED_LEXICAL_DEPTHS = new Set([10, 20, 30, 50]);
const ALLOWED_FINAL_TARGETS = new Set([5, 10, 15, 20, 25]);

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function staticDefaults(env = {}) {
  const semantic = enabled(env.RESEARCH_SEMANTIC_PRIMARY_ENABLED);
  const lexicalDepth = Number.parseInt(String(env.RESEARCH_LEXICAL_CANDIDATE_DEPTH ?? ''), 10);
  return {
    mode: semantic ? 'semantic' : 'lexical',
    lexical_candidate_depth: ALLOWED_LEXICAL_DEPTHS.has(lexicalDepth) ? lexicalDepth : 10,
    final_result_target: 10,
    source: 'env'
  };
}

export function validateResearchRetrievalControls(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mode = String(value.mode || '').trim().toLowerCase();
  const lexicalDepth = Number(value.lexical_candidate_depth);
  const finalTarget = Number(value.final_result_target);
  if (!ALLOWED_MODES.has(mode)) return null;
  if (!ALLOWED_LEXICAL_DEPTHS.has(lexicalDepth)) return null;
  if (!ALLOWED_FINAL_TARGETS.has(finalTarget)) return null;
  if (lexicalDepth < finalTarget) return null;
  return { mode, lexical_candidate_depth: lexicalDepth, final_result_target: finalTarget };
}

export async function researchRetrievalControls(env = {}) {
  const fallback = staticDefaults(env);
  if (String(env.ENVIRONMENT || '').trim().toLowerCase() !== 'staging') return fallback;
  if (!env.RATE_LIMIT_KV) return { ...fallback, source: 'env_fallback', reason: 'CONTROL_STORE_UNAVAILABLE' };

  try {
    const raw = await env.RATE_LIMIT_KV.get(RESEARCH_RETRIEVAL_CONTROL_KEY);
    if (!raw) return { ...fallback, source: 'env_fallback', reason: 'CONTROL_UNSET' };
    const parsed = validateResearchRetrievalControls(JSON.parse(raw));
    if (!parsed) return { ...fallback, source: 'env_fallback', reason: 'CONTROL_INVALID' };
    return { ...parsed, source: 'runtime' };
  } catch {
    return { ...fallback, source: 'env_fallback', reason: 'CONTROL_READ_FAILED' };
  }
}

export function serializeResearchRetrievalControls(value) {
  const parsed = validateResearchRetrievalControls(value);
  if (!parsed) return null;
  return JSON.stringify(parsed);
}
