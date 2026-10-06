const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const ADMIN_EMAIL = process.env.LIBEDGE_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIBEDGE_SMOKE_ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Missing benchmark credentials');

const CASES = [
  { name: 'humanities', query: 'Ottoman Empire print culture' },
  { name: 'social-science', query: 'remote work productivity randomized' },
  { name: 'biomedical', query: 'CRISPR base editing sickle cell' }
];
const CONFIGS = [
  { name: 'lexical-10', mode: 'lexical', lexical_candidate_depth: 10, final_result_target: 10 },
  { name: 'lexical-50', mode: 'lexical', lexical_candidate_depth: 50, final_result_target: 10 },
  { name: 'semantic-50', mode: 'semantic', lexical_candidate_depth: 50, final_result_target: 10 }
];

const userCookies = new Map();
const adminCookies = new Map();
await login(EMAIL, PASSWORD, userCookies);
await login(ADMIN_EMAIL, ADMIN_PASSWORD, adminCookies);
const original = await getControls();
const userId = await smokeUserId();

try {
  for (const config of CONFIGS) {
    await setControls(config);
    for (const candidate of CASES) {
      const beforeTelemetry = await telemetrySnapshot();
      const beforeRequestId = await latestRequestId(userId);
      const response = await fetch(`${BASE_URL}/api/assistant/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader(userCookies) },
        body: JSON.stringify({ query: candidate.query }),
        redirect: 'manual'
      });
      const body = await response.json();
      if (response.status !== 200) throw new Error(`${config.name}/${candidate.name} HTTP ${response.status}`);
      const request = await latestNewRequest(userId, beforeRequestId);
      const afterTelemetry = await telemetrySnapshot();
      const verification = body?.research_summary?.verification || {};
      const supporting = new Set(
        (Array.isArray(body?.claims) ? body.claims : [])
          .flatMap((claim) => Array.isArray(claim?.evidence_ids) ? claim.evidence_ids : [])
          .filter((id) => typeof id === 'string' && id.length > 0)
      );
      console.log('RETRIEVAL_BENCHMARK', JSON.stringify({
        config: config.name,
        case: candidate.name,
        status: request.status,
        retrieval_mode: request.retrieval?.mode ?? null,
        candidate_depth: request.retrieval?.candidate_depth ?? null,
        retrieved_count: request.retrieval?.retrieved_count ?? null,
        authorized_relevant_count: request.retrieval?.authorized_relevant_count ?? null,
        abstract_bearing_count: request.retrieval?.abstract_bearing_count ?? null,
        metadata_only_count: request.retrieval?.metadata_only_count ?? null,
        checked_count: countOrNull(verification.checked_count),
        verified_count: countOrNull(verification.verified_count),
        truncated_count: countOrNull(verification.truncated_count),
        rejection_counts: safeRejectionCounts(verification.rejection_counts),
        unique_supporting_source_count: supporting.size,
        discover_ms: request.stage_latency_ms?.discover ?? null,
        grounding_ms: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_ms_total'),
        support_check_ms: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_ms_total'),
        grounding_overhead_ms: nonNegativeDifference(
          metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_ms_total'),
          metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_ms_total')
        ),
        verification_reused: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_verified_result_cache_hit') > 0,
        language_claim_rejections: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_rejection_support_check_failed_language_claim'),
        language_evidence_rejections: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_rejection_support_check_failed_language_evidence'),
        unsupported_support_rejections: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_rejection_claim_unsupported_support'),
        unsupported_not_supported_rejections: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_rejection_claim_unsupported_not_supported'),
        unsupported_unspecified_rejections: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_rejection_claim_unsupported_unsupported'),
        total_latency_ms: request.latency_ms ?? null,
        discovery_cost_usd: finiteOrNull(request.discovery_cost_usd)
      }));
    }
  }
} finally {
  await setControls({
    mode: original.mode,
    lexical_candidate_depth: original.lexical_candidate_depth,
    final_result_target: original.final_result_target
  });
}

async function login(email, password, jar) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ email, password }),
    redirect: 'manual'
  });
  applyCookies(response, jar);
  if (response.status !== 200 || !jar.get('authToken')) throw new Error('benchmark login failed');
}
async function getControls() {
  return adminJson('/api/admin/research/retrieval-controls');
}
async function setControls(config) {
  const body = await adminJson('/api/admin/research/retrieval-controls', {
    method: 'POST',
    body: JSON.stringify(config)
  });
  if (body.success !== true || body.mode !== config.mode ||
      body.lexical_candidate_depth !== config.lexical_candidate_depth ||
      body.final_result_target !== config.final_result_target) {
    throw new Error('retrieval control read-back mismatch');
  }
}
async function smokeUserId() {
  const body = await adminJson('/api/admin/research/usage?days=30');
  const row = (body.users || []).find((item) => String(item.email || '').toLowerCase() === EMAIL.toLowerCase());
  const id = Number(row?.user_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('smoke user not found in Research usage');
  return id;
}
async function latestRequestId(userId) {
  const body = await adminJson(`/api/admin/research/usage/requests?user_id=${userId}&days=1&limit=1`);
  return body.requests?.[0]?.request_id || null;
}
async function latestNewRequest(userId, beforeRequestId) {
  const body = await adminJson(`/api/admin/research/usage/requests?user_id=${userId}&days=1&limit=5`);
  const request = (body.requests || []).find((row) => row.request_id !== beforeRequestId);
  if (!request) throw new Error('benchmark request drilldown missing');
  return request;
}
async function telemetrySnapshot() {
  const body = await adminJson('/api/admin/system-health');
  const metrics = body?.research_telemetry?.snapshot?.metrics;
  if (!metrics || typeof metrics !== 'object') throw new Error('research telemetry snapshot unavailable');
  return metrics;
}
function nonNegativeDifference(total, part) {
  return Number.isFinite(total) && Number.isFinite(part) && total >= part ? total - part : null;
}
function metricDelta(before, after, key) {
  const start = Number(before?.[key] || 0);
  const end = Number(after?.[key] || 0);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
}
async function adminJson(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: cookieHeader(adminCookies), ...(init.headers || {}) },
    redirect: 'manual'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return body;
}
function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function countOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function safeRejectionCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([code, amount]) =>
    /^[A-Z][A-Z0-9_]{0,79}$/.test(code) && Number.isSafeInteger(amount) && amount > 0
  ));
}
function cookieHeader(jar) { return [...jar].map(([k,v]) => `${k}=${v}`).join('; '); }
function applyCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : split(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) jar.set(match[1], match[2]);
  }
}
function split(value) { return value ? value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((x) => x.trim()) : []; }
