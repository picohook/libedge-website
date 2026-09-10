import { afterEach, describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import { handleResearchRequest } from '../../backend/src/research/router.js';

function createKv() {
  const store = new Map();
  return {
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
    store
  };
}

function createPacer() {
  const calls = [];
  return {
    calls,
    idFromName(name) { return name; },
    get() {
      return {
        async fetch(url, init) {
          calls.push({ url: String(url), init });
          return new Response(JSON.stringify({ grantedAtMs: Date.now(), waitMs: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    }
  };
}

function createEnv(overrides = {}) {
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

async function authCookie() {
  const token = await sign({
    user_id: 42,
    email: 'researcher@example.test',
    exp: Math.floor(Date.now() / 1000) + 300
  }, 'test-secret', 'HS256');
  return `authToken=${encodeURIComponent(token)}`;
}

function openAlexPayload({ id = 'W42', title = 'PEM water electrolysis example', doi = 'https://doi.org/10.1000/pem' } = {}) {
  return {
    meta: { cost_usd: 0.001 },
    results: [{
      id: `https://openalex.org/${id}`,
      title,
      doi,
      publication_year: 2026,
      publication_date: '2026-08-01',
      type: 'article',
      authorships: [{ author: { display_name: 'Ada Researcher', orcid: 'https://orcid.org/0000-0000-0000-000X' } }],
      cited_by_count: 12,
      open_access: { is_oa: true, oa_status: 'gold' },
      primary_location: { source: { display_name: 'Journal of Tests', issn: ['1234-5678'] } }
    }]
  };
}

function crossrefPayload() {
  return {
    status: 'ok',
    message: {
      DOI: '10.1000/pem',
      title: ['PEM water electrolysis example'],
      abstract: '<jats:p>Crossref supplied abstract.</jats:p>',
      'is-referenced-by-count': 10,
      license: [{ URL: 'https://creativecommons.org/licenses/by/4.0/', 'content-version': 'vor' }]
    }
  };
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('research search endpoint', () => {
  it('rejects unauthenticated requests without calling providers', async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);
    const response = await handleResearchRequest(
      new Request('https://example.test/api/research/search?q=PEM'),
      createEnv()
    );
    expect(response.status).toBe(401);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('keeps lexical search as the flag-off baseline and enriches with Crossref', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(openAlexPayload(), 200, { 'X-RateLimit-Cost-USD': '0.001' }))
      .mockResolvedValueOnce(jsonResponse(crossrefPayload()));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(
      new Request('https://example.test/api/research/search?q=PEM%20water%20electrolysis', {
        headers: { cookie: await authCookie(), Origin: 'https://untrusted.example' }
      }),
      createEnv()
    );
    expect(response.status).toBe(200);
    const firstUrl = new URL(String(providerFetch.mock.calls[0][0]));
    expect(firstUrl.searchParams.get('search')).toBe('PEM water electrolysis');
    expect(firstUrl.searchParams.has('search.semantic')).toBe(false);
    const body = await response.json();
    expect(body.meta.retrievalSource).toBe('lexical');
    expect(body.results[0].abstract).toBe('Crossref supplied abstract.');
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it('uses semantic search first when the flag is on and preserves the normalized query', async () => {
    const providerFetch = vi.fn().mockResolvedValue(jsonResponse(openAlexPayload({ doi: null })));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' });

    const response = await handleResearchRequest(new Request(
      'https://example.test/api/research/search?q=%20green%20%20hydrogen%20policy%20',
      { headers: { cookie: await authCookie() } }
    ), env);
    expect(response.status).toBe(200);
    const url = new URL(String(providerFetch.mock.calls[0][0]));
    expect(url.searchParams.get('search.semantic')).toBe('green hydrogen policy');
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.get('per-page')).toBe('50');
    expect((await response.json()).meta.retrievalSource).toBe('semantic');
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(env.OPENALEX_SEMANTIC_PACER.calls).toHaveLength(1);
  });

  it('treats a valid empty semantic response as success without L or Crossref fallback', async () => {
    const providerFetch = vi.fn().mockResolvedValue(jsonResponse({ meta: { cost_usd: 0.001 }, results: [] }));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' });

    const response = await handleResearchRequest(new Request(
      'https://example.test/api/research/search?q=no%20matches',
      { headers: { cookie: await authCookie() } }
    ), env);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results).toEqual([]);
    expect(body.meta.retrievalSource).toBe('semantic');
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect([...env.RATE_LIMIT_KV.store.keys()].some((key) => key.endsWith(':semantic_valid_empty'))).toBe(true);
  });

  it('falls back to lexical only after an objective semantic failure and never merges outputs', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(openAlexPayload({ id: 'W-L', title: 'Lexical fallback', doi: null })));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' });

    const response = await handleResearchRequest(new Request(
      'https://example.test/api/research/search?q=fallback%20case',
      { headers: { cookie: await authCookie() } }
    ), env);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe('Lexical fallback');
    expect(body.meta.retrievalSource).toBe('lexical');
    expect(body.meta.providers.openalex.fallback).toBe(true);
    expect(body.meta.providers.openalex.stages.semantic.status).toBe('unavailable');
    expect(body.meta.providers.openalex.stages.lexical.status).toBe('ok');
    expect(new URL(String(providerFetch.mock.calls[0][0])).searchParams.has('search.semantic')).toBe(true);
    expect(new URL(String(providerFetch.mock.calls[1][0])).searchParams.has('search')).toBe(true);
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it('uses lexical fallback for malformed semantic payloads but not for valid empty payloads', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ meta: { cost_usd: 0.001 }, not_results: [] }))
      .mockResolvedValueOnce(jsonResponse(openAlexPayload({ id: 'W-M', title: 'Malformed fallback', doi: null })));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(new Request(
      'https://example.test/api/research/search?q=malformed%20semantic',
      { headers: { cookie: await authCookie() } }
    ), createEnv({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' }));
    expect(response.status).toBe(200);
    expect((await response.json()).meta.retrievalSource).toBe('lexical');
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it('does not let a cached lexical fallback suppress a later semantic attempt', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(openAlexPayload({ id: 'W-LC', title: 'Cached lexical', doi: null })))
      .mockResolvedValueOnce(jsonResponse(openAlexPayload({ id: 'W-S', title: 'Fresh semantic', doi: null })));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' });
    const cookie = await authCookie();
    const request = () => new Request('https://example.test/api/research/search?q=cache%20source%20test', { headers: { cookie } });

    const first = await handleResearchRequest(request(), env);
    expect((await first.json()).meta.retrievalSource).toBe('lexical');
    const second = await handleResearchRequest(request(), env);
    const secondBody = await second.json();
    expect(secondBody.meta.retrievalSource).toBe('semantic');
    expect(secondBody.results[0].title).toBe('Fresh semantic');
    expect(providerFetch).toHaveBeenCalledTimes(3);
    expect(new URL(String(providerFetch.mock.calls[2][0])).searchParams.has('search.semantic')).toBe(true);
  });

  it('uses cached lexical only after the current semantic attempt fails objectively', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(openAlexPayload({ id: 'W-L1', title: 'Reusable lexical', doi: null })))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv({ RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'true' });
    const cookie = await authCookie();
    const makeRequest = () => new Request('https://example.test/api/research/search?q=lexical%20cache%20fallback', { headers: { cookie } });

    await handleResearchRequest(makeRequest(), env);
    const second = await handleResearchRequest(makeRequest(), env);
    const body = await second.json();
    expect(body.meta.retrievalSource).toBe('lexical');
    expect(body.meta.cached).toBe(true);
    expect(body.meta.providers.openalex.fallback).toBe(true);
    expect(body.meta.providers.openalex.stages.semantic.status).toBe('unavailable');
    expect(body.meta.providers.openalex.stages.lexical.cached).toBe(true);
    expect(providerFetch).toHaveBeenCalledTimes(3);
  });

  it('uses source-partitioned hashed cache keys without raw query text', async () => {
    const providerFetch = vi.fn().mockResolvedValue(jsonResponse(openAlexPayload({ id: 'W99', title: 'Cached research work', doi: null })));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv();
    const cookie = await authCookie();

    const first = await handleResearchRequest(new Request('https://example.test/api/research/search?q=cache%20test', { headers: { cookie } }), env);
    const second = await handleResearchRequest(new Request('https://example.test/api/research/search?q=cache%20test', { headers: { cookie } }), env);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).meta.cached).toBe(true);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect([...env.RATE_LIMIT_KV.store.keys()].some((key) => key.startsWith('research:cache:v2:'))).toBe(true);
    expect([...env.RATE_LIMIT_KV.store.keys()].some((key) => key.includes('cache test'))).toBe(false);
  });
});
