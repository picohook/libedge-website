import fs from 'node:fs';

const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const ADMIN_EMAIL = process.env.LIBEDGE_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIBEDGE_SMOKE_ADMIN_PASSWORD;
const MANIFEST = process.env.GOLDEN_DEV_MANIFEST || 'docs/experiments/research-golden-set-v1-development-set.json';
if (!EMAIL || !PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Missing calibration credentials');

const parsed = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const CASES = Array.isArray(parsed?.cases) ? parsed.cases : [];
validateCases(CASES);

const userCookies = new Map();
const adminCookies = new Map();
await login(EMAIL, PASSWORD, userCookies);
await login(ADMIN_EMAIL, ADMIN_PASSWORD, adminCookies);
const userId = await smokeUserId();

for (const candidate of CASES) {
  const beforeTelemetry = await telemetrySnapshot();
  const beforeRequestId = await latestRequestId(userId);
  const response = await fetch(`${BASE_URL}/api/assistant/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader(userCookies) },
    body: JSON.stringify({ query: candidate.query }),
    redirect: 'manual'
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 200) throw new Error(`${candidate.id} HTTP ${response.status}`);
  const request = await latestNewRequest(userId, beforeRequestId);
  const afterTelemetry = await telemetrySnapshot();
  const verification = body?.research_summary?.verification || {};
  const callTotal = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_call_ms_total');
  const callMax = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_call_ms_max_total');
  const queueTotal = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_queue_wait_ms_total');
  const queueMax = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_queue_wait_ms_max_total');
  const reused = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_verified_result_cache_hit') > 0;
  if (reused) throw new Error(`${candidate.id} invalid calibration row: verification_reused=true`);

  console.log('GOLDEN_V1_DEV_LATENCY', JSON.stringify({
    schema_version: 'golden-v1-dev-latency-v1',
    case_id: candidate.id,
    domain: candidate.domain,
    language: candidate.language,
    status: request.status,
    checked_count: countOrNull(verification.checked_count),
    verified_count: countOrNull(verification.verified_count),
    truncated_count: countOrNull(verification.truncated_count),
    rejection_counts: safeRejectionCounts(verification.rejection_counts),
    discover_ms: request.stage_latency_ms?.discover ?? null,
    grounding_ms: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_ms_total'),
    support_check_ms: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_ms_total'),
    support_check_call_ms_total: callTotal,
    support_check_call_ms_max: callMax,
    support_check_queue_wait_ms_total: queueTotal,
    support_check_queue_wait_ms_max: queueMax,
    verification_reused: false,
    total_latency_ms: request.latency_ms ?? null
  }));
}

function validateCases(cases) {
  if (cases.length !== 15) throw new Error('Development set must contain exactly 15 questions');
  const expected = new Map([
    ['humanities:en', 3], ['humanities:tr', 2],
    ['biomedical:en', 3], ['biomedical:tr', 2],
    ['social-science:en', 3], ['social-science:tr', 2]
  ]);
  const counts = new Map();
  const ids = new Set();
  for (const item of cases) {
    if (!item || typeof item.query !== 'string' || !item.query.trim()) throw new Error('Invalid development question');
    if (ids.has(item.id)) throw new Error(`Duplicate development id: ${item.id}`);
    ids.add(item.id);
    const key = `${item.domain}:${item.language}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, count] of expected) {
    if (counts.get(key) !== count) throw new Error(`Development allocation mismatch for ${key}`);
  }
  if (counts.size !== expected.size) throw new Error('Unexpected development domain/language cell');
}
async function login(email, password, jar) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ email, password }), redirect: 'manual'
  });
  applyCookies(response, jar);
  if (response.status !== 200 || !jar.get('authToken')) throw new Error('calibration login failed');
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
  if (!request) throw new Error('calibration request drilldown missing');
  return request;
}
async function telemetrySnapshot() {
  const body = await adminJson('/api/admin/system-health');
  const metrics = body?.research_telemetry?.snapshot?.metrics;
  if (!metrics || typeof metrics !== 'object') throw new Error('research telemetry snapshot unavailable');
  return metrics;
}
function metricDelta(before, after, key) {
  const start = Number(before?.[key] || 0), end = Number(after?.[key] || 0);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
}
async function adminJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'content-type': 'application/json', cookie: cookieHeader(adminCookies) }, redirect: 'manual'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return body;
}
function countOrNull(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
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
