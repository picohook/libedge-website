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
export function recordAssistantOutcome(env, { code, durationMs } = {}) {
  const payload = {
    event: 'research_assistant_outcome',
    code: safeCode(code),
    duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
    environment: String(env?.ENVIRONMENT || 'unknown')
  };

  try {
    console.log(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export const __test = { safeCode };
