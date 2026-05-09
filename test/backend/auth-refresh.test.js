import { describe, it, expect, vi } from 'vitest';
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

class AuthD1 {
  constructor(user) {
    this.user = user;
    this.refreshTokens = [];
  }

  async exec() {
    return { success: true };
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

    if (method === 'run' && sql.includes('UPDATE refresh_tokens') && sql.includes('WHERE user_id = ?')) {
      for (const row of this.refreshTokens) {
        if (Number(row.user_id) === Number(binds[1])) row.revoked_at = row.revoked_at || binds[0];
      }
      return { success: true };
    }

    if (method === 'run' && sql.includes('UPDATE users SET last_login')) {
      return { success: true };
    }

    return method === 'first' ? null : { success: true };
  }
}

class RefreshSchemaUnavailableD1 extends AuthD1 {
  async exec() {
    throw new Error('refresh_tokens schema unavailable');
  }

  async dispatch(sql, binds, method) {
    if (method === 'run' && sql.includes('INSERT INTO refresh_tokens')) {
      throw new Error('refresh token insert unavailable');
    }
    return super.dispatch(sql, binds, method);
  }
}

function getRefreshTokenFromResponse(res) {
  const values = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  const raw = values.join(',');
  const match = /(?:^|,\s*)refreshToken=([^;,\s]+)/.exec(raw) || /refreshToken=([^;,\s]+)/.exec(raw);
  expect(match).toBeTruthy();
  return match[1];
}

async function postRefresh(db, token) {
  return app.request(
    '/api/auth/refresh',
    {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${token}`,
        'cf-connecting-ip': '203.0.113.8',
      },
    },
    {
      DB: db,
      JWT_SECRET: 'test-jwt-secret',
      RATE_LIMIT_KV: memoryKV(),
    }
  );
}

describe('auth refresh token rotation', () => {
  it('marks refresh tokens as used and revokes the family on replay', async () => {
    const user = {
      id: 41,
      email: 'researcher@example.com',
      full_name: 'Researcher User',
      institution: 'LibEdge Test',
      institution_id: 9,
      password_hash: await hashPassword('correct-password'),
      role: 'user',
    };
    const db = new AuthD1(user);

    const loginRes = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.8',
        },
        body: JSON.stringify({ email: user.email, password: 'correct-password' }),
      },
      {
        DB: db,
        JWT_SECRET: 'test-jwt-secret',
        RATE_LIMIT_KV: memoryKV(),
      }
    );

    expect(loginRes.status).toBe(200);
    const originalRefreshToken = getRefreshTokenFromResponse(loginRes);
    expect(db.refreshTokens).toHaveLength(1);

    const firstRefreshRes = await postRefresh(db, originalRefreshToken);
    expect(firstRefreshRes.status).toBe(200);
    const rotatedRefreshToken = getRefreshTokenFromResponse(firstRefreshRes);

    expect(rotatedRefreshToken).not.toBe(originalRefreshToken);
    expect(db.refreshTokens).toHaveLength(2);
    expect(db.refreshTokens[0].used_at).toBeTruthy();
    expect(db.refreshTokens[0].replaced_by_hash).toBe(db.refreshTokens[1].token_hash);

    const replayRes = await postRefresh(db, originalRefreshToken);
    expect(replayRes.status).toBe(401);
    expect(db.refreshTokens.every((token) => token.revoked_at)).toBe(true);

    const rotatedAfterReplayRes = await postRefresh(db, rotatedRefreshToken);
    expect(rotatedAfterReplayRes.status).toBe(401);
  });

  it('refreshes stateless fallback tokens without touching unavailable refresh schema', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = {
      id: 42,
      email: 'fallback@example.com',
      full_name: 'Fallback User',
      institution: 'LibEdge Test',
      institution_id: 9,
      password_hash: await hashPassword('correct-password'),
      role: 'user',
    };
    const db = new RefreshSchemaUnavailableD1(user);
    const secret = 'test-jwt-secret';
    const now = Math.floor(Date.now() / 1000);
    const statelessRefreshToken = await sign({
      user_id: user.id,
      type: 'refresh',
      iat: now,
      exp: now + 3600,
    }, secret);

    try {
      const res = await app.request(
        '/api/auth/refresh',
        {
          method: 'POST',
          headers: {
            cookie: `refreshToken=${statelessRefreshToken}`,
            'cf-connecting-ip': '203.0.113.8',
          },
        },
        {
          DB: db,
          JWT_SECRET: secret,
          RATE_LIMIT_KV: memoryKV(),
          ENVIRONMENT: 'staging',
        }
      );

      expect(res.status).toBe(200);
      const rotatedRefreshToken = getRefreshTokenFromResponse(res);
      expect(rotatedRefreshToken).not.toBe(statelessRefreshToken);
    } finally {
      consoleError.mockRestore();
    }
  });
});
