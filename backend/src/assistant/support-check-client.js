import { SUPPORT_CHECK_PIN, supportCheckGateFromEnv } from './support-check-config.js';

const DEFAULT_TIMEOUT_MS = 5000;

function serviceUrl(env) {
  const raw = String(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_URL || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('SUPPORT_CHECK_URL_HTTPS_REQUIRED');
  return url.toString();
}

function timeoutMs(env) {
  const parsed = Number(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(parsed), 15000);
}

function assertPinnedResponse(body) {
  if (!body || typeof body !== 'object') throw new Error('SUPPORT_CHECK_INVALID_RESULT');
  if (body.model !== SUPPORT_CHECK_PIN.model) throw new Error('SUPPORT_CHECK_MODEL_MISMATCH');
  if (body.revision !== SUPPORT_CHECK_PIN.revision) throw new Error('SUPPORT_CHECK_REVISION_MISMATCH');
  if (body.engine_manifest_sha256 !== SUPPORT_CHECK_PIN.engineManifestSha256) {
    throw new Error('SUPPORT_CHECK_MANIFEST_MISMATCH');
  }
  if (body.primary_decision !== 'SUPPORT' && body.primary_decision !== 'NOT_SUPPORTED') {
    throw new Error('SUPPORT_CHECK_INVALID_DECISION');
  }
  return {
    supported: body.primary_decision === 'SUPPORT',
    reason: body.diagnostic || body.primary_decision
  };
}

/**
 * Creates the fail-closed semantic support-check boundary.
 *
 * The checker remains disabled unless both the explicit feature flag and the
 * checker-specific privacy gate are enabled. This is intentionally independent
 * from the answer-model Provider Privacy Gate: claim/evidence text is itself
 * research-interest-bearing content.
 */
export function createSupportCheck(env, { fetchImpl = fetch } = {}) {
  const gate = supportCheckGateFromEnv(env);
  if (!gate.enabled || gate.privacyStatus !== 'PASS') return null;

  let url;
  try {
    url = serviceUrl(env);
  } catch {
    return null;
  }
  if (!url) return null;

  const token = String(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_TOKEN || '').trim();
  if (!token) return null;

  return async function supportCheck(claim, citedEvidence) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs(env));
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pin: SUPPORT_CHECK_PIN,
          claim: { text: claim.text },
          evidence: citedEvidence.map((item) => ({
            evidence_id: item.evidence_id,
            title: item.title,
            abstract: item.abstract
          }))
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('SUPPORT_CHECK_HTTP_FAILED');
      return assertPinnedResponse(await response.json());
    } finally {
      clearTimeout(timer);
    }
  };
}
