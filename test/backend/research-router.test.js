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

function createEnv(overrides = {}) {
  return {
    JWT_SECRET: 'test-secret',
    ENVIRONMENT: 'staging',
    RATE_LIMIT_KV: createKv(),
    CROSSREF_MAILTO: 'research@example.test',
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

function openAlexPayload() {
  return {
    meta: { cost_usd: 0.001 },
    results: [{
      id: 'https://openalex.org/W42',
      title: 'PEM water electrolysis example',
      doi: 'https://doi.org/10.1000/pem',
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

  it('returns normalized OpenAlex results enriched selectively by Crossref', async () => {
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(openAlexPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-RateLimit-Cost-USD': '0.001' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(crossrefPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await handleResearchRequest(
      new Request('https://example.test/api/research/search?q=PEM%20water%20electrolysis', {
        headers: { cookie: await authCookie(), Origin: 'https://untrusted.example' }
      }),
      createEnv()
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
    const body = await response.json();
    expect(body.meta.partial).toBe(false);
    expect(body.meta.providers.openalex.status).toBe('ok');
    expect(body.meta.providers.crossref.status).toBe('ok');
    expect(body.results).toHaveLength(1);
    expect(body.results[0].doi).toBe('10.1000/pem');
    expect(body.results[0].abstract).toBe('Crossref supplied abstract.');
    expect(body.results[0].evidence.level).toBe('ABSTRACT');
    expect(body.results[0].citations.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'openalex', count: 12 }),
      expect.objectContaining({ source: 'crossref', count: 10 })
    ]));
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it('uses the hashed cache on repeated authenticated queries', async () => {
    const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      meta: { cost_usd: 0.001 },
      results: [{
        id: 'https://openalex.org/W99',
        title: 'Cached research work',
        publication_year: 2026,
        authorships: [],
        open_access: {},
        primary_location: { source: {} }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', providerFetch);
    const env = createEnv({ RESEARCH_CROSSREF_MAX_ENRICHMENTS: '1' });
    const cookie = await authCookie();

    const first = await handleResearchRequest(new Request('https://example.test/api/research/search?q=cache%20test', { headers: { cookie } }), env);
    const second = await handleResearchRequest(new Request('https://example.test/api/research/search?q=cache%20test', { headers: { cookie } }), env);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).meta.cached).toBe(true);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect([...env.RATE_LIMIT_KV.store.keys()].some((key) => key.startsWith('research:cache:v1:'))).toBe(true);
    expect([...env.RATE_LIMIT_KV.store.keys()].some((key) => key.includes('cache test'))).toBe(false);
  });
});
