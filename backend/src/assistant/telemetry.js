import { recordResearchMetrics } from '../research/telemetry.js';
const OUTCOME_CODES = new Set([
  'OK',
  'NO_AUTHORIZED_EVIDENCE',
  'NO_SUPPORTABLE_CLAIMS',
  'ASSISTANT_QUERY_REQUIRED',
  'DISCOVER_FAILED',
  'EVIDENCE_PACK_FAILED',
  'PROVIDER_PRIVACY_GATE_REQUIRED',
  'MODEL_ADAPTER_REQUIRED',
  'MODEL_ADAPTER_FAILED',
  'MODEL_OUTPUT_INVALID',
  'GROUNDING_VALIDATION_FAILED',
  'GROUNDING_REJECTED',
  'RESEARCH_PRIVACY_GATE_REQUIRED',
  'RESEARCH_ENTITLEMENT_REQUIRED',
  'SUPPORT_CHECK_RUNTIME_PAUSED',
  'INVOCATION_BUDGET_EXHAUSTED',
  'INVOCATION_LIMIT_REQUIRED',
  'INVOCATION_LIMIT_INVALID',
  'INVOCATION_LIMIT_HARD_CEILING_REQUIRED',
  'INVOCATION_LIMIT_EXCEEDS_HARD_CEILING',
  'RUNTIME_LIMIT_STORE_READ_FAILED',
  'INVOCATION_BUDGET_STORE_UNAVAILABLE',
  'INVOCATION_BUDGET_INVALID',
  'INVOCATION_BUDGET_STORE_FAILED'
]);

function safeErrorClass(value) {
  const name = String(value || '').trim();
  return /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name) ? name : null;
}

function safeDiagnosticReason(value) {
  const reason = String(value || '').trim();
  return /^(MODEL_OUTPUT_EMPTY|MODEL_OUTPUT_NOT_JSON|MODEL_OUTPUT_CLAIMS_REQUIRED)$/.test(reason) ? reason : null;
}

function modelFailureMetric(errorClass) {
  const value = String(errorClass || '').trim();
  if (/^(CredentialsProviderError|UnrecognizedClientException|AccessDeniedException|ValidationException|ResourceNotFoundException|ThrottlingException|ServiceUnavailableException|TimeoutError)$/.test(value)) {
    return `assistant_model_failure_${value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`;
  }
  return 'assistant_model_failure_other';
}

function safeCode(code) {
  return OUTCOME_CODES.has(code) ? code : 'OTHER';
}

/**
 * Privacy-safe assistant telemetry.
 *
 * Never records query text, claims, evidence, pack IDs, user/session IDs,
 * credentials, or provider payloads. Logging is best-effort and must not
 * change the assistant response path.
 */
