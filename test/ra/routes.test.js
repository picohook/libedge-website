import { describe, it, expect } from 'vitest';
import { sign } from 'hono/jwt';

import app from '../../backend/src/index.js';

class FakeD1 {
  constructor(handlers = []) {
    this.handlers = handlers;
  }

  prepare(sql) {
    const db = this;
    return {
      _sql: sql,
      _binds: [],
      bind(...args) {
        this._binds = args;
        return this;
      },
      async first() {
        return db.dispatch(this._sql, this._binds, 'first');
      },
      async all() {
        return db.dispatch(this._sql, this._binds, 'all');
      },
      async run() {
        return db.dispatch(this._sql, this._binds, 'run');
      },
    };
  }

  async dispatch(sql, binds, method) {
    for (const handler of this.handlers) {
      const matches = typeof handler.match === 'string'
        ? sql.includes(handler.match)
        : handler.match.test(sql);
      if (!matches) continue;
      const fn = handler[method];
      if (fn) return await fn({ sql, binds });
    }

    if (method === 'all') return { results: [] };
    if (method === 'first') return null;
    return { success: true };
  }
}

async function makeAuthHeader(payload, secret) {
  const token = await sign(payload, secret);
  return `Bearer ${token}`;
}

describe('RA issue-token route', () => {
  it('maps legacy direct_login delivery mode to path_proxy redirects', async () => {
    const db = new FakeD1([
      {
        match: 'FROM institution_subscriptions isub',
        first: async () => ({
          id: 9,
          product_slug: 'pangram',
          end_date: null,
          ra_credential_scope: null,
          ra_credential_enc: null,
          ra_recipe_override_json: null,
          ra_valid_until: null,
          access_type: 'proxy',
          ra_enabled: 1,
          ra_delivery_mode: 'direct_login',
          ra_origin_host: 'www.pangram.com',
          ra_login_recipe_json: null,
          ra_requires_tunnel: 0,
          ra_origin_landing_path: '/login',
        }),
      },
      {
        match: 'FROM institution_ra_settings',
        first: async () => ({ enabled: 1, tunnel_status: 'ok' }),
      },
    ]);

    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 23, institution_id: 188, role: 'user' },
      secret
    );

    const res = await app.request(
      '/api/ra/issue-token',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: authHeader,
        },
        body: JSON.stringify({ subscription_id: 9 }),
      },
      {
        DB: db,
        JWT_SECRET: secret,
        RA_PROXY_TOKEN_SECRET: 'proxy-secret',
        RA_PROXY_HOST: 'proxy-staging.selmiye.com',
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.redirect_url).toMatch(
      /^https:\/\/proxy-staging\.selmiye\.com\/www-pangram-com\/login\?t=/
    );
  });
});

