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
  const token = await sign({ user_id: 7, role: 'super_admin', exp: Math.floor(Date.now() / 1000) + 300 }, 'test-secret', 'HS256');
  return `authToken=${encodeURIComponent(token)}`;
}

function env(overrides = {}) {
  return {
    JWT_SECRET: 'test-secret',
    ENVIRONMENT: 'staging',
    RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
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

  it('retains the bounded semantic candidate pool in cache while keeping grounded results capped', async () => {
    const results = Array.from({ length: 12 }, (_, index) => ({
      id: `https://openalex.org/W${index + 1}`,
      title: `Candidate ${index + 1}`,
      publication_year: 2026,
      authorships: [],
      cited_by_count: index,
      open_access: {},
      primary_location: null
    }));
    const providerFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      meta: { cost_usd: 0.001 },
      results
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', providerFetch);
    const testEnv = env({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true', RESEARCH_SEMANTIC_CANDIDATE_DEPTH: '50' });
    const first = await handleResearchRequest(new Request('https://example.test/api/research/search?q=candidate%20pool', {
      headers: { cookie: await cookie() }
    }), testEnv);
    const firstBody = await first.json();

    expect(first.status).toBe(200);
    expect(firstBody.results).toHaveLength(10);
    expect(firstBody.candidatePool).toHaveLength(12);
    expect(firstBody.meta.candidatePoolSize).toBe(12);
    expect(firstBody.candidatePool[10].title).toBe('Candidate 11');

    const second = await handleResearchRequest(new Request('https://example.test/api/research/search?q=candidate%20pool', {
      headers: { cookie: await cookie() }
    }), testEnv);
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody.meta.cached).toBe(true);
    expect(secondBody.results).toHaveLength(10);
    expect(secondBody.candidatePool).toHaveLength(12);
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it('uses a deeper lexical candidate pool without increasing final result count', async () => {
    const results = Array.from({ length: 20 }, (_, index) => ({
      id: `https://openalex.org/L${index + 1}`,
      title: `Lexical candidate ${index + 1}`,
      publication_year: 2026,
      authorships: [],
      cited_by_count: index,
      open_access: {},
      primary_location: null
    }));
    const providerFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      meta: { count: 20 },
      results
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(new Request('https://example.test/api/research/search?q=lexical%20depth', {
      headers: { cookie: await cookie() }
    }), env({ RESEARCH_LEXICAL_CANDIDATE_DEPTH: '50' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.retrievalSource).toBe('lexical');
    expect(body.results).toHaveLength(10);
    expect(body.candidatePool).toHaveLength(20);
    expect(body.meta.candidatePoolSize).toBe(20);
    expect(new URL(String(providerFetch.mock.calls[0][0])).searchParams.get('per-page')).toBe('50');
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
