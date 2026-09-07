const BASE_URL = normalizeBaseUrl(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const USER_EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const USER_PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const ADMIN_EMAIL = process.env.LIBEDGE_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIBEDGE_SMOKE_ADMIN_PASSWORD;
const REQUEST_ORIGIN = process.env.LIBEDGE_SMOKE_ORIGIN || new URL(BASE_URL).origin;

if (!USER_EMAIL || !USER_PASSWORD) {
  console.error('Missing LIBEDGE_SMOKE_EMAIL or LIBEDGE_SMOKE_PASSWORD.');
  console.error('Example: LIBEDGE_SMOKE_EMAIL=user@example.edu LIBEDGE_SMOKE_PASSWORD=... npm run smoke:auth');
  process.exit(2);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  get(name) {
    return this.cookies.get(name) || '';
  }

  header() {
    return [...this.cookies.entries()]
      .filter(([, value]) => value)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  apply(res) {
    for (const cookie of getSetCookieHeaders(res)) {
      const match = /^([^=;\s]+)=([^;]*)/.exec(cookie);
      if (!match) continue;
      const [, name, value] = match;
      if (!value || /;\s*Max-Age=0(?:;|$)/i.test(cookie)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

const jar = new CookieJar();

await step('login succeeds and sets auth cookies', async () => {
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    json: {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    },
  });

  assertStatus(res, 200);
  assert(json?.success === true, 'login response success=true expected');
  assert(Boolean(jar.get('authToken')), 'authToken cookie missing after login');
  assert(Boolean(jar.get('refreshToken')), 'refreshToken cookie missing after login');
  assertAuthCookiesUseSameSiteLax(res);
});

await step('profile succeeds with login cookies', async () => {
  const { res, json } = await request('/api/user/profile');

  assertStatus(res, 200);
  assert(sameEmail(json?.email, USER_EMAIL), `profile email mismatch: ${json?.email}`);
  assert(Boolean(json?.role), 'profile role missing');
});

await step('regular user cannot access admin products', async () => {
  const { res } = await request('/api/admin/products');

  assertStatus(res, 403);
});

await step('refresh succeeds and rotates session cookies', async () => {
  const previousAuth = jar.get('authToken');
  const previousRefresh = jar.get('refreshToken');
  const { res, json } = await request('/api/auth/refresh', { method: 'POST' });

  assertStatus(res, 200);
  assert(json?.success === true, 'refresh response success=true expected');
  assert(Boolean(jar.get('authToken')), 'authToken cookie missing after refresh');
  assert(Boolean(jar.get('refreshToken')), 'refreshToken cookie missing after refresh');
  assertAuthCookiesUseSameSiteLax(res);
  assert(jar.get('authToken') !== previousAuth || jar.get('refreshToken') !== previousRefresh, 'session cookies did not rotate');
});

await step('profile succeeds after refresh', async () => {
  const { res, json } = await request('/api/user/profile');

  assertStatus(res, 200);
  assert(sameEmail(json?.email, USER_EMAIL), `profile email mismatch after refresh: ${json?.email}`);
});

await step('logout succeeds and clears cookies', async () => {
  const { res, json } = await request('/api/auth/logout', { method: 'POST' });

  assertStatus(res, 200);
  assert(json?.success === true, 'logout response success=true expected');
  assert(!jar.get('authToken'), 'authToken cookie still present after logout');
  assert(!jar.get('refreshToken'), 'refreshToken cookie still present after logout');
  assertAuthCookiesUseSameSiteLax(res);
});

await step('profile is rejected after logout', async () => {
  const { res } = await request('/api/user/profile');

  assertStatus(res, 401);
});

await step('wrong password login is rejected', async () => {
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    json: {
      email: USER_EMAIL,
      password: `${USER_PASSWORD}-wrong`,
    },
    useCookies: false,
  });

  assertStatus(res, 401);
  assert(json?.success === false, 'wrong-password response success=false expected');
});

await step('refresh without cookie is rejected', async () => {
  const { res } = await request('/api/auth/refresh', {
    method: 'POST',
    useCookies: false,
  });

  assertStatus(res, 401);
});

await step('malformed refresh token is rejected', async () => {
  const { res } = await request('/api/auth/refresh', {
    method: 'POST',
    cookieOverride: 'refreshToken=not-a-jwt',
  });

  assertStatus(res, 401);
});

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const adminJar = new CookieJar();
  await step('admin/super_admin can access admin products', async () => {
    const login = await request('/api/auth/login', {
      method: 'POST',
      json: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
      jarOverride: adminJar,
    });

    assertStatus(login.res, 200);
    assert(login.json?.success === true, 'admin login response success=true expected');
    assertAuthCookiesUseSameSiteLax(login.res);

    const products = await request('/api/admin/products', { jarOverride: adminJar });
    assertStatus(products.res, 200);
    assert(Array.isArray(products.json), 'admin products response should be an array');
  });
} else {
  console.log('SKIP admin/super_admin success check: LIBEDGE_SMOKE_ADMIN_EMAIL/PASSWORD not set.');
}

console.log(`OK auth smoke passed against ${BASE_URL}`);

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const activeJar = options.jarOverride || jar;
  const headers = new Headers(options.headers || {});

  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
  }

  const method = String(options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('origin')) {
    headers.set('origin', REQUEST_ORIGIN);
  }

  if (options.cookieOverride) {
    headers.set('cookie', options.cookieOverride);
  } else if (options.useCookies !== false) {
    const cookie = activeJar.header();
    if (cookie) headers.set('cookie', cookie);
  }

  const res = await fetchWithRetry(url, {
    method,
    headers,
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
    redirect: 'manual',
  });

  activeJar.apply(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, json, text };
}

async function fetchWithRetry(url, init, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !isRetryableFetchError(err)) throw err;
      console.warn(`WARN transient fetch failure for ${url}; retrying (${attempt + 1}/${attempts})`);
      await sleep(300 * attempt);
    }
  }
  throw lastError;
}

function isRetryableFetchError(err) {
  const code = err?.cause?.code || err?.code || '';
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_SOCKET'].includes(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

function assertStatus(res, expected) {
  assert(res.status === expected, `${res.url} expected HTTP ${expected}, got ${res.status}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertAuthCookiesUseSameSiteLax(res) {
  const cookies = getSetCookieHeaders(res).filter((cookie) => /^(authToken|refreshToken)=/i.test(cookie));
  assert(cookies.length === 2, `expected authToken and refreshToken Set-Cookie headers, got ${cookies.length}`);
  for (const cookie of cookies) {
    assert(/;\s*SameSite=Lax(?:;|$)/i.test(cookie), `expected SameSite=Lax on ${cookie}`);
    assert(!/;\s*SameSite=None(?:;|$)/i.test(cookie), `unexpected SameSite=None on ${cookie}`);
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function sameEmail(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function getSetCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }

  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[^=;,\s]+=)/g).map((cookie) => cookie.trim());
}
