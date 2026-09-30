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

function supportCheckFailureReason(error) {
  const message = String(error?.message || '').trim();
  const name = String(error?.name || '').trim();
  if (name === 'AbortError' || /abort|timeout/i.test(message)) return 'TIMEOUT';
  if (/^(INVOCATION_LIMIT_REQUIRED|INVOCATION_BUDGET_(STORE_UNAVAILABLE|INVALID|EXHAUSTED|STORE_FAILED))$/.test(message)) return 'BUDGET';
  if (/^SUPPORT_CHECK_LANGUAGE_/.test(message)) return 'LANGUAGE';
  if (/^SUPPORT_CHECK_(MODEL_MISMATCH|REVISION_MISMATCH|MANIFEST_MISMATCH|INVALID_DECISION|INVALID_RESULT)$/.test(message)) return 'PIN_OR_RESPONSE';
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

export async function validateGroundedClaims({ claims, evidencePack, supportCheck } = {}) {
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

  const semanticResults = await mapWithConcurrency(
    eligible,
    SUPPORT_CHECK_CONCURRENCY,
    async ({ claim, citedEvidence, position }) => {
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
      }
    }
  );

  const semanticByPosition = new Map(semanticResults.map((result) => [result.position, result]));
  structuralResults.forEach((result, position) => {
    const finalResult = result.rejection ? result : semanticByPosition.get(position);
    if (finalResult?.accepted) acceptedClaims.push(finalResult.claim);
    else if (finalResult?.rejection) rejectedClaims.push(finalResult.rejection);
  });

  return {
    ok: rejectedClaims.length === 0,
    acceptedClaims,
    rejectedClaims
  };
}
