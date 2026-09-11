// Exact research telemetry counters are backed by D1 migration 0048.
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

const INCREMENT_SQL = `
INSERT INTO research_telemetry_counters (date_utc, metric, value, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(date_utc, metric)
DO UPDATE SET
  value = research_telemetry_counters.value + excluded.value,
  updated_at = CURRENT_TIMESTAMP
`;

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function normalizeEntries(entries = []) {
  const totals = new Map();
  for (const [metric, amount] of entries) {
    if (!ALLOWED_METRICS.has(metric)) continue;
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    totals.set(metric, (totals.get(metric) || 0) + numeric);
  }
  return [...totals.entries()];
}

export function semanticTelemetryEntries(telemetry = {}) {
  const entries = [];
  const cost = Number(telemetry.requestCostUsd);
  const credits = Number(telemetry.requestCredits);

  if (Number.isFinite(cost) && cost > 0) {
    entries.push(['semantic_charged_responses', 1]);
    entries.push(['semantic_cost_microusd_total', Math.round(cost * 1_000_000)]);
  }
  if (Number.isFinite(credits) && credits >= 0) {
    entries.push(['semantic_credits_total', credits]);
  }
  return entries;
}

export async function recordResearchMetrics(env, entries = [], now = new Date()) {
  if (!env.DB) return false;
  const normalized = normalizeEntries(entries);
  if (!normalized.length) return true;

  const dateUtc = utcDateKey(now);
  try {
    const statements = normalized.map(([metric, amount]) => (
      env.DB.prepare(INCREMENT_SQL).bind(dateUtc, metric, amount)
    ));

    if (typeof env.DB.batch === 'function') {
      await env.DB.batch(statements);
    } else {
      for (const statement of statements) await statement.run();
    }
    return true;
  } catch (error) {
    console.warn('research telemetry write failed', error);
    return false;
  }
}

export async function recordResearchMetric(env, metric, amount = 1, now = new Date()) {
  return recordResearchMetrics(env, [[metric, amount]], now);
}

export async function recordSemanticTelemetry(env, telemetry = {}, now = new Date()) {
  return recordResearchMetrics(env, semanticTelemetryEntries(telemetry), now);
}

export async function readResearchTelemetrySnapshot(env, now = new Date()) {
  if (!env.DB) return null;

  const metrics = Object.fromEntries([...ALLOWED_METRICS].map((metric) => [metric, 0]));
  try {
    const result = await env.DB.prepare(
      'SELECT metric, value FROM research_telemetry_counters WHERE date_utc = ?'
    ).bind(utcDateKey(now)).all();

    for (const row of result?.results || []) {
      if (!ALLOWED_METRICS.has(row.metric)) continue;
      const numeric = Number(row.value);
      if (Number.isFinite(numeric) && numeric >= 0) metrics[row.metric] = numeric;
    }
  } catch (error) {
    console.warn('research telemetry read failed', error);
    return null;
  }

  return {
    date_utc: utcDateKey(now),
    metrics
  };
}

export async function pruneResearchTelemetry(env, now = new Date()) {
  if (!env.DB) return false;
  const cutoff = utcDateKey(new Date(now.getTime() - 7 * 86400000));
  try {
    await env.DB.prepare(
      'DELETE FROM research_telemetry_counters WHERE date_utc < ?'
    ).bind(cutoff).run();
    return true;
  } catch (error) {
    console.warn('research telemetry prune failed', error);
    return false;
  }
}

export { ALLOWED_METRICS as RESEARCH_TELEMETRY_METRICS, utcDateKey as researchTelemetryDateKey };
