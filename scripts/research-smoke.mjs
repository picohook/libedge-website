const BASE_URL = normalizeBaseUrl(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const USER_EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const USER_PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const QUERY = process.env.LIBEDGE_RESEARCH_SMOKE_QUERY || 'PEM water electrolysis low iridium catalyst';

if (!USER_EMAIL || !USER_PASSWORD) {
  console.error('Missing LIBEDGE_SMOKE_EMAIL or LIBEDGE_SMOKE_PASSWORD.');
  process.exit(2);
}

const jar = new Map();

await step('research endpoint rejects unauthenticated access', async () => {
  const response = await fetch(`${BASE_URL}/api/research/search?q=${encodeURIComponent(QUERY)}`, { redirect: 'manual' });
  assert(response.status === 401, `expected 401, got ${response.status}`);
});

await step('login for research smoke', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(BASE_URL).origin
    },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    redirect: 'manual'
  });
  applyCookies(response);
  assert(response.status === 200, `login expected 200, got ${response.status}`);
  assert(Boolean(jar.get('authToken')), 'authToken cookie missing');
});

let firstPayload = null;
await step('research search returns normalized provider-independent results', async () => {
  const response = await authenticatedGet(`/api/research/search?q=${encodeURIComponent(QUERY)}&per_page=3`);
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`research response is not JSON: ${text.slice(0, 200)}`); }
  assert(response.status === 200, `research expected 200, got ${response.status}: ${text.slice(0, 300)}`);
  assert(Array.isArray(payload?.results), 'results array missing');
  assert(payload?.meta?.providers?.openalex || payload?.meta?.providers?.crossref, 'provider status missing');
  for (const work of payload.results) {
    assert(typeof work?.title === 'string' && work.title.length > 0, 'normalized title missing');
    assert(work?.identifiers && typeof work.identifiers === 'object', 'identifiers missing');
    assert(['FULL_TEXT', 'ABSTRACT', 'METADATA_ONLY'].includes(work?.evidence?.level), 'invalid evidence level');
    assert(Array.isArray(work?.provenance), 'provenance missing');
  }
  firstPayload = payload;
  console.log('RESEARCH_PROVIDER_STATUS', JSON.stringify(payload.meta.providers));
  console.log('RESEARCH_RESULT_COUNT', payload.results.length);
});

await step('repeated research query is cacheable', async () => {
  const response = await authenticatedGet(`/api/research/search?q=${encodeURIComponent(QUERY)}&per_page=3`);
  const payload = await response.json();
  assert(response.status === 200, `repeat research expected 200, got ${response.status}`);
  assert(payload?.meta?.cached === true, 'expected repeated query to be served from cache');
  assert(Array.isArray(firstPayload?.results), 'first payload unavailable');
});

console.log(`OK research smoke passed against ${BASE_URL}`);

async function authenticatedGet(path) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { cookie: cookieHeader() },
    redirect: 'manual'
  });
}

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function applyCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : splitSetCookie(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (!match) continue;
    if (match[2]) jar.set(match[1], match[2]);
  }
}

function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((item) => item.trim());
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}
