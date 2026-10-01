const BASE_URL = normalizeBaseUrl(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const USER_EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const USER_PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const QUERY = process.env.LIBEDGE_ASSISTANT_LOAD_QUERY || 'PEM water electrolysis catalyst';
const EXPECTED_CODE = process.env.LIBEDGE_ASSISTANT_LOAD_EXPECTED_CODE || 'OK';
const LEVELS = parseLevels(process.env.LIBEDGE_ASSISTANT_LOAD_LEVELS || '1,2,4');
const MAX_REQUESTS = 8;

if (!USER_EMAIL || !USER_PASSWORD) fail('Missing LIBEDGE_SMOKE_EMAIL or LIBEDGE_SMOKE_PASSWORD.', 2);
const totalRequests = LEVELS.reduce((sum, n) => sum + n, 0);
if (totalRequests > MAX_REQUESTS) fail(`Refusing to run ${totalRequests} requests; bounded maximum is ${MAX_REQUESTS}.`, 2);

const jar = new Map();
await login();

const aggregate = [];
for (const concurrency of LEVELS) {
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: concurrency }, () => ask()));
  const elapsedMs = performance.now() - started;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const codes = Object.create(null);
  let unexpected = 0;
  for (const result of results) {
    codes[result.code] = (codes[result.code] || 0) + 1;
    if (!result.valid) unexpected += 1;
  }
  const row = {
    concurrency,
    requests: results.length,
    elapsed_ms: round(elapsedMs),
    latency_p50_ms: percentile(latencies, 0.50),
    latency_p95_ms: percentile(latencies, 0.95),
    latency_max_ms: round(latencies.at(-1) || 0),
    outcome_codes: codes,
    unexpected_count: unexpected
  };
  aggregate.push(row);
  console.log(JSON.stringify(row));
  if (unexpected) fail(`Unexpected Assistant outcome at concurrency ${concurrency}.`, 1);
}

console.log(JSON.stringify({
  status: 'PASS',
  base_url: BASE_URL,
  expected_code: EXPECTED_CODE,
  total_requests: totalRequests,
  levels: aggregate
}));

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    redirect: 'manual'
  });
  applyCookies(response);
  if (response.status !== 200 || !jar.get('authToken')) fail('Load-evidence login failed.', 1);
}

async function ask() {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/api/assistant/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader() },
      body: JSON.stringify({ query: QUERY }),
      redirect: 'manual'
    });
    const latencyMs = performance.now() - started;
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { return { latencyMs, code: 'NON_JSON', valid: false }; }
    const code = String(payload?.code || (payload?.ok === true ? 'OK' : 'UNKNOWN'));
    const claims = Array.isArray(payload?.claims) ? payload.claims : [];
    const evidence = Array.isArray(payload?.evidence) ? payload.evidence : [];
    const evidenceIds = new Set(evidence.map((item) => String(item?.evidence_id || item?.id || '')).filter(Boolean));
    const claimsGrounded = claims.length > 0 && claims.every((claim) =>
      Array.isArray(claim?.evidence_ids) && claim.evidence_ids.length > 0 &&
      claim.evidence_ids.every((id) => evidenceIds.has(String(id)))
    );
    const valid = response.status === 200 && payload?.ok === true && code === EXPECTED_CODE && evidence.length > 0 && claimsGrounded;
    return { latencyMs, code, valid };
  } catch {
    return { latencyMs: performance.now() - started, code: 'TRANSPORT_ERROR', valid: false };
  }
}

function parseLevels(value) {
  const levels = String(value).split(',').map((v) => Number.parseInt(v.trim(), 10));
  if (!levels.length || levels.some((n) => !Number.isInteger(n) || n < 1 || n > 4)) {
    fail('LIBEDGE_ASSISTANT_LOAD_LEVELS must contain integers from 1 through 4.', 2);
  }
  return levels;
}

function percentile(values, p) {
  if (!values.length) return 0;
  return round(values[Math.max(0, Math.ceil(values.length * p) - 1)]);
}
function round(value) { return Math.round(value * 10) / 10; }
function cookieHeader() { return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; '); }
function applyCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : splitSetCookie(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) jar.set(match[1], match[2]);
  }
}
function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((item) => item.trim());
}
function normalizeBaseUrl(value) { return String(value || '').replace(/\/+$/, ''); }
function fail(message, code) { console.error(message); process.exit(code); }
