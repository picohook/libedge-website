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
  bedrockAdapterConfig: () => ({ region: 'us-east-1', modelId: 'test-model' }),
  createBedrockModelAdapter: () => ({ generateClaims: generateClaimsMock })
}));

import { handleAssistantRequest, publicResearchSummary } from '../../backend/src/assistant/router.js';

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

describe('public Research summary boundary', () => {
  it('exposes only allowlisted non-negative integer cardinalities', () => {
    const summary = publicResearchSummary({
      diagnostic_retrieval: {
        retrieved_count: 17, authorized_relevant_count: 6, abstract_bearing_count: 4, metadata_only_count: 2,
        query: 'private query', arbitrary_count: 999
      },
      diagnostic_grounding: {
        checked_count: 3, truncated_count: 2, claim_text: 'private claim', support_check_limit: 4,
        rejection_counts: { CLAIM_UNSUPPORTED: 2, SUPPORT_CHECK_FAILED_TIMEOUT: 1, PRIVATE_REASON: 99 }
      },
      claims: [{ text: 'Verified claim' }]
    });
    expect(summary).toEqual({
      literature: { retrieved_count: 17, authorized_relevant_count: 6, abstract_bearing_count: 4, metadata_only_count: 2 },
      verification: { checked_count: 3, verified_count: 1, truncated_count: 2, rejection_counts: { CLAIM_UNSUPPORTED: 2, SUPPORT_CHECK_FAILED_TIMEOUT: 1 } }
    });
    expect(JSON.stringify(summary)).not.toMatch(/private query|private claim|arbitrary|support_check_limit|PRIVATE_REASON/);
  });

  it('fails missing, negative, fractional and content-like counts safely to zero', () => {
    expect(publicResearchSummary({
      diagnostic_retrieval: { retrieved_count: '17 works', authorized_relevant_count: -1, abstract_bearing_count: 1.5 },
      diagnostic_grounding: { checked_count: 'private', truncated_count: -2 },
      claims: []
    })).toEqual({
      literature: { retrieved_count: 0, authorized_relevant_count: 0, abstract_bearing_count: 0, metadata_only_count: 0 },
      verification: { checked_count: 0, verified_count: 0, truncated_count: 0, rejection_counts: {} }
    });
  });
});

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

  it('rejects a paused usage scope before quota reservation or paid Assistant work', async () => {
    discoverMock.mockClear();
    generateClaimsMock.mockClear();
    const put = vi.fn(async () => {});
    const response = await request(
      { query: 'hydrogen catalyst' },
      createEnv({
        RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_USAGE_SCOPE_QUOTA_ENABLED: 'true',
        RESEARCH_ASSISTANT_USAGE_SCOPE_DAILY_REQUEST_LIMIT: '10',
        RATE_LIMIT_KV: {
          get: vi.fn(async (key) => key === 'assistant:usage-scope:state:user:42' ? 'paused' : null),
          put
        }
      })
    );
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, code: 'ASSISTANT_USAGE_SCOPE_PAUSED', claims: [], evidence: [] });
    expect(put.mock.calls.some(([key]) => String(key).startsWith('assistant:usage-scope:requests:'))).toBe(false);
    expect(discoverMock).not.toHaveBeenCalled();
    expect(generateClaimsMock).not.toHaveBeenCalled();
  });

  it('rejects an exhausted shared request pool before discovery or other paid Assistant work', async () => {
    discoverMock.mockClear();
    generateClaimsMock.mockClear();
    const response = await request(
      { query: 'hydrogen catalyst' },
      createEnv({
        RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
        RESEARCH_ASSISTANT_USAGE_SCOPE_QUOTA_ENABLED: 'true',
        RESEARCH_ASSISTANT_USAGE_SCOPE_DAILY_REQUEST_LIMIT: '1',
        RATE_LIMIT_KV: {
          get: vi.fn(async (key) => key.startsWith('assistant:usage-scope:requests:user:42:') ? '1' : null),
          put: vi.fn(async () => {})
        }
      })
    );
    const body = await response.json();
    expect(response.status).toBe(429);
    expect(body).toMatchObject({ ok: false, code: 'ASSISTANT_USAGE_SCOPE_QUOTA_EXHAUSTED', claims: [], evidence: [] });
    expect(discoverMock).not.toHaveBeenCalled();
    expect(generateClaimsMock).not.toHaveBeenCalled();
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
        RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
        RATE_LIMIT_KV: { get: vi.fn(async () => null), put: vi.fn(async () => {}) }
      })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      code: 'SUPPORT_CHECK_RUNTIME_PAUSED',
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
          RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS: '1',
          RATE_LIMIT_KV: { get: vi.fn(async () => null), put: vi.fn(async () => {}) }
        })
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ ok: false, code: 'SUPPORT_CHECK_RUNTIME_PAUSED', claims: [] });
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
            if (String(key).startsWith('assistant:usage-scope:state:')) return null;
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
        { ...activeEnv, RATE_LIMIT_KV: { get: vi.fn(async (key) => String(key).startsWith('assistant:usage-scope:state:') ? null : 'true'), put: vi.fn(async () => {}) } }
      )).json();

      expect(pausedBody).toMatchObject({ ok: false, code: 'SUPPORT_CHECK_RUNTIME_PAUSED', claims: [] });
      expect(pausedBody).not.toHaveProperty('evidence');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
