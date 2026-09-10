const BASE_URL = normalizeBaseUrl(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const USER_EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const USER_PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const QUERY = process.env.LIBEDGE_RESEARCH_SMOKE_QUERY || 'PEM water electrolysis low iridium catalyst';
const REQUIRE_OPENALEX = String(process.env.LIBEDGE_RESEARCH_REQUIRE_OPENALEX || '').toLowerCase() === 'true';
const EXPECT_TERMS = String(process.env.LIBEDGE_RESEARCH_EXPECT_TERMS || '')
  .split(',')
  .map((term) => term.trim().toLowerCase())
  .filter(Boolean);

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
await step('research search returns meaningful normalized results', async () => {
  const nonce = REQUIRE_OPENALEX ? `&gate_nonce=${Date.now()}` : '';
  const response = await authenticatedGet(`/api/research/search?q=${encodeURIComponent(QUERY)}&per_page=3${nonce}`);
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`research response is not JSON: ${text.slice(0, 200)}`); }
  assert(response.status === 200, `research expected 200, got ${response.status}: ${text.slice(0, 300)}`);
  assert(Array.isArray(payload?.results), 'results array missing');
  assert(payload.results.length > 0, 'research returned an empty result set');
  assert(payload?.meta?.providers?.openalex || payload?.meta?.providers?.crossref, 'provider status missing');

  for (const work of payload.results) {
    assert(typeof work?.title === 'string' && work.title.trim().length > 0, 'normalized title missing');
    assert(work?.identifiers && typeof work.identifiers === 'object', 'identifiers missing');
    assert(['FULL_TEXT', 'ABSTRACT', 'METADATA_ONLY'].includes(work?.evidence?.level), 'invalid evidence level');
    assert(Array.isArray(work?.provenance), 'provenance missing');
  }

  if (REQUIRE_OPENALEX) {
    const openAlex = payload?.meta?.providers?.openalex;
    assert(openAlex?.status === 'ok', `OpenAlex primary path not healthy: ${JSON.stringify(openAlex)}`);
    assert(payload.results.some((work) => work.provenance?.some((entry) => entry.provider === 'openalex')), 'no OpenAlex-provenance work returned');
    assert(payload.results.some((work) => work.evidence?.sources?.some((entry) => entry.provider === 'openalex' && entry.kind === 'abstract')), 'no real OpenAlex abstract evidence observed');

    const telemetry = openAlex.telemetry || {};
    const positiveRemaining = [telemetry.remaining, telemetry.prepaidRemainingUsd]
      .some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
    assert(positiveRemaining, `OpenAlex remaining/budget signal is not positive: ${JSON.stringify(telemetry)}`);
  }

  if (EXPECT_TERMS.length) {
    const firstText = `${payload.results[0]?.title || ''} ${payload.results[0]?.abstract || ''}`.toLowerCase();
    assert(EXPECT_TERMS.some((term) => firstText.includes(term)), `top result failed coarse relevance sanity check; expected one of: ${EXPECT_TERMS.join(', ')}`);
  }

  firstPayload = payload;
  console.log('RESEARCH_PROVIDER_STATUS', JSON.stringify(payload.meta.providers));
  console.log('RESEARCH_RESULT_COUNT', payload.results.length);
  console.log('RESEARCH_TOP_TITLE', payload.results[0]?.title || '');
});

await step('repeated research query is cacheable', async () => {
  const response = await authenticatedGet(`/api/research/search?q=${encodeURIComponent(QUERY)}&per_page=3`);
  const payload = await response.json();
  assert(response.status === 200, `repeat research expected 200, got ${response.status}`);
  if (!REQUIRE_OPENALEX) {
    assert(payload?.meta?.cached === true, 'expected repeated query to be served from cache');
  }
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
