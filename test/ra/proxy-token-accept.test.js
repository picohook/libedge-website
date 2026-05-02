import { describe, it, expect } from 'vitest';
import { acceptSessionHostToken, acceptStableHostToken } from '../../workers/proxy/src/index.js';
import { signProxyToken } from '../../backend/src/ra/jwt.js';
import { stableProxyHostLabel } from '../../backend/src/ra/proxy-url.js';

function memoryKV(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    async get(key, type) {
      const v = map.get(key);
      if (v == null) return null;
      if (type === 'json') {
        try { return JSON.parse(v); } catch { return null; }
      }
      return v;
    },
    async put(key, value) {
      map.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    _map: map,
  };
}

const SECRET = 'test-secret-12345';
const SESSION_ID = 'r0i393q3';
const HOST = `${SESSION_ID}.selmiye.com`;

function freshPayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'ra-main',
    aud: 'ra-proxy',
    sub: 2,
    iid: 1,
    sid: 17,
    pid: 'acs',
    tgt: 'pubs.acs.org',
    mod: 'session_host_proxy',
    exp: now + 600,
    jti: 'jti-test-' + Math.random().toString(36).slice(2),
    ...overrides,
  };
}

function freshSession(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    origin_host: 'pubs.acs.org',
    institution_id: 1,
    user_id: 2,
    product_slug: 'acs',
    subscription_id: 17,
    created_at: now,
    expires_at: now + 3600,
    ...overrides,
  };
}

function buildEnv({ jtiUsed = false, session = freshSession(), cookieJtiKey = null } = {}) {
  const rateKv = memoryKV();
  if (jtiUsed && cookieJtiKey) {
    rateKv._map.set(`ra:jti:${cookieJtiKey}`, 'used');
  }
  const sessionsKv = memoryKV();
  if (session) {
    sessionsKv._map.set(`rhost:${SESSION_ID}`, JSON.stringify(session));
  }
  return {
    RA_PROXY_TOKEN_SECRET: SECRET,
    RATE_LIMIT_KV: rateKv,
    RA_UPSTREAM_SESSIONS: sessionsKv,
  };
}

function buildRequest({ token, cookie } = {}) {
  const url = `https://${HOST}/?t=${token}`;
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  return { request: new Request(url, { headers }), url: new URL(url) };
}

describe('acceptSessionHostToken — duplicate fetch idempotency', () => {
  it('first hit consumes jti and returns 302 with Set-Cookie', async () => {
    const payload = freshPayload();
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv();
    const { request, url } = buildRequest({ token });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe(`https://${HOST}/`);
    const setCookie = resp.headers.get('Set-Cookie');
    expect(setCookie).toContain(`ra_proxy_session=${SESSION_ID}`);
    expect(setCookie).toContain(`Domain=${HOST}`);
    expect(env.RATE_LIMIT_KV._map.get(`ra:jti:${payload.jti}`)).toBe('used');
  });

  it('routes WAF-sensitive session hosts through a same-origin entry redirect', async () => {
    const payload = freshPayload({ pid: 'emerald-premier', tgt: 'www.emerald.com' });
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv({
      session: freshSession({
        origin_host: 'www.emerald.com',
        product_slug: 'emerald-premier',
      }),
    });
    const { request, url } = buildRequest({ token });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe(`https://${HOST}/__ra-redirect?to=%2F`);
    expect(resp.headers.get('Set-Cookie')).toContain(`ra_proxy_session=${SESSION_ID}`);
  });

  it('duplicate fetch with valid cookie + session returns 302 (no 401)', async () => {
    const payload = freshPayload();
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv({ jtiUsed: true, cookieJtiKey: payload.jti });
    const { request, url } = buildRequest({
      token,
      cookie: `ra_proxy_session=${SESSION_ID}`,
    });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe(`https://${HOST}/`);
    expect(resp.headers.get('Set-Cookie')).toBeNull();
  });

  it('jti consumed without matching cookie returns 401 (real reuse case)', async () => {
    const payload = freshPayload();
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv({ jtiUsed: true, cookieJtiKey: payload.jti });
    const { request, url } = buildRequest({ token });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(401);
  });

  it('jti consumed with mismatched cookie sessionId returns 401', async () => {
    const payload = freshPayload();
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv({ jtiUsed: true, cookieJtiKey: payload.jti });
    const { request, url } = buildRequest({
      token,
      cookie: 'ra_proxy_session=DIFFERENT',
    });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(401);
  });

  it('jti consumed with valid cookie but expired session returns 401', async () => {
    const payload = freshPayload();
    const token = await signProxyToken(payload, SECRET);
    const expired = freshSession({ expires_at: Math.floor(Date.now() / 1000) - 60 });
    const env = buildEnv({
      jtiUsed: true,
      cookieJtiKey: payload.jti,
      session: expired,
    });
    const { request, url } = buildRequest({
      token,
      cookie: `ra_proxy_session=${SESSION_ID}`,
    });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(401);
  });

  it('rejects mismatched mod even when token is fresh', async () => {
    const payload = freshPayload({ mod: 'path_proxy' });
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv();
    const { request, url } = buildRequest({ token });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(400);
  });

  it('returns 401 when KV session is missing on first hit', async () => {
    const payload = freshPayload();
    const token = await signProxyToken(payload, SECRET);
    const env = buildEnv({ session: null });
    const { request, url } = buildRequest({ token });

    const resp = await acceptSessionHostToken(request, env, token, url, SESSION_ID);

    expect(resp.status).toBe(401);
  });
});

