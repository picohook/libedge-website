import { recordResearchMetrics } from '../research/telemetry.js';
const OUTCOME_CODES = new Set([
  'OK',
  'NO_AUTHORIZED_EVIDENCE',
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
  'RESEARCH_ENTITLEMENT_REQUIRED'
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
export async function recordAssistantOutcome(env, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic, retrievalDiagnostic, stageTimings } = {}) {
  const payload = {
    event: 'research_assistant_outcome',
    code: safeCode(code),
    duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
    environment: String(env?.ENVIRONMENT || 'unknown')
  };
  const timings = stageTimings && typeof stageTimings === 'object' ? stageTimings : {};
  for (const key of ['discover_ms', 'evidence_pack_ms', 'model_ms', 'grounding_ms']) {
    const value = Number(timings[key]);
    if (Number.isFinite(value) && value >= 0) payload[key] = Math.round(value);
  }

  const sanitizedErrorClass = safeErrorClass(errorClass);
  if (sanitizedErrorClass) payload.error_class = sanitizedErrorClass;
  const sanitizedDiagnosticReason = safeDiagnosticReason(diagnosticReason);
  if (sanitizedDiagnosticReason) payload.diagnostic_reason = sanitizedDiagnosticReason;

  const cardinality = {};
  for (const key of ['claim_count', 'accepted_count', 'rejected_count']) {
    const value = Number(groundingDiagnostic?.[key]);
    if (Number.isSafeInteger(value) && value >= 0) cardinality[key] = value;
  }
  if (Object.keys(cardinality).length) payload.grounding_cardinality = cardinality;

  const retrievalCardinality = {};
  for (const key of ['retrieved_count', 'relevant_count', 'language_eligible_count', 'authorized_relevant_count']) {
    const value = Number(retrievalDiagnostic?.[key]);
    if (Number.isSafeInteger(value) && value >= 0) retrievalCardinality[key] = value;
  }
  if (Object.keys(retrievalCardinality).length) payload.retrieval_cardinality = retrievalCardinality;

  const groundingCounts = groundingDiagnostic?.rejection_counts && typeof groundingDiagnostic.rejection_counts === 'object'
    ? groundingDiagnostic.rejection_counts : {};
  const allowedGrounding = [
    'CLAIM_TEXT_REQUIRED','EVIDENCE_ID_REQUIRED','EVIDENCE_ID_UNKNOWN','SUPPORT_CHECK_REQUIRED','CLAIM_UNSUPPORTED','SUPPORT_CHECK_FAILED',
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
      ['grounding_ms', 'assistant_grounding_ms_total']
    ]) {
      if (Object.hasOwn(payload, field)) timingMetrics.push([metric, payload[field]]);
    }
    const modelFailureMetrics = payload.code === 'MODEL_ADAPTER_FAILED'
      ? [[modelFailureMetric(payload.error_class), 1]]
      : [];
    const retrievalMetrics = [
      ['assistant_retrieved_works_total', retrievalCardinality.retrieved_count],
      ['assistant_relevant_works_total', retrievalCardinality.relevant_count],
      ['assistant_language_eligible_works_total', retrievalCardinality.language_eligible_count],
      ['assistant_authorized_relevant_works_total', retrievalCardinality.authorized_relevant_count]
    ];
    await recordResearchMetrics(env, [
      ['assistant_requests', 1],
      [`assistant_outcome_${metricCode}`, 1],
      ...timingMetrics,
      ...retrievalMetrics,
      ...modelFailureMetrics,
      ...groundingMetrics
    ]);
    return true;
  } catch {
    return false;
  }
}

export const __test = { safeCode, safeErrorClass, safeDiagnosticReason, modelFailureMetric };
