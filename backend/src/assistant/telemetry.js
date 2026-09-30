import { recordResearchMetrics } from '../research/telemetry.js';
const OUTCOME_CODES = new Set([
  'OK',
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
export async function recordAssistantOutcome(env, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic } = {}) {
  const payload = {
    event: 'research_assistant_outcome',
    code: safeCode(code),
    duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
    environment: String(env?.ENVIRONMENT || 'unknown')
  };
  const sanitizedErrorClass = safeErrorClass(errorClass);
  if (sanitizedErrorClass) payload.error_class = sanitizedErrorClass;
  const sanitizedDiagnosticReason = safeDiagnosticReason(diagnosticReason);
  if (sanitizedDiagnosticReason) payload.diagnostic_reason = sanitizedDiagnosticReason;

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
    await recordResearchMetrics(env, [
      ['assistant_requests', 1],
      [`assistant_outcome_${metricCode}`, 1],
      ...groundingMetrics
    ]);
    return true;
  } catch {
    return false;
  }
}

export const __test = { safeCode, safeErrorClass, safeDiagnosticReason };