export async function recordAssistantOutcome(env, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic, retrievalDiagnostic, stageTimings, verificationReused } = {}) {
  const payload = {
    event: 'research_assistant_outcome',
    code: safeCode(code),
    duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
    environment: String(env?.ENVIRONMENT || 'unknown')
  };
  const timings = stageTimings && typeof stageTimings === 'object' ? stageTimings : {};
  for (const key of ['discover_ms', 'evidence_pack_ms', 'model_ms', 'grounding_ms', 'support_check_ms']) {
    const value = Number(timings[key]);
    if (Number.isFinite(value) && value >= 0) payload[key] = Math.round(value);
  }

  const sanitizedErrorClass = safeErrorClass(errorClass);
  if (sanitizedErrorClass) payload.error_class = sanitizedErrorClass;
  const sanitizedDiagnosticReason = safeDiagnosticReason(diagnosticReason);
  if (sanitizedDiagnosticReason) payload.diagnostic_reason = sanitizedDiagnosticReason;

  const cardinality = {};
  for (const key of ['claim_count', 'accepted_count', 'rejected_count', 'eligible_count', 'checked_count', 'truncated_count', 'support_check_limit', 'unique_supporting_source_count', 'single_source_verified_answer']) {
    const value = Number(groundingDiagnostic?.[key]);
    if (Number.isSafeInteger(value) && value >= 0) cardinality[key] = value;
  }
  if (Object.keys(cardinality).length) payload.grounding_cardinality = cardinality;

  const retrievalCardinality = {};
  for (const key of ['retrieved_count', 'relevant_count', 'language_eligible_count', 'authorized_relevant_count', 'abstract_bearing_count', 'metadata_only_count']) {
    const value = Number(retrievalDiagnostic?.[key]);
    if (Number.isSafeInteger(value) && value >= 0) retrievalCardinality[key] = value;
  }
  if (Object.keys(retrievalCardinality).length) payload.retrieval_cardinality = retrievalCardinality;
  if (verificationReused === true) payload.verification_reused = true;

  const groundingCounts = groundingDiagnostic?.rejection_counts && typeof groundingDiagnostic.rejection_counts === 'object'
    ? groundingDiagnostic.rejection_counts : {};
  const allowedGrounding = [
    'CLAIM_TEXT_REQUIRED','EVIDENCE_ID_REQUIRED','EVIDENCE_ID_UNKNOWN','SUPPORT_CHECK_REQUIRED','SUPPORT_CHECK_BUDGET_TRUNCATED','CLAIM_UNSUPPORTED','SUPPORT_CHECK_FAILED',
    'SUPPORT_CHECK_FAILED_TIMEOUT','SUPPORT_CHECK_FAILED_BUDGET','SUPPORT_CHECK_FAILED_LANGUAGE',
    'SUPPORT_CHECK_FAILED_PIN_OR_RESPONSE','SUPPORT_CHECK_FAILED_TRANSPORT_OR_OTHER'
  ];
  const groundingMetrics = [];
  for (const key of allowedGrounding) {
    const amount = Number(groundingCounts[key] || 0);
    if (Number.isFinite(amount) && amount > 0) groundingMetrics.push([`assistant_grounding_rejection_${key.toLowerCase()}`, amount]);
  }
  if (groundingMetrics.length) payload.grounding_rejection_counts = Object.fromEntries(
    groundingMetrics.map(([metric, amount]) => [metric.replace('assistant_grounding_rejection_', '').toUpperCase(), amount])
  );

  try {
    console.log(JSON.stringify(payload));
    const metricCode = payload.code.toLowerCase();
    const timingMetrics = [['assistant_duration_ms_total', payload.duration_ms]];
    for (const [field, metric] of [
      ['discover_ms', 'assistant_discover_ms_total'],
      ['evidence_pack_ms', 'assistant_evidence_pack_ms_total'],
      ['model_ms', 'assistant_model_ms_total'],
      ['grounding_ms', 'assistant_grounding_ms_total'],
      ['support_check_ms', 'assistant_support_check_ms_total']
    ]) {
      if (Object.hasOwn(payload, field)) timingMetrics.push([metric, payload[field]]);
    }
    const modelFailureMetrics = payload.code === 'MODEL_ADAPTER_FAILED'
      ? [[modelFailureMetric(payload.error_class), 1]]
      : [];
    const groundingCardinalityMetrics = [
      ['assistant_grounding_eligible_claims_total', cardinality.eligible_count],
      ['assistant_grounding_checked_claims_total', cardinality.checked_count],
      ['assistant_grounding_truncated_claims_total', cardinality.truncated_count],
      ['assistant_verified_claims_total', payload.code === 'OK' ? cardinality.accepted_count : undefined],
      ['assistant_unique_supporting_sources_total', payload.code === 'OK' ? cardinality.unique_supporting_source_count : undefined],
      ['assistant_single_source_verified_answers', payload.code === 'OK' ? cardinality.single_source_verified_answer : undefined]
    ];
    const retrievalMetrics = [
      ['assistant_retrieved_works_total', retrievalCardinality.retrieved_count],
      ['assistant_relevant_works_total', retrievalCardinality.relevant_count],
      ['assistant_language_eligible_works_total', retrievalCardinality.language_eligible_count],
      ['assistant_authorized_relevant_works_total', retrievalCardinality.authorized_relevant_count],
      ['assistant_abstract_bearing_works_total', retrievalCardinality.abstract_bearing_count],
      ['assistant_metadata_only_works_total', retrievalCardinality.metadata_only_count]
    ];
    await recordResearchMetrics(env, [
      ['assistant_requests', 1],
      [`assistant_outcome_${metricCode}`, 1],
      ...(payload.verification_reused === true ? [['assistant_verified_result_cache_hit', 1]] : []),
      ...timingMetrics,
      ...retrievalMetrics,
      ...groundingCardinalityMetrics,
      ...modelFailureMetrics,
      ...groundingMetrics
    ]);
    return true;
  } catch {
    return false;
  }
}

export const __test = { safeCode, safeErrorClass, safeDiagnosticReason, modelFailureMetric };
