import { Discover } from './discover.js';
import { createEvidencePack } from './evidence-pack.js';
import { validateGroundedClaims } from './grounding-validator.js';
import { filterEnglishEligibleWorks, filterRelevantWorks } from './relevance.js';

function safeErrorClass(error) {
  const name = typeof error?.name === 'string' ? error.name.trim() : '';
  return /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name) ? name : 'UnknownError';
}

function safeDiagnosticReason(error) {
  const reason = typeof error?.diagnostic_reason === 'string' ? error.diagnostic_reason.trim() : '';
  return /^(MODEL_OUTPUT_EMPTY|MODEL_OUTPUT_NOT_JSON|MODEL_OUTPUT_CLAIMS_REQUIRED)$/.test(reason) ? reason : null;
}

function groundingDiagnosticSummary(rejectedClaims = [], totalClaims = 0) {
  const counts = {};
  for (const item of rejectedClaims) {
    const code = String(item?.code || '').trim();
    const reason = String(item?.reason || '').trim();
    const key = [
      'CLAIM_TEXT_REQUIRED','EVIDENCE_ID_REQUIRED','EVIDENCE_ID_UNKNOWN',
      'SUPPORT_CHECK_REQUIRED','SUPPORT_CHECK_BUDGET_TRUNCATED','CLAIM_UNSUPPORTED','SUPPORT_CHECK_FAILED'
    ].includes(code) ? code : 'OTHER';
    counts[key] = (counts[key] || 0) + 1;
    if (key === 'CLAIM_UNSUPPORTED' && /^(SUPPORT|NOT_SUPPORTED|UNSUPPORTED)$/.test(reason)) {
      const reasonKey = `CLAIM_UNSUPPORTED_${reason}`;
      counts[reasonKey] = (counts[reasonKey] || 0) + 1;
    }
    if (key === 'SUPPORT_CHECK_FAILED' && /^(TIMEOUT|BUDGET|LANGUAGE|LANGUAGE_CLAIM|LANGUAGE_EVIDENCE|PIN_OR_RESPONSE|TRANSPORT_OR_OTHER)$/.test(reason)) {
      const reasonKey = `SUPPORT_CHECK_FAILED_${reason}`;
      counts[reasonKey] = (counts[reasonKey] || 0) + 1;
    }
  }
  return {
    claim_count: Math.max(0, Number(totalClaims) || 0),
    accepted_count: Math.max(0, (Number(totalClaims) || 0) - rejectedClaims.length),
    rejected_count: rejectedClaims.length,
    rejection_counts: counts
  };
}

function gatePassed(providerGate) {
  return providerGate?.status === 'PASS';
}

function normalizeModelClaims(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.claims)) return result.claims;
  return null;
}

const CLAIM_LOCAL_REJECTION_CODES = new Set([
  'CLAIM_TEXT_REQUIRED',
  'EVIDENCE_ID_REQUIRED',
  'EVIDENCE_ID_UNKNOWN',
  'CLAIM_UNSUPPORTED',
  'SUPPORT_CHECK_BUDGET_TRUNCATED'
]);

function hasBlockingGroundingFailure(rejectedClaims = []) {
  return rejectedClaims.some((item) => !CLAIM_LOCAL_REJECTION_CODES.has(String(item?.code || '').trim()));
}

function evidenceForAcceptedClaims(evidence = [], acceptedClaims = []) {
  const citedIds = new Set(acceptedClaims.flatMap((claim) => claim.evidence_ids || []));
  return evidence.filter((item) => citedIds.has(item.evidence_id));
}

function evidenceDepthDiagnostic(works = []) {
  const abstractBearing = works.filter((work) => Boolean(String(work?.abstract || '').trim())).length;
  return {
    abstract_bearing_count: abstractBearing,
    metadata_only_count: Math.max(0, works.length - abstractBearing)
  };
}

