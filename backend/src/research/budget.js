const OPENALEX_BUDGET_PREFIX = 'research:budget:openalex';

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function parseBudget(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function openAlexBudgetKey(now = new Date()) {
  return `${OPENALEX_BUDGET_PREFIX}:${utcDateKey(now)}`;
}

export async function checkOpenAlexSoftBudget(env, now = new Date()) {
  const limitUsd = parseBudget(env.OPENALEX_DAILY_SOFT_BUDGET_USD);
  if (!limitUsd || !env.RATE_LIMIT_KV) return { allowed: true, limitUsd, spentUsd: null };

  try {
    const raw = await env.RATE_LIMIT_KV.get(openAlexBudgetKey(now));
    const spentUsd = Number(raw || 0);
    return {
      allowed: !Number.isFinite(spentUsd) || spentUsd < limitUsd,
      limitUsd,
      spentUsd: Number.isFinite(spentUsd) ? spentUsd : 0
    };
  } catch (error) {
    console.warn('openalex soft budget read failed', error);
    return { allowed: true, limitUsd, spentUsd: null };
  }
}

export async function recordOpenAlexCost(env, costUsd, now = new Date()) {
  const cost = Number(costUsd);
  if (!env.RATE_LIMIT_KV || !Number.isFinite(cost) || cost <= 0) return;
  const key = openAlexBudgetKey(now);
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const current = Number(raw || 0);
    const next = (Number.isFinite(current) ? current : 0) + cost;
    const secondsUntilTomorrow = Math.max(60, Math.ceil((Date.parse(`${utcDateKey(new Date(now.getTime() + 86400000))}T00:00:00.000Z`) - now.getTime()) / 1000));
    await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: secondsUntilTomorrow + 300 });
  } catch (error) {
    console.warn('openalex soft budget write failed', error);
  }
}
