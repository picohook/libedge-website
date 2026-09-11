import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { handleSystemHealthRequest } from '../../backend/src/system-health.js';

function createDb({ pending = 0, actions = 0 } = {}) {
  return {
    prepare(sql) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes('privacy_r2_purge_queue')) return { count: pending };
          if (sql.includes('admin_action_logs')) return { count: actions };
          return { ok: 1 };
        },
        async all() {
          if (sql.includes('research_telemetry_counters')) return { results: [] };
          return { results: [] };
        },
      };
      return statement;
    },
  };
}

async function requestWithRole(role, secret = 'test-secret') {
  const token = await sign({
    user_id: 1,
    role,
    exp: Math.floor(Date.now() / 1000) + 300,
  }, secret, 'HS256');
  return new Request('https://example.test/api/admin/system-health', {
    headers: { cookie: `authToken=${encodeURIComponent(token)}` },
  });
}

function createEnv(overrides = {}) {
  return {
    JWT_SECRET: 'test-secret',
    ENVIRONMENT: 'staging',
    WORKER_NAME: 'libedge-api-staging',
    DB: createDb({ pending: 2, actions: 7 }),
    FILES_BUCKET: { async list() { return { objects: [] }; } },
    RATE_LIMIT_KV: { async get() { return null; } },
    ...overrides,
  };
}

describe('system health endpoint', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await handleSystemHealthRequest(
      new Request('https://example.test/api/admin/system-health'),
      createEnv(),
    );
    expect(response.status).toBe(401);
  });

  it('rejects non-super-admin users', async () => {
    const response = await handleSystemHealthRequest(await requestWithRole('admin'), createEnv());
    expect(response.status).toBe(403);
  });

  it('returns read-only health summary for super admin', async () => {
    const response = await handleSystemHealthRequest(await requestWithRole('super_admin'), createEnv());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.environment).toBe('staging');
    expect(body.components.database.status).toBe('ok');
    expect(body.components.object_storage.status).toBe('ok');
    expect(body.components.rate_limit_store.status).toBe('ok');
    expect(body.privacy.pending_r2_purge).toBe(2);
    expect(body.activity.actions_24h).toBe(7);
  });

  it('degrades without exposing backend error details', async () => {
    const response = await handleSystemHealthRequest(
      await requestWithRole('super_admin'),
      createEnv({ FILES_BUCKET: { async list() { throw new Error('bucket unavailable'); } } }),
    );
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.components.object_storage).toEqual({ status: 'error' });
    expect(JSON.stringify(body)).not.toContain('bucket unavailable');
  });
});
