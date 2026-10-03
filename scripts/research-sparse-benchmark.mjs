const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('Missing smoke credentials');

const CASES = [
  { name: 'humanities', query: 'Ottoman Empire print culture' },
  { name: 'social-science', query: 'remote work productivity randomized' },
  { name: 'biomedical', query: 'CRISPR base editing sickle cell' }
];

const cookies = new Map();
const login = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  redirect: 'manual'
});
applyCookies(login);
if (login.status !== 200 || !cookies.get('authToken')) throw new Error(`login failed: ${login.status}`);

for (const candidate of CASES) {
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
  const summary = body?.research_summary;
  if (!summary?.literature || !summary?.verification) throw new Error(`${candidate.name} missing research_summary`);
  const output = {
    case: candidate.name,
    code: body.code,
    literature: {
      retrieved_count: count(summary.literature.retrieved_count),
      authorized_relevant_count: count(summary.literature.authorized_relevant_count),
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

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid public research cardinality');
  return value;
}
function cookieHeader() { return [...cookies].map(([k,v]) => `${k}=${v}`).join('; '); }
function applyCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : split(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) cookies.set(match[1], match[2]);
  }
}
function split(value) { return value ? value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((x) => x.trim()) : []; }
