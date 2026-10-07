import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const ADMIN_EMAIL = process.env.LIBEDGE_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIBEDGE_SMOKE_ADMIN_PASSWORD;
const MANIFEST = 'docs/experiments/research-golden-set-v1-development-set.json';
const OUTPUT = String(process.env.GOLDEN_TR_DEV_OUTPUT || 'golden-v1-turkish-dev-rerun.jsonl');
const REQUEST_SPACING_MS = Number(process.env.GOLDEN_TR_DEV_REQUEST_SPACING_MS || 31000);
const EXPECTED_IDS = ['hum-tr-01','hum-tr-02','bio-tr-01','bio-tr-02','soc-tr-01','soc-tr-02'];
if (!Number.isFinite(REQUEST_SPACING_MS) || REQUEST_SPACING_MS < 30000) throw new Error('GOLDEN_TR_DEV_REQUEST_SPACING_MS must be >=30000');
if (!EMAIL || !PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Missing calibration credentials');

const manifestBytes = fs.readFileSync(MANIFEST);
const manifestSha256 = crypto.createHash('sha256').update(manifestBytes).digest('hex');
const parsed = JSON.parse(manifestBytes.toString('utf8'));
const runStartedAt = new Date().toISOString();
fs.writeFileSync(OUTPUT, '');
emit({ record_type: 'run_start', schema_version: 'golden-v1-tr-dev-rerun-v2', run_started_at: runStartedAt, manifest_path: MANIFEST, manifest_sha256: manifestSha256, expected_ids: EXPECTED_IDS });
const allCases = Array.isArray(parsed?.cases) ? parsed.cases : [];
const cases = allCases.filter((item) => item?.language === 'tr');
validateCases(allCases, cases);

const userCookies = new Map(), adminCookies = new Map();
await login(EMAIL, PASSWORD, userCookies);
await login(ADMIN_EMAIL, ADMIN_PASSWORD, adminCookies);
const userId = await smokeUserId();

for (let index = 0; index < cases.length; index += 1) {
  const candidate = cases[index];
  if (index) await sleep(REQUEST_SPACING_MS);
  const beforeTelemetry = await telemetrySnapshot();
  const beforeRequestId = await latestRequestId(userId);
  const response = await fetch(`${BASE_URL}/api/assistant/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader(userCookies) },
    body: JSON.stringify({ query: candidate.query }),
    redirect: 'manual'
  });
  const body = await response.json().catch(() => ({}));

  if (response.status !== 200) {
    emit({
      record_type: 'row', schema_version: 'golden-v1-tr-dev-rerun-v2', row_index: index,
      case_id: candidate.id, domain: candidate.domain, original_language: candidate.language,
      http_status: response.status, result_code: body?.code ?? null, row_valid: false,
      invalid_reason: response.status === 429 ? 'HTTP_429_RATE_LIMITED' : `HTTP_${response.status}`,
      run_started_at: runStartedAt, manifest_sha256: manifestSha256
    });
    throw new Error(`${candidate.id}: HTTP ${response.status}; terminal row recorded; stop rerun`);
  }

  const request = await latestNewRequest(userId, beforeRequestId);
  const afterTelemetry = await telemetrySnapshot();
  const verification = body?.research_summary?.verification || {};
  const language = body?.language || {};
  const requestDelta = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_requests');
  const cacheHitDelta = metricDelta(beforeTelemetry, afterTelemetry, 'assistant_verified_result_cache_hit');
  const invalidReasons = [];
  let stopAfterRow = false;
  if (requestDelta !== 1) { invalidReasons.push(`REQUEST_DELTA:${requestDelta}`); stopAfterRow = true; }
  if (cacheHitDelta === null || cacheHitDelta > 0 || body?.verification_reused === true) { invalidReasons.push('CACHE_REUSE'); stopAfterRow = true; }
  if (!['tr', 'und'].includes(language.query_language)) invalidReasons.push(`QUERY_LANGUAGE_UNEXPECTED:${language.query_language ?? 'null'}`);
  if (language.query_normalized === true && !String(language.retrieval_query || '').trim()) invalidReasons.push('NORMALIZED_RETRIEVAL_QUERY_MISSING');

  emit({
    record_type: 'row', schema_version: 'golden-v1-tr-dev-rerun-v2', row_index: index,
    case_id: candidate.id, domain: candidate.domain, original_language: candidate.language,
    query_language: language.query_language ?? null,
    query_normalized: language.query_normalized === true,
    query_normalization_version: language.query_normalization_version ?? null,
    retrieval_query: language.query_normalized === true ? String(language.retrieval_query || '') : null,
    answer_language: language.answer_language ?? null,
    evidence_languages: Array.isArray(language.evidence_languages) ? language.evidence_languages : [],
    http_status: response.status, status: request.status, result_code: body?.code ?? null,
    checked_count: countOrNull(verification.checked_count), verified_count: countOrNull(verification.verified_count),
    truncated_count: countOrNull(verification.truncated_count), rejection_counts: safeRejectionCounts(verification.rejection_counts),
    normalization_ms: request.stage_latency_ms?.normalization ?? null, discover_ms: request.stage_latency_ms?.discover ?? null,
    grounding_ms: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_grounding_ms_total'),
    support_check_ms: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_ms_total'),
    support_check_call_ms_total: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_call_ms_total'),
    support_check_call_ms_max: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_call_ms_max_total'),
    support_check_queue_wait_ms_total: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_queue_wait_ms_total'),
    support_check_queue_wait_ms_max: metricDelta(beforeTelemetry, afterTelemetry, 'assistant_support_check_queue_wait_ms_max_total'),
    verification_reused: body?.verification_reused === true, total_latency_ms: request.latency_ms ?? null,
    row_valid: invalidReasons.length === 0, invalid_reason: invalidReasons.length ? invalidReasons.join('|') : null,
    run_started_at: runStartedAt, manifest_sha256: manifestSha256
  });
  if (stopAfterRow) throw new Error(`${candidate.id}: terminal measurement-integrity anomaly recorded; stop rerun`);
}

emit({ record_type: 'run_end', schema_version: 'golden-v1-tr-dev-rerun-v2', run_started_at: runStartedAt, run_ended_at: new Date().toISOString(), manifest_sha256: manifestSha256, completed_rows: cases.length });

function emit(record) {
  const line = JSON.stringify(record);
  fs.appendFileSync(OUTPUT, `${line}\n`, 'utf8');
  console.log('GOLDEN_V1_TR_DEV_RERUN', line);
}

function validateCases(all, selected) {
  if (all.length !== 15) throw new Error('Frozen development manifest must contain exactly 15 questions');
  const ids = selected.map((item) => item?.id);
  if (selected.length !== 6 || JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    throw new Error(`Turkish development subset mismatch: ${JSON.stringify(ids)}`);
  }
  if (selected.some((item) => item.language !== 'tr' || typeof item.query !== 'string' || !item.query.trim())) throw new Error('Invalid Turkish development row');
}
async function login(email, password, jar) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, { method:'POST', headers:{'content-type':'application/json',origin:new URL(BASE_URL).origin}, body:JSON.stringify({email,password}), redirect:'manual' });
  applyCookies(response, jar);
  if (response.status !== 200 || !jar.get('authToken')) throw new Error('calibration login failed');
}
async function smokeUserId() {
  const body = await adminJson('/api/admin/research/usage?days=30');
  const row = (body.users || []).find((item) => String(item.email || '').toLowerCase() === EMAIL.toLowerCase());
  const id = Number(row?.user_id); if (!Number.isSafeInteger(id) || id <= 0) throw new Error('smoke user not found'); return id;
}
async function latestRequestId(userId) { const b=await adminJson(`/api/admin/research/usage/requests?user_id=${userId}&days=1&limit=1`); return b.requests?.[0]?.request_id || null; }
async function latestNewRequest(userId,before){ const b=await adminJson(`/api/admin/research/usage/requests?user_id=${userId}&days=1&limit=5`); const r=(b.requests||[]).find((x)=>x.request_id!==before); if(!r) throw new Error('rerun request drilldown missing'); return r; }
async function telemetrySnapshot(){ const b=await adminJson('/api/admin/system-health'); const m=b?.research_telemetry?.snapshot?.metrics; if(!m||typeof m!=='object') throw new Error('research telemetry unavailable'); return m; }
function metricDelta(before,after,key){ const a=Number(before?.[key]||0),b=Number(after?.[key]||0); return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?b-a:null; }
async function adminJson(path){ const r=await fetch(`${BASE_URL}${path}`,{headers:{'content-type':'application/json',cookie:cookieHeader(adminCookies)},redirect:'manual'}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(`${path} failed: ${r.status}`); return b; }
function countOrNull(v){ return Number.isSafeInteger(v)&&v>=0?v:null; }
function safeRejectionCounts(v){ if(!v||typeof v!=='object'||Array.isArray(v)) return {}; return Object.fromEntries(Object.entries(v).filter(([k,n])=>/^[A-Z][A-Z0-9_]{0,79}$/.test(k)&&Number.isSafeInteger(n)&&n>0)); }
function cookieHeader(j){ return [...j].map(([k,v])=>`${k}=${v}`).join('; '); }
function applyCookies(r,j){ const vals=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():split(r.headers.get('set-cookie')); for(const c of vals){ const m=/^([^=;\\s]+)=([^;]*)/.exec(c||''); if(m?.[2]) j.set(m[1],m[2]); } }
function split(v){ return v?v.split(/,(?=\\s*[^;,=]+=[^;,]+)/g).map((x)=>x.trim()):[]; }
function sleep(ms){ return new Promise((resolve)=>setTimeout(resolve,ms)); }
