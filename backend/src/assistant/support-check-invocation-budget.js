const SUPPORT_CHECK_INVOCATION_PREFIX = 'assistant:supportcheck:invocations';

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function parseLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function supportCheckInvocationKey(now = new Date()) {
  return `${SUPPORT_CHECK_INVOCATION_PREFIX}:${utcDateKey(now)}`;
}

function ttlUntilNextUtcDay(now) {
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)) + 300;
}

/**
 * Reserve one checker invocation before transport. Fail closed on missing/invalid
 * configuration, unavailable KV, exhausted budget, or KV read/write failure.
 * The counter is content-free and contains no query, claim, evidence, or user ID.
 */

/**
 * Read-only early availability check used before paid Assistant work.
 * This does not reserve capacity and must not be treated as an atomic hard cap.
 * The authoritative reservation remains immediately before checker transport.
 */
export async function preflightSupportCheckInvocation(env, now = new Date()) {
  const limit = parseLimit(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT);
  if (!limit) return { allowed: false, reason: 'INVOCATION_LIMIT_REQUIRED', limit, used: null };
  if (!env?.RATE_LIMIT_KV) return { allowed: false, reason: 'INVOCATION_BUDGET_STORE_UNAVAILABLE', limit, used: null };

  const key = supportCheckInvocationKey(now);
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const used = Number(raw || 0);
    if (!Number.isFinite(used) || used < 0) {
      return { allowed: false, reason: 'INVOCATION_BUDGET_INVALID', limit, used: null };
    }
    if (used >= limit) return { allowed: false, reason: 'INVOCATION_BUDGET_EXHAUSTED', limit, used };
    return { allowed: true, reason: null, limit, used };
  } catch {
    return { allowed: false, reason: 'INVOCATION_BUDGET_STORE_FAILED', limit, used: null };
  }
}

export async function reserveSupportCheckInvocation(env, now = new Date()) {
  const limit = parseLimit(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT);
  if (!limit) return { allowed: false, reason: 'INVOCATION_LIMIT_REQUIRED', limit, used: null };
  if (!env?.RATE_LIMIT_KV) return { allowed: false, reason: 'INVOCATION_BUDGET_STORE_UNAVAILABLE', limit, used: null };

  const key = supportCheckInvocationKey(now);
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const used = Number(raw || 0);
    if (!Number.isFinite(used) || used < 0) {
      return { allowed: false, reason: 'INVOCATION_BUDGET_INVALID', limit, used: null };
    }
    if (used >= limit) return { allowed: false, reason: 'INVOCATION_BUDGET_EXHAUSTED', limit, used };

    const next = used + 1;
    await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: ttlUntilNextUtcDay(now) });
    return { allowed: true, reason: null, limit, used: next };
  } catch {
    return { allowed: false, reason: 'INVOCATION_BUDGET_STORE_FAILED', limit, used: null };
  }
}
