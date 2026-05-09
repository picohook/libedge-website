import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';

import app from '../../backend/src/index.js';

class ProductAdminD1 {
  constructor() {
    this.products = new Map([
      ['existing-card', {
        slug: 'existing-card',
        name: 'Existing Card',
        category: 'Test',
        region: 'TR',
        brochure_url: null,
      }],
    ]);
  }

  prepare(sql) {
    const db = this;
    return {
      binds: [],
      bind(...args) {
        const expected = (sql.match(/\?/g) || []).length;
        expect(args).toHaveLength(expected);
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

  async batch(statements) {
    for (const statement of statements) {
      if (typeof statement?.run === 'function') await statement.run();
    }
    return statements.map(() => ({ success: true }));
  }

  async dispatch(sql, binds, method) {
    if (method === 'first' && sql.includes('SELECT slug FROM products WHERE slug = ?')) {
      return this.products.has(binds[0]) ? { slug: binds[0] } : null;
    }

    if (method === 'first' && sql.includes('SELECT * FROM products WHERE slug = ?')) {
      return this.products.get(binds[0]) || null;
    }

    if (method === 'run' && sql.includes('INSERT INTO products')) {
      this.products.set(binds[0], { slug: binds[0], name: binds[1], brochure_url: binds.at(-1) });
      return { success: true };
    }

    if (method === 'run' && sql.includes('UPDATE products') && sql.includes('brochure_url = ?')) {
      const slug = binds.at(-1);
      const existing = this.products.get(slug) || { slug };
      this.products.set(slug, { ...existing, brochure_url: binds.at(-2) });
      return { success: true };
    }

    if (method === 'all') return { results: [] };
    if (method === 'first') return null;
    return { success: true };
  }
}

async function makeSuperAdminAuth(secret) {
  const token = await sign({ user_id: 1, id: 1, role: 'super_admin', institution_id: 1 }, secret);
  return `Bearer ${token}`;
}

function productPayload(overrides = {}) {
  return {
    slug: 'new-card',
    name: 'New Card',
    category: 'Test',
    region: 'TR',
    default_access_type: 'direct',
    default_access_url: 'https://example.com',
    brochure_url: 'https://example.com/brochure.pdf',
    card_visible: true,
    display_order: 10,
    ...overrides,
  };
}

describe('admin product card persistence', () => {
  it('creates products with brochure_url without D1 bind mismatch', async () => {
    const secret = 'test-jwt-secret';
    const db = new ProductAdminD1();
    const res = await app.request('/api/admin/products', {
      method: 'POST',
      headers: {
        authorization: await makeSuperAdminAuth(secret),
        'content-type': 'application/json',
      },
      body: JSON.stringify(productPayload()),
    }, {
      DB: db,
      JWT_SECRET: secret,
    });

    expect(res.status).toBe(201);
    expect(db.products.get('new-card')?.brochure_url).toBe('https://example.com/brochure.pdf');
  });

  it('updates products with brochure_url without D1 bind mismatch', async () => {
    const secret = 'test-jwt-secret';
    const db = new ProductAdminD1();
    const res = await app.request('/api/admin/product/existing-card', {
      method: 'PUT',
      headers: {
        authorization: await makeSuperAdminAuth(secret),
        'content-type': 'application/json',
      },
      body: JSON.stringify(productPayload({
        slug: 'existing-card',
        name: 'Existing Card Updated',
        brochure_url: 'https://example.com/updated.pdf',
      })),
    }, {
      DB: db,
      JWT_SECRET: secret,
    });

    expect(res.status).toBe(200);
    expect(db.products.get('existing-card')?.brochure_url).toBe('https://example.com/updated.pdf');
  });
});
