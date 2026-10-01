const RETENTION_DAYS = 90;
const ALLOWED_OPERATIONS = new Set(['assistant_ask']);
const SAFE_OUTCOME = /^[A-Z][A-Z0-9_]{0,79}$/;

function positiveId(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function optionalNonNegativeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function safeOutcomeCode(value) {
  const code = String(value || '').trim();
  return SAFE_OUTCOME.test(code) ? code : 'OTHER';
}

/**
 * Best-effort, content-free, identity-attributed Research usage event.
 * Never accepts or stores query/answer/claim/evidence/prompt/provider payloads.
 */
export async function recordResearchUsageEvent(env, {
  userId,
  institutionId,
  operation = 'assistant_ask',
  outcomeCode,
  latencyMs,
  inputTokens,
  outputTokens
} = {}) {
  if (!env?.DB) return false;
  const uid = positiveId(userId);
  if (!uid || !ALLOWED_OPERATIONS.has(operation)) return false;

  const iid = positiveId(institutionId);
  const latency = Math.max(0, Math.round(Number(latencyMs) || 0));
  const input = optionalNonNegativeInteger(inputTokens);
  const output = optionalNonNegativeInteger(outputTokens);
  try {
    await env.DB.prepare(`
      INSERT INTO research_usage_events
        (user_id, institution_id, operation, outcome_code, latency_ms, input_tokens, output_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(uid, iid, operation, safeOutcomeCode(outcomeCode), latency, input, output).run();
    return true;
  } catch (error) {
    console.warn('research usage event write failed', error);
    return false;
  }
}

export async function pruneResearchUsageEvents(env) {
  if (!env?.DB) return false;
  try {
    await env.DB.prepare(
      `DELETE FROM research_usage_events WHERE created_at < datetime('now', '-${RETENTION_DAYS} days')`
    ).run();
    return true;
  } catch (error) {
    console.warn('research usage event prune failed', error);
    return false;
  }
}

export const RESEARCH_USAGE_RETENTION_DAYS = RETENTION_DAYS;
export const __test = { positiveId, safeOutcomeCode, optionalNonNegativeInteger };
