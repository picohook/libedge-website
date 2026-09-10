import { afterEach, describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import { handleResearchRequest } from '../../backend/src/research/router.js';
import { openAlexBudgetKey } from '../../backend/src/research/budget.js';

function createKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
    store
  };
}

async function cookie() {
  const token = await sign({ user_id: 7, exp: Math.floor(Date.now() / 1000) + 300 }, 'test-secret', 'HS256');
  return `authToken=${encodeURIComponent(token)}`;
}

function env(overrides = {}) {
  return {
    JWT_SECRET: 'test-secret',
    ENVIRONMENT: 'staging',
    RATE_LIMIT_KV: createKv(),
    CROSSREF_MAILTO: 'research@example.test',
    ...overrides
  };
}

function crossrefSearchPayload() {
  return {
    status: 'ok',
    message: {
      items: [{
        DOI: '10.1000/fallback',
        title: ['Crossref fallback work'],
        author: [{ given: 'Ada', family: 'Researcher' }],
        published: { 'date-parts': [[2026, 9, 1]] },
        type: 'journal-article',
        'container-title': ['Fallback Journal'],
        'is-referenced-by-count': 4
      }]
    }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('research provider fallback and budget', () => {
  it('falls back to Crossref when OpenAlex is rate limited and preserves telemetry', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', {
        status: 429,
        headers: {
          'X-RateLimit-Limit-USD': '1',
          'X-RateLimit-Remaining-USD': '0',
          'X-RateLimit-Cost-USD': '0.001'
        }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(crossrefSearchPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(new Request('https://example.test/api/research/search?q=fallback%20query', {
      headers: { cookie: await cookie() }
    }), env());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.partial).toBe(true);
    expect(body.meta.providers.openalex).toMatchObject({
      status: 'rate_limited',
      telemetry: { headerFamily: 'usd', remaining: 0, requestCostUsd: 0.001 }
    });
    expect(body.meta.providers.crossref.status).toBe('ok');
    expect(body.results[0].doi).toBe('10.1000/fallback');
    expect(body.results[0].provenance[0].provider).toBe('crossref');
  });

  it('uses Crossref fallback without calling OpenAlex when soft budget is exhausted', async () => {
    const kv = createKv({ [openAlexBudgetKey()]: '0.05' });
    const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(crossrefSearchPayload()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(new Request('https://example.test/api/research/search?q=budget%20fallback', {
      headers: { cookie: await cookie() }
    }), env({
      RATE_LIMIT_KV: kv,
      OPENALEX_DAILY_SOFT_BUDGET_USD: '0.05'
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.providers.openalex.status).toBe('budget_exhausted');
    expect(body.meta.providers.crossref.status).toBe('ok');
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(String(providerFetch.mock.calls[0][0])).toContain('api.crossref.org/works');
  });
});
