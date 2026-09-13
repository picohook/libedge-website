import { describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';

const { discoverMock } = vi.hoisted(() => ({ discoverMock: vi.fn() }));

vi.mock('../../backend/src/research/discover.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, Discover: discoverMock };
});

import { handleAssistantRequest } from '../../backend/src/assistant/router.js';

function createEnv(overrides = {}) {
  return {
    JWT_SECRET: 'test-secret',
    RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'UNVERIFIED',
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

function work() {
  return {
    id: 'openalex:W1',
    title: 'Test research work',
    authors: [{ name: 'Ada Researcher', orcid: null }],
    publicationDate: '2026-01-01',
    publicationYear: 2026,
    type: 'article',
    language: 'en',
    doi: '10.1000/test',
    identifiers: { doi: '10.1000/test' },
    venue: { name: 'Journal', issn: [], publisher: 'Publisher' },
    abstract: 'Evidence text.',
    evidence: {
      level: 'ABSTRACT',
      sources: [{ kind: 'abstract', provider: 'openalex', sourceRef: 'W1', retrievedAt: '2026-09-13T00:00:00Z' }]
    },
    openAccess: { isOa: true, status: 'gold', url: null, source: 'openalex' },
    licenses: [],
    citations: { preferredCount: 1, preferredSource: 'openalex', observations: [] },
    urls: { doi: 'https://doi.org/10.1000/test', publisher: null, openAccess: null },
    flags: { retracted: false },
    provenance: [{ provider: 'openalex', providerId: 'W1', retrievedAt: '2026-09-13T00:00:00Z' }]
  };
}

async function request(body, env = createEnv(), authenticated = true) {
  const headers = { 'content-type': 'application/json' };
  if (authenticated) headers.cookie = await authCookie();
  return handleAssistantRequest(new Request('https://example.test/api/assistant/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  }), env);
}

describe('assistant ask endpoint', () => {
  it('returns 401 without authentication', async () => {
    const response = await request({ query: 'hydrogen catalyst' }, createEnv(), false);
    expect(response.status).toBe(401);
  });

  it.each([
    [{ query: '' }],
    [{ query: 'x'.repeat(301) }]
  ])('returns 400 for invalid query', async (body) => {
    const response = await request(body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('ASSISTANT_QUERY_INVALID');
  });

  it('returns the provider-gate limitation with the default closed flag', async () => {
    discoverMock.mockResolvedValueOnce([work()]);
    const response = await request({ query: 'hydrogen catalyst' });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      code: 'PROVIDER_PRIVACY_GATE_REQUIRED',
      claims: []
    });
  });

  it('still cannot call a model when the flag is PASS because no adapter is wired', async () => {
    discoverMock.mockResolvedValueOnce([work()]);
    const response = await request(
      { query: 'hydrogen catalyst' },
      createEnv({ RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS' })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      code: 'MODEL_ADAPTER_REQUIRED',
      claims: []
    });
  });
});
