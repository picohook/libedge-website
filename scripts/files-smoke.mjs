const BASE_URL = normalizeBaseUrl(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev');
const USER_EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const USER_PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
const ADMIN_EMAIL = process.env.LIBEDGE_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LIBEDGE_SMOKE_ADMIN_PASSWORD;
const OTHER_EMAIL = process.env.LIBEDGE_SMOKE_OTHER_EMAIL;
const OTHER_PASSWORD = process.env.LIBEDGE_SMOKE_OTHER_PASSWORD;
const REQUEST_ORIGIN = process.env.LIBEDGE_SMOKE_ORIGIN || new URL(BASE_URL).origin;

if (!USER_EMAIL || !USER_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing required smoke credentials.');
  console.error('Required: LIBEDGE_SMOKE_EMAIL/PASSWORD and LIBEDGE_SMOKE_ADMIN_EMAIL/PASSWORD');
  process.exit(2);
}

const runId = `smoke-${Date.now()}`;
const userJar = new CookieJar();
const adminJar = new CookieJar();
const otherJar = new CookieJar();
const cleanup = {
  systemFileRefId: null,
  ticketId: null,
};

try {
  await step('regular user login succeeds', async () => {
    await login(userJar, USER_EMAIL, USER_PASSWORD);
  });

  await step('admin login succeeds', async () => {
    await login(adminJar, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  if (OTHER_EMAIL && OTHER_PASSWORD) {
    await step('other user login succeeds', async () => {
      await login(otherJar, OTHER_EMAIL, OTHER_PASSWORD);
    });
  } else {
    console.log('SKIP other-user attachment denial: LIBEDGE_SMOKE_OTHER_EMAIL/PASSWORD not set.');
  }

  let managedKey = '';
  let managedContent = '';
  await step('managed file upload writes a private R2 object', async () => {
    managedContent = `LibEdge managed upload smoke ${runId}`;
    const form = new FormData();
    form.append('file', new Blob([managedContent], { type: 'text/plain' }), `${runId}.txt`);

    const { res, json } = await request('/api/files/upload', {
      method: 'POST',
      body: form,
      jarOverride: adminJar,
    });

    assertStatus(res, 200);
    assert(json?.success === true, 'managed upload success=true expected');
    assert(/^files\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.txt$/i.test(json?.key || ''), `unexpected managed file key: ${json?.key}`);
    managedKey = json.key;
  });

  await step('managed file reference can be found for cleanup', async () => {
    const { res, json } = await request('/api/system/files', { jarOverride: adminJar });
    assertStatus(res, 200);
    const files = Array.isArray(json?.files) ? json.files : [];
    const ref = files.find((file) => String(file.file_url || '').endsWith(managedKey));
    assert(Boolean(ref?.id), 'uploaded managed file reference not found in /api/system/files');
    cleanup.systemFileRefId = ref.id;
  });

  await step('anonymous managed file download is denied', async () => {
    const { res } = await request(`/api/files/${managedKey}`, { useCookies: false });
    assertStatus(res, 403);
  });

  await step('regular user managed file download is denied', async () => {
    const { res } = await request(`/api/files/${managedKey}`, { jarOverride: userJar });
    assertStatus(res, 403);
  });

  await step('admin managed file download succeeds with private cache headers', async () => {
    const { res, text } = await request(`/api/files/${managedKey}`, { jarOverride: adminJar, parseJson: false });
    assertStatus(res, 200);
    assert(text === managedContent, 'managed file content mismatch');
    const cacheControl = res.headers.get('cache-control') || '';
    assert(/private/i.test(cacheControl), `expected private cache-control, got: ${cacheControl}`);
    assert(/no-store/i.test(cacheControl), `expected no-store cache-control, got: ${cacheControl}`);
  });

  let attachmentPath = '';
  let attachmentContent = '';
  await step('support ticket can be created by regular user', async () => {
    const { res, json } = await request('/api/support/tickets', {
      method: 'POST',
      json: {
        subject: `LibEdge file smoke ${runId}`,
        message: `Automated staging smoke ticket ${runId}`,
        priority: 'low',
      },
      jarOverride: userJar,
    });

    assertStatus(res, 201);
    assert(Boolean(json?.id), 'created ticket id missing');
    cleanup.ticketId = json.id;
  });

  await step('ticket reply attachment is stored behind /api/files', async () => {
    attachmentContent = `LibEdge ticket attachment smoke ${runId}`;
    const form = new FormData();
    form.append('message', `Automated attachment smoke reply ${runId}`);
    form.append('file', new Blob([attachmentContent], { type: 'text/plain' }), `${runId}-attachment.txt`);

    const { res, json } = await request(`/api/support/tickets/${cleanup.ticketId}/reply`, {
      method: 'POST',
      body: form,
      jarOverride: userJar,
    });

    assertStatus(res, 200);
    assert(json?.success === true, 'ticket reply success=true expected');

    const detail = await request(`/api/support/tickets/${cleanup.ticketId}`, { jarOverride: userJar });
    assertStatus(detail.res, 200);
    const replies = Array.isArray(detail.json?.replies) ? detail.json.replies : [];
    const reply = [...replies].reverse().find((row) => row.attachment_url);
    const attachmentUrl = String(reply?.attachment_url || '');
    assert(attachmentUrl.startsWith('/api/files/ticket-attachments/'), `ticket attachment should use /api/files, got: ${attachmentUrl || '(empty)'}`);
    attachmentPath = attachmentUrl;
  });

  await step('anonymous ticket attachment download is denied', async () => {
    const { res } = await request(attachmentPath, { useCookies: false });
    assertStatus(res, 403);
  });

  if (OTHER_EMAIL && OTHER_PASSWORD) {
    await step('other user ticket attachment download is denied', async () => {
      const { res } = await request(attachmentPath, { jarOverride: otherJar });
      assertStatus(res, 403);
    });
  }

  await step('ticket owner attachment download succeeds', async () => {
    const { res, text } = await request(attachmentPath, { jarOverride: userJar, parseJson: false });
    assertStatus(res, 200);
    assert(text === attachmentContent, 'ticket attachment content mismatch for owner');
    const cacheControl = res.headers.get('cache-control') || '';
    assert(/private/i.test(cacheControl), `expected private cache-control, got: ${cacheControl}`);
    assert(/no-store/i.test(cacheControl), `expected no-store cache-control, got: ${cacheControl}`);
  });

  await step('admin attachment download succeeds', async () => {
    const { res, text } = await request(attachmentPath, { jarOverride: adminJar, parseJson: false });
    assertStatus(res, 200);
    assert(text === attachmentContent, 'ticket attachment content mismatch for admin');
  });

  console.log(`OK files smoke passed against ${BASE_URL}`);
} finally {
  await cleanupSmokeData().catch((err) => {
    console.error(`WARN cleanup failed: ${err.message}`);
  });
}

async function login(jar, email, password) {
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    json: { email, password },
    jarOverride: jar,
  });
  assertStatus(res, 200);
  assert(json?.success === true, `login failed for ${email}`);
  assert(Boolean(jar.get('authToken')), `authToken missing for ${email}`);
}

async function cleanupSmokeData() {
  if (cleanup.ticketId) {
    const { res } = await request(`/api/admin/support/tickets/${cleanup.ticketId}`, {
      method: 'PUT',
      json: { status: 'closed', priority: 'low' },
      jarOverride: adminJar,
    });
    if (res.status < 200 || res.status >= 300) {
      console.error(`WARN ticket cleanup returned HTTP ${res.status}`);
    }
  }

  if (cleanup.systemFileRefId) {
    const { res } = await request(`/api/system/file/${cleanup.systemFileRefId}`, {
      method: 'DELETE',
      jarOverride: adminJar,
    });
    if (res.status < 200 || res.status >= 300) {
      console.error(`WARN managed file cleanup returned HTTP ${res.status}`);
    }
  }
}

async function request(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
  const activeJar = options.jarOverride || userJar;
  const headers = new Headers(options.headers || {});
  const method = String(options.method || 'GET').toUpperCase();

  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('origin')) {
    headers.set('origin', REQUEST_ORIGIN);
  }

  if (options.cookieOverride) {
    headers.set('cookie', options.cookieOverride);
  } else if (options.useCookies !== false) {
    const cookie = activeJar.header();
    if (cookie) headers.set('cookie', cookie);
  }

  const body = options.body !== undefined
    ? options.body
    : options.json === undefined
      ? undefined
      : JSON.stringify(options.json);

  const res = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  activeJar.apply(res);
  const text = await res.text();
  let json = null;
  if (options.parseJson !== false) {
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
  }

  return { res, json, text };
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

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
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

function getSetCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }

  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[^=;,\s]+=)/g).map((cookie) => cookie.trim());
}
