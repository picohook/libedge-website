import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { handleSystemHealthRequest } from '../../backend/src/system-health.js';
import { RESEARCH_TELEMETRY_METRICS, researchTelemetryMetricKey } from '../../backend/src/research/telemetry.js';

const JWT_SECRET = 'test-system-health-secret';

function fakeDb() {
  return {
    prepare(sql) {
      return {
        async first() {
          if (sql.includes('privacy_r2_purge_queue')) return { count: 0 };
          if (sql.includes('admin_action_logs')) return { count: 2 };
          return { ok: 1 };
        }
      };
    }
  };
}

function fakeKv(values = new Map()) {
  return {
    async get(key) {
      if (key === '__libedge_system_health_probe__') return null;
      return values.has(key) ? String(values.get(key)) : null;
    }
  };
}

async function authRequest(role = 'super_admin') {
  const token = await sign({ sub: 'system-health-test', role }, JWT_SECRET, 'HS256');
  return new Request('https://example.test/api/admin/system-health', {
    headers: { cookie: `authToken=${encodeURIComponent(token)}` }
  });
}

function envWithTelemetry(values = new Map()) {
  return {
    JWT_SECRET,
    ENVIRONMENT: 'staging',
    WORKER_NAME: 'libedge-api-staging',
    DB: fakeDb(),
    FILES_BUCKET: { async list() { return { objects: [] }; } },
    RATE_LIMIT_KV: fakeKv(values)
  };
}

describe('system health research telemetry', () => {
  it('rejects authenticated non-super-admin users', async () => {
    const response = await handleSystemHealthRequest(await authRequest('admin'), envWithTelemetry());
    expect(response.status).toBe(403);
  });

  it('returns only the shared telemetry allowlist for super admins', async () => {
    const now = new Date();
    const values = new Map([
      [researchTelemetryMetricKey('semantic_attempts', now), 5],
      [researchTelemetryMetricKey('semantic_pacing_wait_ms_total', now), 1500],
      [researchTelemetryMetricKey('semantic_429', now), 1]
    ]);
    const response = await handleSystemHealthRequest(await authRequest(), envWithTelemetry(values));
    expect(response.status).toBe(200);

    const body = await response.json();
    const metrics = body.research_telemetry.snapshot.metrics;
    expect(Object.keys(metrics).sort()).toEqual([...RESEARCH_TELEMETRY_METRICS].sort());
    expect(metrics.semantic_attempts).toBe(5);
    expect(metrics.semantic_pacing_wait_ms_total).toBe(1500);
    expect(metrics.semantic_429).toBe(1);
    expect(metrics.semantic_successes).toBe(0);
  });

  it('does not expose query, user, topic, or result content in telemetry', async () => {
    const response = await handleSystemHealthRequest(await authRequest(), envWithTelemetry());
    const body = await response.json();
    const telemetry = body.research_telemetry;
    const serialized = JSON.stringify(telemetry).toLowerCase();

    expect(serialized).not.toContain('query');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('topic');
    expect(serialized).not.toContain('doi');
    expect(serialized).not.toContain('title');
    expect(serialized).not.toContain('result');
  });
});