describe('acceptStableHostToken', () => {
  it('creates a normal proxy session on the stable product host', async () => {
    const payload = freshPayload({
      pid: 'emerald-premier',
      tgt: 'www.emerald.com',
      mod: 'stable_host_proxy',
    });
    const label = await stableProxyHostLabel(payload.pid, payload.tgt);
    const host = `${label}.selmiye.com`;
    const token = await signProxyToken(payload, SECRET);
    const env = {
      RA_PROXY_TOKEN_SECRET: SECRET,
      RATE_LIMIT_KV: memoryKV(),
      RA_UPSTREAM_SESSIONS: memoryKV(),
    };
    const url = new URL(`https://${host}/insight/?t=${token}`);
    const request = new Request(url);

    const resp = await acceptStableHostToken(request, env, token, url, label);

    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe(
      `https://${host}/coproxy/redirect?redirectUrl=${encodeURIComponent(`https://${host}/insight/`)}`
    );
    const setCookie = resp.headers.get('Set-Cookie');
    expect(setCookie).toContain('ra_proxy_session=');
    expect(setCookie).toContain(`Domain=${host}`);
    const sessionKey = [...env.RA_UPSTREAM_SESSIONS._map.keys()]
      .find((key) => key.startsWith('proxysess:'));
    expect(sessionKey).toBeTruthy();
    const session = JSON.parse(env.RA_UPSTREAM_SESSIONS._map.get(sessionKey));
    expect(session.origin_host).toBe('www.emerald.com');
    expect(session.product_slug).toBe('emerald-premier');
  });

  it('rejects a stable token on the wrong product hash host', async () => {
    const payload = freshPayload({
      pid: 'emerald-premier',
      tgt: 'www.emerald.com',
      mod: 'stable_host_proxy',
    });
    const token = await signProxyToken(payload, SECRET);
    const env = {
      RA_PROXY_TOKEN_SECRET: SECRET,
      RATE_LIMIT_KV: memoryKV(),
      RA_UPSTREAM_SESSIONS: memoryKV(),
    };
    const url = new URL('https://0000000000000000000000000000000000000000.selmiye.com/?t=' + token);
    const request = new Request(url);

    const resp = await acceptStableHostToken(
      request,
      env,
      token,
      url,
      '0000000000000000000000000000000000000000'
    );

    expect(resp.status).toBe(403);
  });
});
