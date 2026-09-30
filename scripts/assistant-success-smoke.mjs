const BASE_URL = normalize(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const QUERY = process.env.LIBEDGE_ASSISTANT_SMOKE_QUERY || 'PEM water electrolysis catalyst';

if (!EMAIL || !PASSWORD) throw new Error('Staging smoke credentials are required');

const jar = new Map();
const login = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  redirect: 'manual'
});
applyCookies(login);
assert(login.status === 200, `login failed: ${login.status}`);

const access = await getJson('/api/research/access');
assert(access.response.status === 200, `Research access check failed: ${access.response.status}`);
assert(access.body.allowed === true, `smoke user is not Research-authorized: ${JSON.stringify(access.body)}`);

const answerResponse = await fetch(`${BASE_URL}/api/assistant/ask`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: cookieHeader() },
  body: JSON.stringify({ query: QUERY }),
  redirect: 'manual'
});
const answer = await answerResponse.json();
assert(answerResponse.status === 200, `assistant HTTP ${answerResponse.status}`);
assert(answer.ok === true, `assistant did not produce a grounded answer: ${JSON.stringify(answer)}`);
assert(answer.code === 'OK', `unexpected assistant code: ${answer.code}`);
assert(Array.isArray(answer.claims) && answer.claims.length > 0, 'expected at least one grounded claim');
assert(Array.isArray(answer.evidence) && answer.evidence.length > 0, 'expected evidence');
for (const claim of answer.claims) {
  assert(typeof claim.text === 'string' && claim.text.trim(), 'claim text missing');
  assert(Array.isArray(claim.evidence_ids) && claim.evidence_ids.length > 0, 'claim evidence_ids missing');
}
console.log(JSON.stringify({ ok: true, code: answer.code, claim_count: answer.claims.length, evidence_count: answer.evidence.length }));

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { cookie: cookieHeader() }, redirect: 'manual' });
  return { response, body: await response.json() };
}
function cookieHeader() { return [...jar].map(([k,v]) => `${k}=${v}`).join('; '); }
function applyCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : split(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) jar.set(match[1], match[2]);
  }
}
function split(value) { return value ? value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map(x => x.trim()) : []; }
function assert(condition, message) { if (!condition) throw new Error(message); }
function normalize(value) { return String(value || '').replace(/\/+$/, ''); }
