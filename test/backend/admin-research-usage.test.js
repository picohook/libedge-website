import { describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import { app } from '../../backend/src/index.js';

async function cookie(role = 'super_admin') {
  const token = await sign({ user_id: 42, role, exp: Math.floor(Date.now() / 1000) + 300 }, 'test-secret', 'HS256');
  return `authToken=${encodeURIComponent(token)}`;
}

function env() {
  const prepared = [];
  const DB = {
    prepare: vi.fn((sql) => {
      prepared.push(sql);
      return {
        bind: vi.fn((...args) => ({
          first: vi.fn(async () => ({ requests: 4, successes: 3, failures: 1, avg_latency_ms: 125 })),
          all: vi.fn(async () => ({ results: [] }))
        }))
      };
    })
  };
  return { JWT_SECRET: 'test-secret', DB, prepared };
}

describe('superadmin Research usage aggregate API', () => {
  it('rejects non-superadmin callers', async () => {
    const e = env();
    const response = await app.fetch(new Request('https://example.test/api/admin/research/usage', {
      headers: { cookie: await cookie('admin') }
    }), e);
    expect(response.status).toBe(403);
    expect(e.DB.prepare).not.toHaveBeenCalled();
  });

  it('returns bounded content-free operational aggregates', async () => {
    const e = env();
    const response = await app.fetch(new Request(
      'https://example.test/api/admin/research/usage?days=30&user_id=42&institution_id=7',
      { headers: { cookie: await cookie() } }
    ), e);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      window_days: 30,
      filters: { user_id: 42, institution_id: 7 },
      summary: { requests: 4, successes: 3, failures: 1, success_rate: 0.75, failure_rate: 0.25, avg_latency_ms: 125 }
    });
    const sql = e.prepared.join('\n');
    expect(sql).toContain('research_usage_events');
    expect(sql).not.toMatch(/query_text|answer_text|claim_text|evidence_text|prompt_text|payload/i);
  });

  it.each(['0','91','abc'])('rejects invalid days=%s', async (days) => {
    const e = env();
    const response = await app.fetch(new Request(`https://example.test/api/admin/research/usage?days=${days}`, {
      headers: { cookie: await cookie() }
    }), e);
    expect(response.status).toBe(400);
    expect(e.DB.prepare).not.toHaveBeenCalled();
  });
});
