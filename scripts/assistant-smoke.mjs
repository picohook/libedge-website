const BASE_URL = normalizeBaseUrl(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const USER_EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const USER_PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const QUERY = process.env.LIBEDGE_ASSISTANT_SMOKE_QUERY || 'PEM water electrolysis catalyst';

if (!USER_EMAIL || !USER_PASSWORD) {
  console.error('Missing LIBEDGE_SMOKE_EMAIL or LIBEDGE_SMOKE_PASSWORD.');
  process.exit(2);
}

const jar = new Map();

await step('login for assistant smoke', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    redirect: 'manual'
  });
  applyCookies(response);
  assert(response.status === 200, `login expected 200, got ${response.status}`);
  assert(Boolean(jar.get('authToken')), 'authToken cookie missing');
});

await step('assistant endpoint remains provider-gated', async () => {
  const response = await fetch(`${BASE_URL}/api/assistant/ask`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader()
    },
    body: JSON.stringify({ query: QUERY }),
    redirect: 'manual'
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`assistant response is not JSON: ${text.slice(0, 200)}`); }
  assert(response.status === 200, `assistant expected 200, got ${response.status}: ${text.slice(0, 300)}`);
  assert(payload?.ok === false, `assistant unexpectedly returned ok=true: ${text.slice(0, 300)}`);
  assert(payload?.code === 'PROVIDER_PRIVACY_GATE_REQUIRED', `unexpected assistant code: ${payload?.code}`);
  assert(Array.isArray(payload?.claims) && payload.claims.length === 0, 'assistant claims must remain empty while gate is closed');
});

console.log(`OK assistant gate smoke passed against ${BASE_URL}`);

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
