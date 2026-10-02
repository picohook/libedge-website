const USAGE_SCOPE_PREFIX = 'assistant:usage-scope:requests';
export const USAGE_SCOPE_DAILY_LIMIT_KEY = 'assistant:usage-scope:daily-request-limit';
export const USAGE_SCOPE_LIMIT_OVERRIDE_PREFIX = 'assistant:usage-scope:limit';

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function parseLimit(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000 ? parsed : null;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function ttlUntilNextUtcDay(now) {
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)) + 300;
}

export function resolveAssistantUsageScope(user) {
  const institutionId = user?.institution_id;
  if (institutionId !== null && institutionId !== undefined && String(institutionId).trim() !== '') {
    return { type: 'institution', id: String(institutionId) };
  }
  const userId = user?.user_id || user?.sub;
  if (userId !== null && userId !== undefined && String(userId).trim() !== '') {
    return { type: 'user', id: String(userId) };
  }
  return null;
}

export function assistantUsageScopeKey(scope, now = new Date()) {
  if (!scope || !['institution', 'user'].includes(scope.type) || !scope.id) {
    throw new Error('ASSISTANT_USAGE_SCOPE_INVALID');
  }
  return `${USAGE_SCOPE_PREFIX}:${scope.type}:${scope.id}:${utcDateKey(now)}`;
}

export function assistantUsageScopeLimitOverrideKey(scope) {
  if (!scope || !['institution', 'user'].includes(scope.type) || !scope.id) throw new Error('ASSISTANT_USAGE_SCOPE_INVALID');
  return `${USAGE_SCOPE_LIMIT_OVERRIDE_PREFIX}:${scope.type}:${scope.id}`;
}

export async function assistantUsageScopeLimit(env, scope = null) {
  if (!enabled(env?.RESEARCH_ASSISTANT_USAGE_SCOPE_QUOTA_ENABLED)) {
    return { enabled: false, limit: null, source: null, reason: null };
  }

  const fallback = parseLimit(env?.RESEARCH_ASSISTANT_USAGE_SCOPE_DAILY_REQUEST_LIMIT);
  if (!env?.RATE_LIMIT_KV) {
    return { enabled: true, limit: fallback, source: fallback ? 'env' : null, reason: 'USAGE_SCOPE_QUOTA_STORE_UNAVAILABLE' };
  }

  try {
    if (scope) {
      const scopedRaw = await env.RATE_LIMIT_KV.get(assistantUsageScopeLimitOverrideKey(scope));
      if (scopedRaw !== null && scopedRaw !== undefined && String(scopedRaw).trim() !== '') {
        const scoped = parseLimit(scopedRaw);
        if (!scoped) return { enabled: true, limit: null, source: 'scope-runtime', reason: 'USAGE_SCOPE_LIMIT_INVALID' };
        return { enabled: true, limit: scoped, source: 'scope-runtime', reason: null };
      }
    }
    const raw = await env.RATE_LIMIT_KV.get(USAGE_SCOPE_DAILY_LIMIT_KEY);
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return { enabled: true, limit: fallback, source: fallback ? 'env' : null, reason: fallback ? null : 'USAGE_SCOPE_LIMIT_REQUIRED' };
    }
    const runtime = parseLimit(raw);
    if (!runtime) return { enabled: true, limit: null, source: 'runtime', reason: 'USAGE_SCOPE_LIMIT_INVALID' };
    return { enabled: true, limit: runtime, source: 'runtime', reason: null };
  } catch {
    return { enabled: true, limit: fallback, source: fallback ? 'env' : null, reason: fallback ? 'USAGE_SCOPE_QUOTA_STORE_READ_FAILED' : 'USAGE_SCOPE_LIMIT_REQUIRED' };
  }
}

/**
 * Phase-1 metering boundary. The KV backend is deliberately hidden behind this
 * interface so it can later be replaced by an atomic reservation store.
 * KV read -> increment -> put is not atomic; this is a pilot operational
 * guardrail, not a strict concurrent accounting ledger.
 */
export async function reserveAssistantUsageScopeRequest(env, user, now = new Date()) {
  const scope = resolveAssistantUsageScope(user);
  if (!scope && enabled(env?.RESEARCH_ASSISTANT_USAGE_SCOPE_QUOTA_ENABLED)) {
    return { allowed: false, enabled: true, reason: 'USAGE_SCOPE_REQUIRED', limit: null, used: null, scope: null };
  }
  const resolved = await assistantUsageScopeLimit(env, scope);
  if (!resolved.enabled) return { allowed: true, enabled: false, reason: null, limit: null, used: null, scope: null };
  if (!resolved.limit) return { allowed: false, enabled: true, reason: resolved.reason || 'USAGE_SCOPE_LIMIT_REQUIRED', limit: null, used: null, scope };
  if (!env?.RATE_LIMIT_KV) return { allowed: false, enabled: true, reason: 'USAGE_SCOPE_QUOTA_STORE_UNAVAILABLE', limit: resolved.limit, used: null, scope };

  const key = assistantUsageScopeKey(scope, now);
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const used = Number(raw || 0);
    if (!Number.isSafeInteger(used) || used < 0) {
      return { allowed: false, enabled: true, reason: 'USAGE_SCOPE_QUOTA_INVALID', limit: resolved.limit, used: null, scope };
    }
    if (used >= resolved.limit) {
      return { allowed: false, enabled: true, reason: 'ASSISTANT_USAGE_SCOPE_QUOTA_EXHAUSTED', limit: resolved.limit, used, scope };
    }
    const next = used + 1;
    await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: ttlUntilNextUtcDay(now) });
    return { allowed: true, enabled: true, reason: null, limit: resolved.limit, used: next, scope };
  } catch {
    return { allowed: false, enabled: true, reason: 'USAGE_SCOPE_QUOTA_STORE_FAILED', limit: resolved.limit, used: null, scope };
  }
}
