import { evidenceById } from './evidence-pack.js';

function normalizeSupportResult(result) {
  if (result === true) return { supported: true, reason: null };
  if (result === false) return { supported: false, reason: 'UNSUPPORTED' };
  if (result && typeof result === 'object') {
    return {
      supported: result.supported === true,
      reason: result.reason || (result.supported === true ? null : 'UNSUPPORTED')
    };
  }
  return { supported: false, reason: 'SUPPORT_CHECK_INVALID_RESULT' };
}

function normalizeClaim(claim, index) {
  const text = String(claim?.text ?? '').trim();
  const evidenceIds = Array.isArray(claim?.evidence_ids)
    ? [...new Set(claim.evidence_ids.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  return { index, text, evidence_ids: evidenceIds };
}

/**
 * Fail-closed response-boundary validator.
 *
 * Structural citation checks are performed here, but semantic support is not
 * guessed. A caller must supply supportCheck(claim, citedEvidence) to establish
 * that the cited material actually supports the factual claim. Without that
 * verifier, claims are rejected rather than treated as grounded.
 */
const SUPPORT_CHECK_CONCURRENCY = 2;
export const DEFAULT_SUPPORT_CHECKS_PER_REQUEST = 4;

function supportCheckLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SUPPORT_CHECKS_PER_REQUEST;
  return Math.min(parsed, DEFAULT_SUPPORT_CHECKS_PER_REQUEST);
}

function supportCheckFailureReason(error) {
  const message = String(error?.message || '').trim();
  const name = String(error?.name || '').trim();
  if (name === 'AbortError' || /abort|timeout/i.test(message)) return 'TIMEOUT';
  if (/^(INVOCATION_LIMIT_REQUIRED|INVOCATION_BUDGET_(STORE_UNAVAILABLE|INVALID|EXHAUSTED|STORE_FAILED))$/.test(message)) return 'BUDGET';
  if (message === 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED_CLAIM') return 'LANGUAGE_CLAIM';
  if (message === 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED_EVIDENCE') return 'LANGUAGE_EVIDENCE';
  if (/^SUPPORT_CHECK_LANGUAGE_/.test(message)) return 'LANGUAGE';
  if (/^SUPPORT_CHECK_(MODEL_MISMATCH|REVISION_MISMATCH|MANIFEST_MISMATCH|INVALID_DECISION|INVALID_RESULT)$/.test(message)) return 'PIN_OR_RESPONSE';
  if (name === 'ModelError') return 'TRANSPORT_MODEL_ERROR';
  if (/^(ServiceUnavailable|InternalFailure|InternalDependencyException)$/.test(name)) return 'TRANSPORT_SERVICE_UNAVAILABLE';
  if (name === 'ModelNotReadyException') return 'TRANSPORT_MODEL_NOT_READY';
  if (name === 'ValidationError') return 'TRANSPORT_VALIDATION';
  if (/^(ModelStreamError|InternalStreamFailure)$/.test(name)) return 'TRANSPORT_STREAM_ERROR';
  return 'TRANSPORT_OR_OTHER';
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function validateGroundedClaims({ claims, evidencePack, supportCheck, maxSupportChecks = DEFAULT_SUPPORT_CHECKS_PER_REQUEST } = {}) {
  if (!Array.isArray(claims)) throw new TypeError('GROUNDING_CLAIMS_REQUIRED');
  const byId = evidenceById(evidencePack);
  const acceptedClaims = [];
  const rejectedClaims = [];

  const structuralResults = claims.map((rawClaim, index) => {
    const claim = normalizeClaim(rawClaim, index);
    if (!claim.text) return { claim, rejection: { ...claim, code: 'CLAIM_TEXT_REQUIRED' } };
    if (claim.evidence_ids.length === 0) return { claim, rejection: { ...claim, code: 'EVIDENCE_ID_REQUIRED' } };

    const missingIds = claim.evidence_ids.filter((id) => !byId.has(id));
    if (missingIds.length) {
      return { claim, rejection: { ...claim, code: 'EVIDENCE_ID_UNKNOWN', missing_evidence_ids: missingIds } };
    }
    if (typeof supportCheck !== 'function') {
      return { claim, rejection: { ...claim, code: 'SUPPORT_CHECK_REQUIRED' } };
    }
    return { claim, citedEvidence: claim.evidence_ids.map((id) => byId.get(id)) };
  });

  const eligible = structuralResults
    .map((result, position) => ({ ...result, position }))
    .filter((result) => !result.rejection);
  const checkLimit = supportCheckLimit(maxSupportChecks);
  const checkable = eligible.slice(0, checkLimit);
  const truncated = eligible.slice(checkLimit);
  for (const { claim, position } of truncated) {
    structuralResults[position] = { claim, rejection: { ...claim, code: 'SUPPORT_CHECK_BUDGET_TRUNCATED' } };
  }

  const supportCheckStartedAt = Date.now();
  const supportCheckCallMs = [];
  const supportCheckQueueWaitMs = [];
  const semanticResults = await mapWithConcurrency(
    checkable,
    SUPPORT_CHECK_CONCURRENCY,
    async ({ claim, citedEvidence, position }) => {
      const callStartedAt = Date.now();
      supportCheckQueueWaitMs.push(Math.max(0, callStartedAt - supportCheckStartedAt));
      try {
        const verdict = normalizeSupportResult(await supportCheck(claim, citedEvidence));
        return verdict.supported
          ? { position, claim, accepted: true }
          : { position, claim, rejection: { ...claim, code: 'CLAIM_UNSUPPORTED', reason: verdict.reason } };
      } catch (error) {
        return {
          position,
          claim,
          rejection: { ...claim, code: 'SUPPORT_CHECK_FAILED', reason: supportCheckFailureReason(error) }
        };
      } finally {
        supportCheckCallMs.push(Math.max(0, Date.now() - callStartedAt));
      }
    }
  );
  const supportCheckMs = Date.now() - supportCheckStartedAt;
  const supportCheckCallMsTotal = supportCheckCallMs.reduce((sum, value) => sum + value, 0);
  const supportCheckCallMsMax = supportCheckCallMs.length ? Math.max(...supportCheckCallMs) : 0;
  const supportCheckQueueWaitMsTotal = supportCheckQueueWaitMs.reduce((sum, value) => sum + value, 0);
  const supportCheckQueueWaitMsMax = supportCheckQueueWaitMs.length ? Math.max(...supportCheckQueueWaitMs) : 0;

  const semanticByPosition = new Map(semanticResults.map((result) => [result.position, result]));
  structuralResults.forEach((result, position) => {
    const finalResult = result.rejection ? result : semanticByPosition.get(position);
    if (finalResult?.accepted) acceptedClaims.push(finalResult.claim);
    else if (finalResult?.rejection) rejectedClaims.push(finalResult.rejection);
  });

  return {
    ok: rejectedClaims.length === 0,
    acceptedClaims,
    rejectedClaims,
    diagnostics: {
      eligible_count: eligible.length,
      checked_count: checkable.length,
      truncated_count: truncated.length,
      support_check_limit: checkLimit,
      support_check_ms: supportCheckMs,
      support_check_call_ms_total: supportCheckCallMsTotal,
      support_check_call_ms_max: supportCheckCallMsMax,
      support_check_queue_wait_ms_total: supportCheckQueueWaitMsTotal,
      support_check_queue_wait_ms_max: supportCheckQueueWaitMsMax
    }
  };
}
