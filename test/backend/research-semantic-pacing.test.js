import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAlexSemanticPacer, acquireSemanticPacing } from '../../backend/src/research/semantic-pacer.js';

function createStorage() {
  const store = new Map();
  return {
    async get(key) { return store.get(key); },
    async put(key, value) { store.set(key, value); },
    store
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('OpenAlex semantic pacing', () => {
  it('serializes grants with at least 1000ms spacing using stored last-start state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
    const storage = createStorage();
    const pacer = new OpenAlexSemanticPacer({ storage }, {});

    const first = await pacer.fetch(new Request('https://semantic-pacer/gate', { method: 'POST' }));
    const firstBody = await first.json();
    expect(first.status).toBe(200);

    const secondPromise = pacer.fetch(new Request('https://semantic-pacer/gate', { method: 'POST' }));
    await vi.advanceTimersByTimeAsync(999);
    let settled = false;
    secondPromise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const second = await secondPromise;
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.grantedAtMs - firstBody.grantedAtMs).toBeGreaterThanOrEqual(1000);
    expect(storage.store.get('last_start_ms')).toBe(secondBody.grantedAtMs);
  });

  it('sends no query or user data through the pacing binding request', async () => {
    const calls = [];
    const env = {
      OPENALEX_SEMANTIC_PACER: {
        idFromName(name) { return name; },
        get() {
          return {
            async fetch(url, init) {
              calls.push({ url: String(url), init });
              return new Response(JSON.stringify({ grantedAtMs: 12345, waitMs: 20 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          };
        }
      }
    };

    const result = await acquireSemanticPacing(env);
    expect(result).toEqual({ grantedAtMs: 12345, waitMs: 20 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://semantic-pacer/gate');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBeUndefined();
  });

  it('fails closed when the pacing binding is unavailable', async () => {
    await expect(acquireSemanticPacing({})).rejects.toMatchObject({
      code: 'OPENALEX_SEMANTIC_PACING_UNAVAILABLE'
    });
  });
});
