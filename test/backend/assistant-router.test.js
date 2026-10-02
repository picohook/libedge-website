import { describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';

const { discoverMock, generateClaimsMock } = vi.hoisted(() => ({
  discoverMock: vi.fn(),
  generateClaimsMock: vi.fn()
}));

vi.mock('../../backend/src/research/discover.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, Discover: discoverMock };
});

vi.mock('../../backend/src/assistant/bedrock-model-adapter.js', () => ({
  createBedrockModelAdapter: () => ({ generateClaims: generateClaimsMock })
}));

import { handleAssistantRequest } from '../../backend/src/assistant/router.js';

function createEnv(overrides = {}) {
  return {
    JWT_SECRET: 'test-secret',
    RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'UNVERIFIED',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'false',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'UNVERIFIED',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT: '100',
    ...overrides
  };
}

async function authCookie() {
  const token = await sign({
    user_id: 42,
    email: 'researcher@example.test',
    role: 'super_admin',
    exp: Math.floor(Date.now() / 1000) + 300
  }, 'test-secret', 'HS256');
  return `authToken=${encodeURIComponent(token)}`;
}

function work() {
  return {
    id: 'openalex:W1',
    title: 'Hydrogen catalyst research',
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

  it('fails closed before generation when the Research privacy gate is not PASS', async () => {
    const response = await request({ query: 'hydrogen catalyst' });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      code: 'RESEARCH_PRIVACY_GATE_REQUIRED',
      claims: [],
      evidence: []
    });
  });

  it('fails closed at the support-check boundary when the provider gate passes but the checker is paused', async () => {
    discoverMock.mockResolvedValueOnce([work()]);
    generateClaimsMock.mockImplementationOnce(async ({ evidencePack }) => ({
      claims: [{ text: 'Claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
    }));
    const response = await request(
      { query: 'hydrogen catalyst' },
      createEnv({
        RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS'
      })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      code: 'GROUNDING_REJECTED',
      claims: []
    });
    expect(body).not.toHaveProperty('evidence');
  });

  it.each([
    ['HTTP error', async () => new Response('{}', { status: 503 })],
    ['invalid result', async () => new Response(JSON.stringify({ primary_decision: 'MAYBE' }), { status: 200 })],
    ['timeout', (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })]
  ])('never returns grounded OK when the wired checker has an %s', async (_label, fetchImpl) => {
    discoverMock.mockResolvedValueOnce([work()]);
    generateClaimsMock.mockImplementationOnce(async ({ evidencePack }) => ({
      claims: [{ text: 'Supported-looking claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(fetchImpl);
    try {
      const response = await request(
        { query: 'hydrogen catalyst' },
        createEnv({
          RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
          RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'true',
          RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
          RESEARCH_ASSISTANT_SUPPORT_CHECK_URL: 'https://checker.example.test/v1/support',
          RESEARCH_ASSISTANT_SUPPORT_CHECK_TOKEN: 'test-token',
          RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS: '1'
        })
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ ok: false, code: 'GROUNDING_REJECTED', claims: [] });
      expect(body).not.toHaveProperty('evidence');
      expect(body.code).not.toBe('OK');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('exercises the operational pause flag: a previously usable checker becomes fail-closed when disabled', async () => {
    const pinned = {
      model: 'MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli',
      revision: '6f5cf0a2b59cabb106aca4c287eed12e357e90eb',
      engine_manifest_sha256: '96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918',
      primary_decision: 'SUPPORT',
      diagnostic: 'SUPPORT'
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(pinned), { status: 200 }));
    try {
      discoverMock.mockResolvedValueOnce([work()]);
      generateClaimsMock.mockImplementationOnce(async ({ evidencePack }) => ({
        claims: [{ text: 'Claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
      }));
      const activeEnv = createEnv({
        RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'true',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_URL: 'https://checker.example.test/v1/support',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_TOKEN: 'test-token',
        RATE_LIMIT_KV: {
          get: vi.fn(async (key) => {
            if (key === 'assistant:supportcheck:paused') return 'resume';
            if (key === 'assistant:supportcheck:daily-invocation-limit') return null;
            return '0';
          }),
          put: vi.fn(async () => {})
        }
      });
      const activeBody = await (await request({ query: 'hydrogen catalyst' }, activeEnv)).json();
      expect(activeBody.code).toBe('OK');
      expect(activeBody.evidence).toHaveLength(1);

      discoverMock.mockResolvedValueOnce([work()]);
      generateClaimsMock.mockImplementationOnce(async ({ evidencePack }) => ({
        claims: [{ text: 'Claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
      }));
      const pausedBody = await (await request(
        { query: 'hydrogen catalyst' },
        { ...activeEnv, RATE_LIMIT_KV: { get: vi.fn().mockResolvedValue('true') } }
      )).json();

      expect(pausedBody).toMatchObject({ ok: false, code: 'GROUNDING_REJECTED', claims: [] });
      expect(pausedBody).not.toHaveProperty('evidence');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