/**
 * Provider-independent orchestration boundary.
 *
 * Retrieval is always local to DISCOVER. A raw research task may cross the
 * injected model-adapter boundary only after an explicit Provider Privacy Gate
 * PASS. The adapter contract is intentionally provider-neutral and receives no
 * user/account/session/quota context from this layer.
 *
 * Only individually validated claims are render-ready. Claim-local semantic
 * or structural rejections may be omitted when at least one independent claim
 * remains accepted. Any verifier/infrastructure failure keeps the entire
 * response fail-closed.
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
  const diagnosticCosts = { discovery_cost_usd: 0 };
  let diagnosticRetrieval = { retrieved_count: 0, relevant_count: 0, language_eligible_count: 0, authorized_relevant_count: 0 };
  let stageStartedAt = Date.now();
  let works;
  try {
    works = await discover(task, { env, perPage });
    diagnosticTimings.discover_ms = Date.now() - stageStartedAt;
  } catch {
    diagnosticTimings.discover_ms = Date.now() - stageStartedAt;
    return { ok: false, code: 'DISCOVER_FAILED', diagnostic_timings: diagnosticTimings, diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval, claims: [] };
  }

  diagnosticCosts.discovery_cost_usd = Number(works?.diagnostic_discovery_cost_usd) || 0;
  const discoveredWorks = Array.isArray(works) ? works : [];
  const relevantBeforeLanguage = filterRelevantWorks(task, discoveredWorks);
  const languageEligibleWorks = filterEnglishEligibleWorks(discoveredWorks);
  const relevantWorks = filterRelevantWorks(task, languageEligibleWorks);
  diagnosticRetrieval = {
    retrieval_mode: String(works?.diagnostic_retrieval_mode || 'unknown'),
    candidate_depth: Number(works?.diagnostic_candidate_depth) || discoveredWorks.length,
    retrieved_count: Number(works?.diagnostic_retrieved_count) || discoveredWorks.length,
    relevant_count: Number(works?.diagnostic_relevant_count) || relevantBeforeLanguage.length,
    language_eligible_count: Number(works?.diagnostic_language_eligible_count) || languageEligibleWorks.length,
    authorized_relevant_count: Number(works?.diagnostic_authorized_relevant_count) || relevantWorks.length,
    ...evidenceDepthDiagnostic(relevantWorks)
  };
  if (!relevantWorks.length) {
    return {
      ok: true,
      code: 'NO_AUTHORIZED_EVIDENCE',
      diagnostic_timings: diagnosticTimings,
      diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval,
      claims: [],
      evidence: [],
      evidence_pack_id: null
    };
  }

  let evidencePack;
  stageStartedAt = Date.now();
  try {
    evidencePack = packFactory(relevantWorks, { ...packOptions, languageAuthorized: true });
    diagnosticTimings.evidence_pack_ms = Date.now() - stageStartedAt;
  } catch {
    diagnosticTimings.evidence_pack_ms = Date.now() - stageStartedAt;
    return { ok: false, code: 'EVIDENCE_PACK_FAILED', diagnostic_timings: diagnosticTimings, diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval, claims: [] };
  }

  if (!gatePassed(providerGate)) {
    return {
      ok: false,
      code: 'PROVIDER_PRIVACY_GATE_REQUIRED',
      diagnostic_timings: diagnosticTimings,
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  if (!modelAdapter || typeof modelAdapter.generateClaims !== 'function') {
    return {
      ok: false,
      code: 'MODEL_ADAPTER_REQUIRED',
      diagnostic_timings: diagnosticTimings,
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
    diagnosticTimings.model_ms = Date.now() - stageStartedAt;
    return {
      ok: false,
      code: 'MODEL_ADAPTER_FAILED',
      diagnostic_timings: diagnosticTimings,
      diagnostic_error_class: safeErrorClass(error),
      diagnostic_reason: safeDiagnosticReason(error),
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  const diagnosticUsage = modelResult?.usage || null;
  if (Number.isFinite(Number(diagnosticUsage?.llm_cost_usd))) diagnosticCosts.llm_cost_usd = Number(diagnosticUsage.llm_cost_usd);
  const claims = normalizeModelClaims(modelResult);
  if (!claims) {
    return {
      ok: false,
      code: 'MODEL_OUTPUT_INVALID',
      diagnostic_usage: diagnosticUsage,
      diagnostic_timings: diagnosticTimings,
      diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval,
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  if (claims.length === 0) {
    return {
      ok: true,
      code: 'NO_SUPPORTABLE_CLAIMS',
      diagnostic_usage: diagnosticUsage,
      diagnostic_timings: diagnosticTimings,
      diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval,
      claims: [],
      evidence: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  let grounding;
  stageStartedAt = Date.now();
  try {
    grounding = await validateGroundedClaims({ claims, evidencePack, supportCheck, maxSupportChecks: env?.RESEARCH_SUPPORT_CHECKS_PER_REQUEST });
    diagnosticTimings.grounding_ms = Date.now() - stageStartedAt;
  } catch {
    diagnosticTimings.grounding_ms = Date.now() - stageStartedAt;
    return {
      ok: false,
      code: 'GROUNDING_VALIDATION_FAILED',
      diagnostic_usage: diagnosticUsage,
      diagnostic_timings: diagnosticTimings,
      diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval,
      claims: [],
      evidence_pack_id: evidencePack.pack_id
    };
  }

  const supportingEvidenceIds = new Set(
    grounding.acceptedClaims.flatMap((claim) => Array.isArray(claim?.evidence_ids) ? claim.evidence_ids : [])
  );
  if (Number.isFinite(Number(grounding?.diagnostics?.support_check_ms))) {
    diagnosticTimings.support_check_ms = Math.max(0, Math.trunc(Number(grounding.diagnostics.support_check_ms)));
  }
  const diagnosticGrounding = {
    ...groundingDiagnosticSummary(grounding.rejectedClaims, claims.length),
    ...(grounding.diagnostics || {}),
    unique_supporting_source_count: supportingEvidenceIds.size,
    single_source_verified_answer: grounding.acceptedClaims.length > 0 && supportingEvidenceIds.size === 1 ? 1 : 0
  };
  const blockingGroundingFailure = hasBlockingGroundingFailure(grounding.rejectedClaims);

  if (blockingGroundingFailure || grounding.acceptedClaims.length === 0) {
    return {
      ok: false,
      code: 'GROUNDING_REJECTED',
      diagnostic_usage: diagnosticUsage,
      diagnostic_timings: diagnosticTimings,
      diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval,
      claims: [],
      evidence_pack_id: evidencePack.pack_id,
      diagnostic_grounding: diagnosticGrounding
    };
  }

  return {
    ok: true,
    code: 'OK',
    diagnostic_usage: diagnosticUsage,
    diagnostic_timings: diagnosticTimings,
    diagnostic_costs: diagnosticCosts,
      diagnostic_retrieval: diagnosticRetrieval,
    claims: grounding.acceptedClaims,
    evidence_pack_id: evidencePack.pack_id,
    diagnostic_grounding: diagnosticGrounding,
    evidence: evidenceForAcceptedClaims(evidencePack.evidence, grounding.acceptedClaims)
  };
}
