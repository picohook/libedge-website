import { describe, it, expect } from 'vitest';
import { checkEgressHealth } from '../../backend/src/ra/tunnel-health.js';

describe('checkEgressHealth', () => {
  it('marks HTTP 200 health responses as ok', async () => {
    const health = await checkEgressHealth('https://egress.example', {
      fetchImpl: async (url) => new Response('ok', {
        status: url === 'https://egress.example/health' ? 200 : 404,
      }),
    });

    expect(health.ok).toBe(true);
    expect(health.status).toBe(200);
    expect(health.body).toBe('ok');
    expect(health.tested_url).toBe('https://egress.example/health');
  });

  it('marks non-200 responses as errors without throwing', async () => {
    const health = await checkEgressHealth('https://egress.example/', {
      fetchImpl: async () => new Response('down', { status: 503 }),
    });

    expect(health.ok).toBe(false);
    expect(health.status).toBe(503);
    expect(health.body).toBe('down');
  });

  it('captures fetch failures as errors', async () => {
    const health = await checkEgressHealth('https://egress.example', {
      fetchImpl: async () => {
        throw new Error('network down');
      },
    });

    expect(health.ok).toBe(false);
    expect(health.status).toBe(0);
    expect(health.error).toContain('network down');
  });
});
