const PREFIX = 'research:telemetry:v1';
const ALLOWED_METRICS = new Set([
  'research_requests',
  'semantic_attempts',
  'semantic_successes',
  'semantic_valid_empty',
  'semantic_malformed',
  'semantic_timeout_network',
  'semantic_429',
  'semantic_5xx',
  'semantic_pacing_unavailable',
  'semantic_pacing_wait_ms_total',
  'semantic_provider_latency_ms_total',
  'lexical_fallback_attempts',
  'lexical_fallback_successes',
  'crossref_search_fallbacks',
  'semantic_charged_responses',
  'semantic_cost_microusd_total',
  'semantic_credits_total'
]);

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function metricKey(metric, now = new Date()) {
  return `${PREFIX}:${utcDateKey(now)}:${metric}`;
}

function ttlSeconds(now = new Date()) {
  const expiry = Date.parse(`${utcDateKey(new Date(now.getTime() + 8 * 86400000))}T00:00:00.000Z`);
  return Math.max(3600, Math.ceil((expiry - now.getTime()) / 1000));
}

export async function recordResearchMetric(env, metric, amount = 1, now = new Date()) {
  if (!ALLOWED_METRICS.has(metric)) return;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric < 0 || !env.RATE_LIMIT_KV) return;

  const key = metricKey(metric, now);
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const current = Number(raw || 0);
    const next = (Number.isFinite(current) ? current : 0) + numeric;
    await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: ttlSeconds(now) });
  } catch (error) {
    console.warn('research telemetry write failed', error);
  }
}

export async function readResearchTelemetrySnapshot(env, now = new Date()) {
  if (!env.RATE_LIMIT_KV) return null;

  const metrics = {};
  await Promise.all([...ALLOWED_METRICS].map(async (metric) => {
    const raw = await env.RATE_LIMIT_KV.get(metricKey(metric, now));
    const numeric = Number(raw || 0);
    metrics[metric] = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }));

  return {
    date_utc: utcDateKey(now),
    metrics
  };
}

export async function recordSemanticTelemetry(env, telemetry = {}, now = new Date()) {
  const calls = [];
  if (Number.isFinite(Number(telemetry.requestCostUsd)) && Number(telemetry.requestCostUsd) > 0) {
    calls.push(recordResearchMetric(env, 'semantic_charged_responses', 1, now));
    calls.push(recordResearchMetric(env, 'semantic_cost_microusd_total', Math.round(Number(telemetry.requestCostUsd) * 1_000_000), now));
  }
  if (Number.isFinite(Number(telemetry.requestCredits)) && Number(telemetry.requestCredits) >= 0) {
    calls.push(recordResearchMetric(env, 'semantic_credits_total', Number(telemetry.requestCredits), now));
  }
  await Promise.all(calls);
}

export { ALLOWED_METRICS as RESEARCH_TELEMETRY_METRICS, metricKey as researchTelemetryMetricKey };
