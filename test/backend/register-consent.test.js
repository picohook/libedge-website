import { describe, expect, it } from 'vitest';

import app from '../../backend/src/index.js';

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

class RegisterD1 {
  constructor() {
    this.users = [];
  }

  prepare(sql) {
    const db = this;
    return {
      binds: [],
      bind(...args) {
        this.binds = args;
        return this;
      },
      async run() {
        return db.dispatch(sql, this.binds);
      },
    };
  }

  async dispatch(sql, binds) {
    if (sql.includes('INSERT INTO users')) {
      this.users.push({
        email: binds[0],
        password_hash: binds[1],
        full_name: binds[2],
        first_name: binds[3],
        last_name: binds[4],
        institution: binds[5],
        kvkk_consent_version: binds[6],
        kvkk_consent_ip: binds[7],
        kvkk_consent_user_agent: binds[8],
      });
      return { success: true };
    }
    return { success: true };
  }
}

function env(db = new RegisterD1()) {
  return {
    DB: db,
    JWT_SECRET: 'test-secret',
    ENVIRONMENT: 'test',
    RATE_LIMIT_KV: memoryKV(),
  };
}

describe('auth register KVKK consent', () => {
  it('rejects registration without explicit KVKK consent', async () => {
    const db = new RegisterD1();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ada@example.com',
        password: 'strong-pass',
        full_name: 'Ada Lovelace',
      }),
    }, env(db));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('KVKK');
    expect(db.users).toHaveLength(0);
  });

  it('stores KVKK consent metadata on successful registration', async () => {
    const db = new RegisterD1();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vitest Browser',
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: JSON.stringify({
        email: 'ada@example.com',
        password: 'strong-pass',
        full_name: 'Ada Lovelace',
        institution: 'Analytical Engine University',
        kvkk_consent: true,
      }),
    }, env(db));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.users).toHaveLength(1);
    expect(db.users[0]).toMatchObject({
      email: 'ada@example.com',
      full_name: 'Ada Lovelace',
      institution: 'Analytical Engine University',
      kvkk_consent_version: 'privacy-terms-2026-05-23',
      kvkk_consent_ip: '203.0.113.10',
      kvkk_consent_user_agent: 'Vitest Browser',
    });
  });
});