describe('RA issue-token admin_test path', () => {
  function makeProductTestDb({ product, raSettings = { enabled: 1, tunnel_status: 'ok' } } = {}) {
    return new FakeD1([
      // adminTest path queries products only (no JOIN to institution_subscriptions)
      {
        match: 'FROM products p',
        first: async () => product,
      },
      // tunnel check still runs (we want to surface tunnel misconfig)
      {
        match: 'FROM institution_ra_settings',
        first: async () => raSettings,
      },
    ]);
  }

  const baseProduct = {
    id: null,
    product_slug: 'pubs-acs-org',
    end_date: null,
    ra_credential_scope: null,
    ra_credential_enc: null,
    ra_recipe_override_json: null,
    ra_valid_until: null,
    access_type: null,
    ra_enabled: 1,
    ra_origin_host: 'pubs.acs.org',
    ra_login_recipe_json: null,
    ra_delivery_mode: 'path_proxy',
    ra_origin_landing_path: null,
  };

  it('admin can test an RA-enabled product without an institution subscription', async () => {
    const db = makeProductTestDb({ product: baseProduct });
    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 7, institution_id: 188, role: 'admin' },
      secret
    );

    const res = await app.request(
      '/api/ra/issue-token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: authHeader },
        body: JSON.stringify({ product_slug: 'pubs-acs-org', admin_test: true }),
      },
      {
        DB: db,
        JWT_SECRET: secret,
        RA_PROXY_TOKEN_SECRET: 'proxy-secret',
        RA_PROXY_HOST: 'proxy-staging.selmiye.com',
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.redirect_url).toMatch(
      /^https:\/\/proxy-staging\.selmiye\.com\/pubs-acs-org\/\?t=/
    );
  });

  it('rejects admin_test for non-admin users', async () => {
    const db = makeProductTestDb({ product: baseProduct });
    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 12, institution_id: 188, role: 'user' },
      secret
    );

    const res = await app.request(
      '/api/ra/issue-token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: authHeader },
        body: JSON.stringify({ product_slug: 'pubs-acs-org', admin_test: true }),
      },
      {
        DB: db,
        JWT_SECRET: secret,
        RA_PROXY_TOKEN_SECRET: 'proxy-secret',
        RA_PROXY_HOST: 'proxy-staging.selmiye.com',
      }
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/admin/i);
  });

  it('returns 409 when admin tests a product that is not RA-enabled', async () => {
    const db = makeProductTestDb({
      product: { ...baseProduct, ra_enabled: 0 },
    });
    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 7, institution_id: 188, role: 'admin' },
      secret
    );

    const res = await app.request(
      '/api/ra/issue-token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: authHeader },
        body: JSON.stringify({ product_slug: 'pubs-acs-org', admin_test: true }),
      },
      {
        DB: db,
        JWT_SECRET: secret,
        RA_PROXY_TOKEN_SECRET: 'proxy-secret',
        RA_PROXY_HOST: 'proxy-staging.selmiye.com',
      }
    );

    expect(res.status).toBe(409);
  });

  it('returns 404 when admin tests an unknown product slug', async () => {
    const db = makeProductTestDb({ product: null });
    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 7, institution_id: 188, role: 'super_admin' },
      secret
    );

    const res = await app.request(
      '/api/ra/issue-token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: authHeader },
        body: JSON.stringify({ product_slug: 'nonexistent', admin_test: true }),
      },
      {
        DB: db,
        JWT_SECRET: secret,
        RA_PROXY_TOKEN_SECRET: 'proxy-secret',
        RA_PROXY_HOST: 'proxy-staging.selmiye.com',
      }
    );

    expect(res.status).toBe(404);
  });

  it('rejects admin_test without product_slug', async () => {
    const db = makeProductTestDb({ product: baseProduct });
    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 7, institution_id: 188, role: 'admin' },
      secret
    );

    const res = await app.request(
      '/api/ra/issue-token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: authHeader },
        body: JSON.stringify({ admin_test: true }),
      },
      {
        DB: db,
        JWT_SECRET: secret,
        RA_PROXY_TOKEN_SECRET: 'proxy-secret',
        RA_PROXY_HOST: 'proxy-staging.selmiye.com',
      }
    );

    expect(res.status).toBe(400);
  });
});

describe('RA admin subscriptions route', () => {
  it('normalizes legacy delivery modes in RA subscriptions listing', async () => {
    const db = new FakeD1([
      {
        match: 'FROM institution_subscriptions s',
        all: async () => ({
          results: [
            {
              id: 14,
              institution_id: 188,
              institution_name: 'ISTANBUL OKAN UNIVERSITY',
              product_slug: 'pangram',
              product_name: 'Pangram',
              access_type: 'email_password_external',
              ra_delivery_mode: 'direct_login',
              access_url: null,
              ra_credential_scope: null,
              ra_valid_until: null,
              ra_enabled: 1,
              has_credential: 0,
              status: 'active',
              created_at: 1710000000,
            },
          ],
        }),
      },
    ]);

    const secret = 'test-jwt-secret';
    const authHeader = await makeAuthHeader(
      { user_id: 1, institution_id: 188, role: 'super_admin' },
      secret
    );

    const res = await app.request(
      '/api/ra/admin/subscriptions-ra',
      {
        headers: {
          authorization: authHeader,
        },
      },
      {
        DB: db,
        JWT_SECRET: secret,
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      subscriptions: [
        expect.objectContaining({
          id: 14,
          product_slug: 'pangram',
          access_type: 'email_password_external',
          ra_delivery_mode: 'path_proxy',
          ra_enabled: 1,
        }),
      ],
    });
  });
});
