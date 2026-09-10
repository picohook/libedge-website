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

function createPacer() {
  return {
    idFromName(name) { return name; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ grantedAtMs: Date.now(), waitMs: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    }
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
    RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'false',
    OPENALEX_SEMANTIC_PACER: createPacer(),
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
  it('preserves the legacy flag-off OpenAlex lexical to Crossref fallback', async () => {
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
    expect(body.meta.retrievalSource).toBe('crossref');
    expect(body.meta.providers.openalex).toMatchObject({
      status: 'rate_limited',
      telemetry: { headerFamily: 'usd', remaining: 0, requestCostUsd: 0.001 }
    });
    expect(body.meta.providers.crossref.status).toBe('ok');
    expect(body.results[0].doi).toBe('10.1000/fallback');
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it('preserves both semantic and lexical failures before Crossref contingency', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(crossrefSearchPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(new Request('https://example.test/api/research/search?q=dual%20failure', {
      headers: { cookie: await cookie() }
    }), env({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.retrievalSource).toBe('crossref');
    expect(body.meta.providers.openalex.status).toBe('unavailable');
    expect(body.meta.providers.openalex.stages.semantic.status).toBe('unavailable');
    expect(body.meta.providers.openalex.stages.lexical.status).toBe('unavailable');
    expect(body.meta.providers.crossref.status).toBe('ok');
    expect(providerFetch).toHaveBeenCalledTimes(3);
    expect(new URL(String(providerFetch.mock.calls[0][0])).searchParams.has('search.semantic')).toBe(true);
    expect(new URL(String(providerFetch.mock.calls[1][0])).searchParams.has('search')).toBe(true);
    expect(String(providerFetch.mock.calls[2][0])).toContain('api.crossref.org/works');
  });

  it('does not allow Crossref to short-circuit a valid semantic empty response', async () => {
    const providerFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      meta: { cost_usd: 0.001 },
      results: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(new Request('https://example.test/api/research/search?q=semantic%20empty', {
      headers: { cookie: await cookie() }
    }), env({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results).toEqual([]);
    expect(body.meta.retrievalSource).toBe('semantic');
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it('uses Crossref contingency without calling OpenAlex when soft budget is exhausted', async () => {
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
      OPENALEX_DAILY_SOFT_BUDGET_USD: '0.05',
      RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true'
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.providers.openalex.status).toBe('budget_exhausted');
    expect(body.meta.providers.crossref.status).toBe('ok');
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(String(providerFetch.mock.calls[0][0])).toContain('api.crossref.org/works');
  });
});
