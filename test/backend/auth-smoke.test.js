import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';

import app, { hashPassword } from '../../backend/src/index.js';

function memoryKV() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key).value : null;
    },
    async put(key, value, opts = {}) {
      store.set(key, { value, expirationTtl: opts.expirationTtl });
    },
  };
}

class AuthSmokeD1 {
  constructor(user) {
    this.user = { ...user };
    this.refreshTokens = [];
  }

  prepare(sql) {
    const db = this;
    return {
      binds: [],
      bind(...args) {
        this.binds = args;
        return this;
      },
      async first() {
        return db.dispatch(sql, this.binds, 'first');
      },
      async all() {
        return db.dispatch(sql, this.binds, 'all');
      },
      async run() {
        return db.dispatch(sql, this.binds, 'run');
      },
    };
  }

  async dispatch(sql, binds, method) {
    if (method === 'first' && sql.includes('FROM users WHERE email = ?')) {
      const email = String(binds[0] || '').toLowerCase();
      return email === this.user.email ? this.user : null;
    }

    if (method === 'first' && sql.includes('FROM users WHERE id = ?')) {
      return Number(binds[0]) === Number(this.user.id) ? this.user : null;
    }

    if (method === 'first' && sql.includes('FROM users u') && sql.includes('LEFT JOIN institutions')) {
      if (Number(binds[0]) !== Number(this.user.id)) return null;
      return {
        id: this.user.id,
        email: this.user.email,
        full_name: this.user.full_name,
        institution: this.user.institution,
        institution_id: this.user.institution_id,
        role: this.user.role,
        created_at: this.user.created_at,
        avatar_url: null,
        institution_name: this.user.institution,
        institution_logo_url: null,
        institution_domain: 'example.edu',
        institution_website_url: 'https://example.edu',
      };
    }

    if (method === 'first' && sql.includes('FROM refresh_tokens')) {
      const row = this.refreshTokens.find((token) => token.token_hash === binds[0]);
      return row ? { ...row } : null;
    }

    if (method === 'run' && sql.includes('INSERT INTO refresh_tokens')) {
      this.refreshTokens.push({
        user_id: binds[0],
        token_hash: binds[1],
        issued_at: binds[2],
        expires_at: binds[3],
        ip: binds[4],
        user_agent: binds[5],
        used_at: null,
        revoked_at: null,
        replaced_by_hash: null,
      });
      return { success: true };
    }

    if (method === 'run' && sql.includes('UPDATE refresh_tokens') && sql.includes('replaced_by_hash')) {
      const row = this.refreshTokens.find((token) => token.token_hash === binds[2]);
      if (row) {
        row.used_at = row.used_at || binds[0];
        row.replaced_by_hash = row.replaced_by_hash || binds[1];
      }
      return { success: true };
    }

    if (method === 'run' && sql.includes('UPDATE refresh_tokens') && sql.includes('WHERE token_hash = ?')) {
      const row = this.refreshTokens.find((token) => token.token_hash === binds[1]);
      if (row) row.revoked_at = row.revoked_at || binds[0];
      return { success: true };
    }

    if (method === 'run' && sql.includes('UPDATE refresh_tokens') && sql.includes('WHERE user_id = ?')) {
      for (const row of this.refreshTokens) {
        if (Number(row.user_id) === Number(binds[1])) row.revoked_at = row.revoked_at || binds[0];
      }
      return { success: true };
    }

    if (method === 'run' && sql.includes('UPDATE users SET last_login')) {
      this.user.last_login = new Date().toISOString();
      return { success: true };
    }

    if (method === 'all' && sql.includes('FROM products')) {
      return { results: [{ slug: 'sample', name: 'Sample Product' }] };
    }

    if (method === 'all') return { results: [] };
    if (method === 'first') return null;
    return { success: true };
  }
}

function testEnv(db, secret = 'test-jwt-secret') {
  return {
    DB: db,
    JWT_SECRET: secret,
    RATE_LIMIT_KV: memoryKV(),
    ENVIRONMENT: 'staging',
  };
}

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function cookieHeaderFrom(res) {
  return getSetCookies(res)
    .flatMap((cookie) => [...cookie.matchAll(/(?:^|,\s*)(authToken|refreshToken)=([^;,]*)/g)])
    .map((match) => `${match[1]}=${match[2]}`)
    .join('; ');
}

async function makeUser(overrides = {}) {
  return {
    id: 7,
    email: 'smoke@example.edu',
    full_name: 'Smoke User',
    institution: 'Example University',
    institution_id: 3,
    role: 'user',
    created_at: '2026-01-01T00:00:00Z',
    password_hash: await hashPassword('CorrectHorseBattery1!'),
    ...overrides,
  };
}

