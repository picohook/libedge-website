import { Discover } from './discover.js';
import { createEvidencePack } from './evidence-pack.js';
import { validateGroundedClaims } from './grounding-validator.js';
import { filterRelevantWorks } from './relevance.js';

function safeErrorClass(error) {
  const name = typeof error?.name === 'string' ? error.name.trim() : '';
  return /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name) ? name : 'UnknownError';
}

function safeDiagnosticReason(error) {
  const reason = typeof error?.diagnostic_reason === 'string' ? error.diagnostic_reason.trim() : '';
  return /^(MODEL_OUTPUT_EMPTY|MODEL_OUTPUT_NOT_JSON|MODEL_OUTPUT_CLAIMS_REQUIRED)$/.test(reason) ? reason : null;
}

function groundingDiagnosticSummary(rejectedClaims = []) {
  const counts = {};
  for (const item of rejectedClaims) {
    const code = String(item?.code || '').trim();
    const reason = String(item?.reason || '').trim();
    const key = [
      'CLAIM_TEXT_REQUIRED','EVIDENCE_ID_REQUIRED','EVIDENCE_ID_UNKNOWN',
      'SUPPORT_CHECK_REQUIRED','CLAIM_UNSUPPORTED','SUPPORT_CHECK_FAILED'
    ].includes(code) ? code : 'OTHER';
    counts[key] = (counts[key] || 0) + 1;
    if (key === 'CLAIM_UNSUPPORTED' && /^(SUPPORT|NOT_SUPPORTED|UNSUPPORTED)$/.test(reason)) {
      const reasonKey = `CLAIM_UNSUPPORTED_${reason}`;
      counts[reasonKey] = (counts[reasonKey] || 0) + 1;
    }
    if (key === 'SUPPORT_CHECK_FAILED' && /^(TIMEOUT|BUDGET|LANGUAGE|PIN_OR_RESPONSE|TRANSPORT_OR_OTHER)$/.test(reason)) {
      const reasonKey = `SUPPORT_CHECK_FAILED_${reason}`;
      counts[reasonKey] = (counts[reasonKey] || 0) + 1;
    }
  }
  return { rejected_count: rejectedClaims.length, rejection_counts: counts };
}

function gatePassed(providerGate) {
  return providerGate?.status === 'PASS';
}

function normalizeModelClaims(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.claims)) return result.claims;
  return null;
}

/**
 * Provider-independent orchestration boundary.
 *
 * Retrieval is always local to DISCOVER. A raw research task may cross the
 * injected model-adapter boundary only after an explicit Provider Privacy Gate
 * PASS. The adapter contract is intentionally provider-neutral and receives no
 * user/account/session/quota context from this layer.
 *
 * No partially grounded response is render-ready: if any claim fails the
 * grounding boundary, the outward claims array is empty.
 */
export async function orchestrateResearchAnswer({
  query,
  env,
  perPage = 10,
  providerGate,
  modelAdapter,
  supportCheck,
  discover = Discover,
  packFactory = createEvidencePack,
  packOptions
} = {}) {
  const task = String(query ?? '').trim();
  if (!task) {
    return { ok: false, code: 'ASSISTANT_QUERY_REQUIRED', claims: [] };
  }

  const diagnosticTimings = {};
  let stageStartedAt = Date.now();
  let works;
  try {
    works = await discover(task, { env, perPage });
    diagnosticTimings.discover_ms = Date.now() - stageStartedAt;
  } catch {
    return { ok: false, code: 'DISCOVER_FAILED', claims: [] };
  }

  const relevantWorks = filterRelevantWorks(task, works);
  if (!relevantWorks.length) {
    return { ok: true, code: 'OK', claims: [], evidence: [], evidence_pack_id: null };
  }

  let evidencePack;
  stageStartedAt = Date.now();
  try {
    evidencePack = packFactory(relevantWorks, packOptions);
    diagnosticTimings.evidence_pack_ms = Date.now() - stageStartedAt;
  } catch {
    return { ok: false, code: 'EVIDENCE_PACK_FAILED', claims: [] };
  }

  if (!gatePassed(providerGate)) {
    return {
      ok: false,
      code: 'PROVIDER_PRIVACY_GATE_REQUIRED',
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  if (!modelAdapter || typeof modelAdapter.generateClaims !== 'function') {
    return {
      ok: false,
      code: 'MODEL_ADAPTER_REQUIRED',
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  let modelResult;
  stageStartedAt = Date.now();
  try {
    modelResult = await modelAdapter.generateClaims({ task, evidencePack });
    diagnosticTimings.model_ms = Date.now() - stageStartedAt;
  } catch (error) {
    return {
      ok: false,
      code: 'MODEL_ADAPTER_FAILED',
      diagnostic_error_class: safeErrorClass(error),
      diagnostic_reason: safeDiagnosticReason(error),
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  const diagnosticUsage = modelResult?.usage || null;
  const claims = normalizeModelClaims(modelResult);
  if (!claims) {
    return {
      ok: false,
      code: 'MODEL_OUTPUT_INVALID',
      diagnostic_usage: diagnosticUsage,
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  let grounding;
  stageStartedAt = Date.now();
  try {
    grounding = await validateGroundedClaims({ claims, evidencePack, supportCheck });
    diagnosticTimings.grounding_ms = Date.now() - stageStartedAt;
  } catch {
    return {
      ok: false,
      code: 'GROUNDING_VALIDATION_FAILED',
      diagnostic_usage: diagnosticUsage,
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  if (!grounding.ok) {
    return {
      ok: false,
      code: 'GROUNDING_REJECTED',
      diagnostic_usage: diagnosticUsage,
      diagnostic_timings: diagnosticTimings,
      claims: [],
      evidence_pack_id: evidencePack.pack_id,
      diagnostic_grounding: groundingDiagnosticSummary(grounding.rejectedClaims)
    };
  }

  return {
    ok: true,
    code: 'OK',
    diagnostic_usage: diagnosticUsage,
    diagnostic_timings: diagnosticTimings,
    claims: grounding.acceptedClaims,
    evidence_pack_id: evidencePack.pack_id,
    evidence: evidencePack.evidence
  };
}
