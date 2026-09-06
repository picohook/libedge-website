import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';

import app from '../../backend/src/index.js';

class MemoryBucket {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, opts = {}) {
    this.objects.set(key, {
      body,
      contentType: opts.httpMetadata?.contentType || 'application/octet-stream',
    });
  }

  async get(key) {
    const object = this.objects.get(key);
    if (!object) return null;

    return {
      body: object.body,
      httpEtag: '"test-etag"',
      writeHttpMetadata(headers) {
        headers.set('content-type', object.contentType);
      },
    };
  }

  async delete(key) {
    this.objects.delete(key);
  }
}

class InstitutionLogoD1 {
  constructor() {
    this.logoUrl = null;
    this.adminActions = [];
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

  async batch(statements) {
    for (const statement of statements) {
      if (typeof statement?.run === 'function') await statement.run();
    }
    return statements.map(() => ({ success: true }));
  }

  async dispatch(sql, binds, method) {
    if (method === 'first' && sql.includes('SELECT logo_url FROM institutions WHERE id = ?')) {
      return { logo_url: this.logoUrl };
    }

    if (method === 'run' && sql.includes('UPDATE institutions SET logo_url = ? WHERE id = ?')) {
      this.logoUrl = binds[0];
      return { success: true };
    }

    if (method === 'run' && sql.includes('INSERT INTO admin_action_logs')) {
      this.adminActions.push({ entityId: binds[2], action: binds[3] });
      return { success: true };
    }

    if (method === 'first' && sql.includes('FROM files')) {
      return null;
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

function testEnv(db, bucket, secret = 'test-jwt-secret') {
  return {
    DB: db,
    FILES_BUCKET: bucket,
    JWT_SECRET: secret,
    R2_PUBLIC_URL: 'https://cdn.example.com',
    ENVIRONMENT: 'staging',
  };
}

describe('institution logo storage and retrieval', () => {
  it('stores institution logos under the resolved institution id key', async () => {
    const secret = 'test-jwt-secret';
    const db = new InstitutionLogoD1();
    const bucket = new MemoryBucket();
    const formData = new FormData();
    formData.append('logo', new File(['<svg />'], 'Logo.SVG', { type: 'image/svg+xml' }));

    const res = await app.request('/api/admin/institution/42/logo', {
      method: 'POST',
      headers: {
        authorization: await makeSuperAdminAuth(secret),
      },
      body: formData,
    }, testEnv(db, bucket, secret));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      logo_url: 'https://cdn.example.com/institution-logos/42.svg',
    });
    expect(bucket.objects.has('institution-logos/42.svg')).toBe(true);
    expect(bucket.objects.has('institution-logos/${id}.${ext}')).toBe(false);
    expect(db.logoUrl).toBe('https://cdn.example.com/institution-logos/42.svg');
  });

  it('serves institution logo files without collection references as public assets', async () => {
    const db = new InstitutionLogoD1();
    const bucket = new MemoryBucket();
    await bucket.put('institution-logos/42.svg', new TextEncoder().encode('<svg />'), {
      httpMetadata: { contentType: 'image/svg+xml' },
    });

    const res = await app.request('/api/files/institution-logos/42.svg', {}, testEnv(db, bucket));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(await res.text()).toBe('<svg />');
  });
});
