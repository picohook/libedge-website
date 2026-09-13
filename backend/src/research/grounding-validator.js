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
export async function validateGroundedClaims({ claims, evidencePack, supportCheck } = {}) {
  if (!Array.isArray(claims)) throw new TypeError('GROUNDING_CLAIMS_REQUIRED');
  const byId = evidenceById(evidencePack);
  const acceptedClaims = [];
  const rejectedClaims = [];

  for (let index = 0; index < claims.length; index += 1) {
    const claim = normalizeClaim(claims[index], index);
    if (!claim.text) {
      rejectedClaims.push({ ...claim, code: 'CLAIM_TEXT_REQUIRED' });
      continue;
    }
    if (claim.evidence_ids.length === 0) {
      rejectedClaims.push({ ...claim, code: 'EVIDENCE_ID_REQUIRED' });
      continue;
    }

    const missingIds = claim.evidence_ids.filter((id) => !byId.has(id));
    if (missingIds.length) {
      rejectedClaims.push({ ...claim, code: 'EVIDENCE_ID_UNKNOWN', missing_evidence_ids: missingIds });
      continue;
    }

    if (typeof supportCheck !== 'function') {
      rejectedClaims.push({ ...claim, code: 'SUPPORT_CHECK_REQUIRED' });
      continue;
    }

    const citedEvidence = claim.evidence_ids.map((id) => byId.get(id));
    try {
      const verdict = normalizeSupportResult(await supportCheck(claim, citedEvidence));
      if (!verdict.supported) {
        rejectedClaims.push({ ...claim, code: 'CLAIM_UNSUPPORTED', reason: verdict.reason });
        continue;
      }
      acceptedClaims.push(claim);
    } catch {
      rejectedClaims.push({ ...claim, code: 'SUPPORT_CHECK_FAILED' });
    }
  }

  return {
    ok: rejectedClaims.length === 0,
    acceptedClaims,
    rejectedClaims
  };
}
