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

  let works;
  try {
    works = await discover(task, { env, perPage });
  } catch {
    return { ok: false, code: 'DISCOVER_FAILED', claims: [] };
  }

  const relevantWorks = filterRelevantWorks(task, works);
  if (!relevantWorks.length) {
    return { ok: true, code: 'OK', claims: [], evidence: [], evidence_pack_id: null };
  }

  let evidencePack;
  try {
    evidencePack = packFactory(relevantWorks, packOptions);
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
  try {
    modelResult = await modelAdapter.generateClaims({ task, evidencePack });
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

  const claims = normalizeModelClaims(modelResult);
  if (!claims) {
    return {
      ok: false,
      code: 'MODEL_OUTPUT_INVALID',
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  let grounding;
  try {
    grounding = await validateGroundedClaims({ claims, evidencePack, supportCheck });
  } catch {
    return {
      ok: false,
      code: 'GROUNDING_VALIDATION_FAILED',
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  if (!grounding.ok) {
    return {
      ok: false,
      code: 'GROUNDING_REJECTED',
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  return {
    ok: true,
    code: 'OK',
    claims: grounding.acceptedClaims,
    evidence_pack_id: evidencePack.pack_id,
    evidence: evidencePack.evidence
  };
}
