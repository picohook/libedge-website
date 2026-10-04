const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const ADMIN_EMAIL = process.env.LIBEDGE_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIBEDGE_SMOKE_ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Missing benchmark credentials');

const CASES = [
  { name: 'ottoman-periodical-typography', query: 'Ottoman Turkish periodical typography 1860s' },
  { name: 'alkaline-fuel-cell-membrane', query: 'alkaline fuel cell asbestos membrane potassium hydroxide' },
  { name: 'radiation-grafted-membrane', query: 'radiation grafted polyethylene styrene ion exchange membrane 1970' }
];

const cookies = new Map();
const adminCookies = new Map();
const login = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  redirect: 'manual'
});
applyCookies(login);
if (login.status !== 200 || !cookies.get('authToken')) throw new Error(`login failed: ${login.status}`);

const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  redirect: 'manual'
});
applyCookies(adminLogin, adminCookies);
if (adminLogin.status !== 200 || !adminCookies.get('authToken')) throw new Error(`admin login failed: ${adminLogin.status}`);

for (const candidate of CASES) {
  const before = await telemetrySnapshot();
  const response = await fetch(`${BASE_URL}/api/assistant/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader() },
    body: JSON.stringify({ query: candidate.query }),
    redirect: 'manual'
  });
  const body = await response.json();
  if (response.status === 403 && body?.code === 'RESEARCH_ENTITLEMENT_REQUIRED') {
    throw new Error('Sparse benchmark smoke account is not Research-entitled; measurement aborted');
  }
  if (response.status !== 200) throw new Error(`${candidate.name} HTTP ${response.status}`);
  const after = await telemetrySnapshot();
  const summary = body?.research_summary;
  if (!summary?.literature || !summary?.verification) throw new Error(`${candidate.name} missing research_summary`);
  const output = {
    case: candidate.name,
    code: body.code,
    candidate_pool: {
      retrieved_count: delta(before, after, 'assistant_retrieved_works_total'),
      relevant_count: delta(before, after, 'assistant_relevant_works_total'),
      language_eligible_count: delta(before, after, 'assistant_language_eligible_works_total'),
      authorized_relevant_count: delta(before, after, 'assistant_authorized_relevant_works_total')
    },
    final_evidence_set: {
      record_count: count(summary.literature.abstract_bearing_count) + count(summary.literature.metadata_only_count),
      abstract_bearing_count: count(summary.literature.abstract_bearing_count),
      metadata_only_count: count(summary.literature.metadata_only_count)
    },
    verification: {
      checked_count: count(summary.verification.checked_count),
      verified_count: count(summary.verification.verified_count),
      truncated_count: count(summary.verification.truncated_count)
    }
  };
  console.log('SPARSE_BENCHMARK', JSON.stringify(output));
}

async function telemetrySnapshot() {
  const response = await fetch(`${BASE_URL}/api/admin/system-health`, {
    headers: { cookie: cookieHeader(adminCookies) },
    redirect: 'manual'
  });
  if (response.status !== 200) throw new Error(`system health failed: ${response.status}`);
  const body = await response.json();
  const metrics = body?.research_telemetry?.snapshot?.metrics;
  if (!metrics || typeof metrics !== 'object') throw new Error('research telemetry snapshot unavailable');
  return metrics;
}
function delta(before, after, key) {
  return count(after?.[key]) - count(before?.[key]);
}
function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid public research cardinality');
  return value;
}
function cookieHeader(jar = cookies) { return [...jar].map(([k,v]) => `${k}=${v}`).join('; '); }
function applyCookies(response, jar = cookies) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : split(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) jar.set(match[1], match[2]);
  }
}
function split(value) { return value ? value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((x) => x.trim()) : []; }
