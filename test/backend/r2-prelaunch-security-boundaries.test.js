import { describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';

import app from '../../backend/src/index.js';
import { deleteAssistantHistory, getAssistantHistory } from '../../backend/src/assistant/history-storage.js';

const SECRET = 'test-only-assistant-history-secret-at-least-32-chars';

async function authCookie(role = 'user') {
  const token = await sign(
    { user_id: 42, role, exp: Math.floor(Date.now() / 1000) + 300 },
    'test-secret',
    'HS256'
  );
  return `authToken=${encodeURIComponent(token)}`;
}

function guardedEnv() {
  const put = vi.fn(async () => {});
  return {
    env: {
      JWT_SECRET: 'test-secret',
      RATE_LIMIT_KV: {
        get: vi.fn(async () => null),
        put
      }
    },
    put
  };
}

describe('R2 pre-launch security boundaries', () => {
  it.each([
    ['/api/admin/research/assistant-usage-state', { scope_type: 'institution', scope_id: '7', action: 'pause' }],
    ['/api/admin/research/assistant-usage-limit', { scope_type: 'institution', scope_id: '7', daily_request_limit: 10 }],
    ['/api/admin/research/support-check-state', { action: 'pause' }],
    ['/api/admin/research/support-check-limit', { daily_invocation_limit: 300 }]
  ])('denies non-superadmin mutation of %s before KV writes', async (path, body) => {
    const { env, put } = guardedEnv();
    const response = await app.fetch(new Request(`https://example.test${path}`, {
      method: 'POST',
      headers: {
        cookie: await authCookie('user'),
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }), env);

    expect(response.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it('binds history reads to both history id and authenticated owner id', async () => {
    const first = vi.fn(async () => null);
    const bind = vi.fn(() => ({ first }));
    const DB = { prepare: vi.fn(() => ({ bind })) };

    await expect(getAssistantHistory(
      { DB, ASSISTANT_HISTORY_ENCRYPTION_SECRET: SECRET },
      42,
      99
    )).resolves.toBeNull();

    expect(DB.prepare.mock.calls[0][0]).toMatch(/WHERE id = \? AND user_id = \?/);
    expect(bind).toHaveBeenCalledWith(99, 42);
  });

  it('binds history deletes to both history id and authenticated owner id', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 0 } }));
    const bind = vi.fn(() => ({ run }));
    const DB = { prepare: vi.fn(() => ({ bind })) };

    await expect(deleteAssistantHistory({ DB }, 42, 99)).resolves.toBe(false);

    expect(DB.prepare).toHaveBeenCalledWith(
      'DELETE FROM assistant_saved_queries WHERE id = ? AND user_id = ?'
    );
    expect(bind).toHaveBeenCalledWith(99, 42);
  });
});
