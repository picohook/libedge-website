const PREFIX = 'assistant:usage-scope:state';

function validScope(scope) {
  return scope && ['institution', 'user'].includes(scope.type) && String(scope.id || '').trim();
}

export function assistantUsageScopeStateKey(scope) {
  if (!validScope(scope)) throw new Error('ASSISTANT_USAGE_SCOPE_INVALID');
  return `${PREFIX}:${scope.type}:${scope.id}`;
}

export async function assistantUsageScopeState(env, scope) {
  if (!validScope(scope)) return { active: false, state: null, reason: 'USAGE_SCOPE_REQUIRED' };
  if (!env?.RATE_LIMIT_KV) return { active: false, state: null, reason: 'USAGE_SCOPE_STATE_STORE_UNAVAILABLE' };
  try {
    const raw = await env.RATE_LIMIT_KV.get(assistantUsageScopeStateKey(scope));
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return { active: true, state: 'active', reason: null, source: 'default' };
    }
    const value = String(raw).trim().toLowerCase();
    if (value === 'active' || value === 'resume') return { active: true, state: 'active', reason: null, source: 'runtime' };
    if (value === 'paused' || value === 'pause') return { active: false, state: 'paused', reason: 'ASSISTANT_USAGE_SCOPE_PAUSED', source: 'runtime' };
    return { active: false, state: null, reason: 'USAGE_SCOPE_STATE_INVALID', source: 'runtime' };
  } catch {
    return { active: false, state: null, reason: 'USAGE_SCOPE_STATE_STORE_READ_FAILED' };
  }
}
