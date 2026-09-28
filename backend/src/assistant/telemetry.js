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
  'GROUNDING_REJECTED'
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
export function recordAssistantOutcome(env, { code, durationMs, errorClass, diagnosticReason } = {}) {
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

  try {
    console.log(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export const __test = { safeCode, safeErrorClass, safeDiagnosticReason };