describe('auth smoke flow', () => {
  it('supports login, profile, refresh, logout and post-logout denial', async () => {
    const secret = 'test-jwt-secret';
    const db = new AuthSmokeD1(await makeUser());
    const env = testEnv(db, secret);

    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.10',
      },
      body: JSON.stringify({
        email: 'SMOKE@example.edu',
        password: 'CorrectHorseBattery1!',
      }),
    }, env);
    expect(loginRes.status).toBe(200);
    expect(await loginRes.clone().json()).toMatchObject({
      success: true,
      user: {
        email: 'smoke@example.edu',
        role: 'user',
      },
    });

    const loginCookie = cookieHeaderFrom(loginRes);
    expect(loginCookie).toContain('authToken=');
    expect(loginCookie).toContain('refreshToken=');

    const profileRes = await app.request('/api/user/profile', {
      headers: { cookie: loginCookie },
    }, env);
    expect(profileRes.status).toBe(200);
    expect(await profileRes.json()).toMatchObject({
      email: 'smoke@example.edu',
      role: 'user',
      institution_id: 3,
    });

    const refreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: loginCookie,
        'cf-connecting-ip': '203.0.113.10',
      },
    }, env);
    expect(refreshRes.status).toBe(200);
    expect(await refreshRes.clone().json()).toMatchObject({ success: true });

    const refreshedCookie = cookieHeaderFrom(refreshRes);
    expect(refreshedCookie).toContain('authToken=');
    expect(refreshedCookie).toContain('refreshToken=');

    const refreshedProfileRes = await app.request('/api/user/profile', {
      headers: { cookie: refreshedCookie },
    }, env);
    expect(refreshedProfileRes.status).toBe(200);
    expect(await refreshedProfileRes.json()).toMatchObject({
      email: 'smoke@example.edu',
      role: 'user',
    });

    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie: refreshedCookie },
    }, env);
    expect(logoutRes.status).toBe(200);
    expect(await logoutRes.json()).toMatchObject({ success: true });
    expect(cookieHeaderFrom(logoutRes)).toBe('authToken=; refreshToken=');

    const loggedOutProfileRes = await app.request('/api/user/profile', {
      headers: { cookie: cookieHeaderFrom(logoutRes) },
    }, env);
    expect(loggedOutProfileRes.status).toBe(401);
  });

  it('rejects invalid login and refresh attempts', async () => {
    const secret = 'test-jwt-secret';
    const db = new AuthSmokeD1(await makeUser());
    const env = testEnv(db, secret);

    const badLoginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.11',
      },
      body: JSON.stringify({
        email: 'smoke@example.edu',
        password: 'wrong-password',
      }),
    }, env);
    expect(badLoginRes.status).toBe(401);
    expect(await badLoginRes.json()).toMatchObject({ success: false });

    const noCookieRefreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.11' },
    }, env);
    expect(noCookieRefreshRes.status).toBe(401);

    const malformedRefreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: 'refreshToken=not-a-jwt',
        'cf-connecting-ip': '203.0.113.11',
      },
    }, env);
    expect(malformedRefreshRes.status).toBe(401);

    const expiredRefreshToken = await sign({
      user_id: db.user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    }, secret);
    const expiredRefreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${expiredRefreshToken}`,
        'cf-connecting-ip': '203.0.113.11',
      },
    }, env);
    expect(expiredRefreshRes.status).toBe(401);
  });

  it('enforces user and super admin authorization boundaries', async () => {
    const secret = 'test-jwt-secret';
    const userDb = new AuthSmokeD1(await makeUser({ role: 'user' }));
    const userToken = await sign({
      user_id: userDb.user.id,
      email: userDb.user.email,
      role: 'user',
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, secret);

    const userAdminRes = await app.request('/api/admin/products', {
      headers: { authorization: `Bearer ${userToken}` },
    }, testEnv(userDb, secret));
    expect(userAdminRes.status).toBe(403);

    const superDb = new AuthSmokeD1(await makeUser({
      id: 1,
      role: 'super_admin',
      email: 'admin@example.edu',
    }));
    const superToken = await sign({
      user_id: superDb.user.id,
      email: superDb.user.email,
      role: 'super_admin',
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, secret);

    const superAdminRes = await app.request('/api/admin/products', {
      headers: { authorization: `Bearer ${superToken}` },
    }, testEnv(superDb, secret));
    expect(superAdminRes.status).toBe(200);
    expect(await superAdminRes.json()).toEqual([{ slug: 'sample', name: 'Sample Product' }]);
  });
});
