import { Discover } from './discover.js';
import { createEvidencePack } from './evidence-pack.js';
import { validateGroundedClaims } from './grounding-validator.js';

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
  if (!task) return { ok: false, code: 'ASSISTANT_QUERY_REQUIRED', claims: [] };

  let works;
  try {
    works = await discover(task, { env, perPage });
  } catch {
    return { ok: false, code: 'DISCOVER_FAILED', claims: [] };
  }

  let evidencePack;
  try {
    evidencePack = packFactory(works, packOptions);
  } catch {
    return { ok: false, code: 'EVIDENCE_PACK_FAILED', claims: [] };
  }

  if (!gatePassed(providerGate)) {
    return { ok: false, code: 'PROVIDER_PRIVACY_GATE_REQUIRED', claims: [], evidence_pack_id: evidencePack.pack_id };
  }

  if (!modelAdapter || typeof modelAdapter.generateClaims !== 'function') {
    return { ok: false, code: 'MODEL_ADAPTER_REQUIRED', claims: [], evidence_pack_id: evidencePack.pack_id };
  }

  let modelResult;
  try {
    modelResult = await modelAdapter.generateClaims({ task, evidencePack });
  } catch {
    return { ok: false, code: 'MODEL_ADAPTER_FAILED', claims: [], evidence_pack_id: evidencePack.pack_id };
  }

  const claims = normalizeModelClaims(modelResult);
  if (!claims) {
    return { ok: false, code: 'MODEL_OUTPUT_INVALID', claims: [], evidence_pack_id: evidencePack.pack_id };
  }

  let grounding;
  try {
    grounding = await validateGroundedClaims({ claims, evidencePack, supportCheck });
  } catch {
    return { ok: false, code: 'GROUNDING_VALIDATION_FAILED', claims: [], evidence_pack_id: evidencePack.pack_id };
  }

  if (!grounding.ok) {
    return {
      ok: false,
      code: 'GROUNDING_REJECTED',
      claims: [],
      evidence_pack_id: evidencePack.pack_id,
      rejected_claims: grounding.rejectedClaims
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
