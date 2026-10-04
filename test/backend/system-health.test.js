import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { handleSystemHealthRequest } from '../../backend/src/system-health.js';

function createDb({ pending = 0, actions = 0, schemaCurrent = true } = {}) {
  return {
    prepare(sql) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes('privacy_r2_purge_queue')) return { count: pending };
          if (sql.includes('admin_action_logs')) return { count: actions };
          if (sql.includes("name='institution_subscription_seats'")) return { count: schemaCurrent ? 1 : 0 };
          if (sql.includes("name='research_telemetry_counters'")) return { count: schemaCurrent ? 1 : 0 };
          return { ok: 1 };
        },
        async all() {
          if (sql.includes('PRAGMA table_info(institution_subscriptions)')) {
            return { results: schemaCurrent ? [{ name: 'id' }, { name: 'seat_limit' }] : [{ name: 'id' }] };
          }
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


  it('returns fresh content-free checker infrastructure state and fails stale state closed', async () => {
    const now = new Date().toISOString();
    const kv = {
      async get(key) {
        if (key === 'assistant:supportcheck:infrastructure-state') {
          return JSON.stringify({ state: 'available', published_at: now, source: 'staging-lifecycle-workflow', instance_type: 'ml.m5.large', instance_count: 1 });
        }
        return null;
      },
    };
    const response = await handleSystemHealthRequest(await requestWithRole('super_admin'), createEnv({ RATE_LIMIT_KV: kv }));
    const body = await response.json();
    expect(body.support_check.infrastructure).toMatchObject({ state: 'available', stale: false, instance_type: 'ml.m5.large', instance_count: 1, hourly_cost_usd: null });
    expect(JSON.stringify(body)).not.toContain('staging-lifecycle-workflow');

    const staleKv = {
      async get(key) {
        if (key === 'assistant:supportcheck:infrastructure-state') {
          return JSON.stringify({ state: 'available', published_at: '2026-01-01T00:00:00.000Z', instance_type: 'ml.m5.large', instance_count: 1 });
        }
        return null;
      },
    };
    const staleResponse = await handleSystemHealthRequest(await requestWithRole('super_admin'), createEnv({ RATE_LIMIT_KV: staleKv }));
    const staleBody = await staleResponse.json();
    expect(staleBody.support_check.infrastructure).toMatchObject({ state: 'unknown', stale: true, instance_type: null, instance_count: null });

    const unavailableKv = {
      async get(key) {
        if (key === 'assistant:supportcheck:infrastructure-state') return JSON.stringify({ state: 'unavailable', published_at: new Date().toISOString(), instance_type: null, instance_count: null });
        return null;
      },
    };
    const unavailableResponse = await handleSystemHealthRequest(await requestWithRole('super_admin'), createEnv({ RATE_LIMIT_KV: unavailableKv }));
    expect((await unavailableResponse.json()).support_check.infrastructure.state).toBe('unavailable');

    const malformedKv = { async get(key) { return key === 'assistant:supportcheck:infrastructure-state' ? '{bad-json' : null; } };
    const malformedResponse = await handleSystemHealthRequest(await requestWithRole('super_admin'), createEnv({ RATE_LIMIT_KV: malformedKv }));
    expect((await malformedResponse.json()).support_check.infrastructure).toMatchObject({ state: 'unknown', stale: true });

    const futureKv = {
      async get(key) {
        if (key === 'assistant:supportcheck:infrastructure-state') return JSON.stringify({ state: 'available', published_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), instance_type: 'ml.m5.large', instance_count: 1 });
        return null;
      },
    };
    const futureResponse = await handleSystemHealthRequest(await requestWithRole('super_admin'), createEnv({ RATE_LIMIT_KV: futureKv }));
    expect((await futureResponse.json()).support_check.infrastructure).toMatchObject({ state: 'unknown', stale: true, instance_type: null, instance_count: null });
  });

  it('degrades when required Research schema is missing', async () => {
    const response = await handleSystemHealthRequest(
      await requestWithRole('super_admin'),
      createEnv({ DB: createDb({ pending: 2, actions: 7, schemaCurrent: false }) }),
    );
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(body.components.database_schema.status).toBe('error');
    expect(body.components.database_schema.schema_current).toBe(false);
    expect(body.components.database_schema.missing).toContain('institution_subscriptions.seat_limit');
    expect(body.components.database_schema.missing).toContain('institution_subscription_seats');
    expect(body.components.database_schema.missing).toContain('research_telemetry_counters');
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
