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
  'semantic_credits_total',
  'assistant_requests',
  'assistant_duration_ms_total',
  'assistant_discover_ms_total',
  'assistant_evidence_pack_ms_total',
  'assistant_model_ms_total',
  'assistant_grounding_ms_total',
  'assistant_support_check_ms_total',
  'assistant_support_check_call_ms_total',
  'assistant_support_check_call_ms_max_total',
  'assistant_support_check_queue_wait_ms_total',
  'assistant_support_check_queue_wait_ms_max_total',
  'assistant_outcome_ok',
  'assistant_outcome_no_authorized_evidence',
  'assistant_outcome_no_supportable_claims',
  'assistant_retrieved_works_total',
  'assistant_relevant_works_total',
  'assistant_language_eligible_works_total',
  'assistant_authorized_relevant_works_total',
  'assistant_abstract_bearing_works_total',
  'assistant_metadata_only_works_total',
  'assistant_grounding_eligible_claims_total',
  'assistant_grounding_checked_claims_total',
  'assistant_grounding_truncated_claims_total',
  'assistant_verified_claims_total',
  'assistant_unique_supporting_sources_total',
  'assistant_single_source_verified_answers',
  'assistant_outcome_assistant_query_required',
  'assistant_outcome_discover_failed',
  'assistant_outcome_evidence_pack_failed',
  'assistant_outcome_provider_privacy_gate_required',
  'assistant_outcome_model_adapter_required',
  'assistant_outcome_model_adapter_failed',
  'assistant_outcome_model_output_invalid',
  'assistant_outcome_grounding_validation_failed',
  'assistant_outcome_grounding_rejected',
  'assistant_outcome_research_privacy_gate_required',
  'assistant_outcome_research_entitlement_required',
  'assistant_outcome_other',
  'assistant_model_failure_credentials_provider_error',
  'assistant_model_failure_unrecognized_client_exception',
  'assistant_model_failure_access_denied_exception',
  'assistant_model_failure_validation_exception',
  'assistant_model_failure_resource_not_found_exception',
  'assistant_model_failure_throttling_exception',
  'assistant_model_failure_service_unavailable_exception',
  'assistant_model_failure_timeout_error',
  'assistant_model_failure_other',
  'assistant_verified_result_cache_hit',
  'assistant_grounding_rejection_claim_text_required',
  'assistant_grounding_rejection_evidence_id_required',
  'assistant_grounding_rejection_evidence_id_unknown',
  'assistant_grounding_rejection_support_check_required',
  'assistant_grounding_rejection_support_check_budget_truncated',
  'assistant_grounding_rejection_claim_unsupported',
  'assistant_grounding_rejection_claim_unsupported_support',
  'assistant_grounding_rejection_claim_unsupported_not_supported',
  'assistant_grounding_rejection_claim_unsupported_unsupported',
  'assistant_grounding_rejection_support_check_failed',
  'assistant_grounding_rejection_support_check_failed_timeout',
  'assistant_grounding_rejection_support_check_failed_budget',
  'assistant_grounding_rejection_support_check_failed_language',
  'assistant_grounding_rejection_support_check_failed_language_claim',
  'assistant_grounding_rejection_support_check_failed_language_evidence',
  'assistant_grounding_rejection_support_check_failed_pin_or_response',
  'assistant_grounding_rejection_support_check_failed_transport_or_other'
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
