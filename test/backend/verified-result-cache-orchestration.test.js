import { describe, expect, it, vi } from 'vitest';
import { orchestrateResearchAnswer } from '../../backend/src/research/assistant-orchestrator.js';

function work(retrievedAt = '2026-10-01T00:00:00.000Z') {
  return {
    id: 'work-1',
    title: 'Hydrogen membrane durability and electrochemical performance study',
    authors: [{ name: 'A. Author', orcid: null }],
    publicationDate: '2026-01-01',
    publicationYear: 2026,
    type: null,
    language: 'en',
    doi: null,
    identifiers: {},
    venue: { name: 'Journal', issn: [], publisher: 'Publisher' },
    abstract: 'This study evaluates hydrogen membrane durability and electrochemical performance under controlled operating conditions. The reported measurements provide direct experimental evidence about membrane stability and performance during extended operation.',
    evidence: { level: 'ABSTRACT', sources: [{ kind: 'abstract', provider: 'test', sourceRef: 'ref-1', retrievedAt }] },
    openAccess: { isOa: null, status: null, url: null, source: null },
    licenses: [],
    citations: { preferredCount: null, preferredSource: null, observations: [] },
    urls: { doi: null, publisher: null, openAccess: null },
    flags: { retracted: null },
    provenance: [{ provider: 'test', providerId: 'work-1', retrievedAt }]
  };
}

function kv() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) ?? null),
    put: vi.fn(async (key, value) => { store.set(key, value); })
  };
}

const cacheIdentityContext = {
  generation_model_id: 'model-1',
  generation_contract_version: 'bedrock-claims-v1',
  checker_model: 'checker',
  checker_revision: 'revision',
  checker_manifest: 'manifest',
  checker_threshold: 0.85,
  decision_contract_version: 'd023-path-b-v1',
  evidence_policy_version: 'evidence-pack-v1',
  cache_schema_version: 'verified-result-v1',
  language_policy_version: 'text-detected-en-v2',
  evidence_depth_policy_version: 'relevance-metadata-fallback-v1'
};

describe('verified-result cache orchestration', () => {
  it('reuses verification only after current discovery/evidence authorization and skips model, checker and preflight on hit', async () => {
    const RATE_LIMIT_KV = kv();
    const env = {
      ENVIRONMENT: 'staging',
      RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true',
      RESEARCH_VERIFIED_RESULT_CACHE_HMAC_SECRET: 'test-secret',
      RATE_LIMIT_KV
    };
    const generateClaims = vi.fn(async ({ evidencePack }) => ({
      claims: [{ text: 'The study reports membrane durability measurements.', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
    }));
    const supportCheck = vi.fn(async () => true);
    const firstPreflight = vi.fn(async () => ({ allowed: true }));
    const discoverFirst = vi.fn(async () => [work('2026-10-01T00:00:00.000Z')]);

    const first = await orchestrateResearchAnswer({
      query: 'hydrogen membrane durability',
      env,
      providerGate: { status: 'PASS' },
      modelAdapter: { generateClaims },
      supportCheck,
      cacheScope: 'user:7',
      cacheIdentityContext,
      beforeLiveVerification: firstPreflight,
      discover: discoverFirst,
      packOptions: { packIdFactory: () => 'pack-live' }
    });

    expect(first).toMatchObject({ ok: true, code: 'OK', verification_reused: false });
    expect(generateClaims).toHaveBeenCalledTimes(1);
    expect(supportCheck).toHaveBeenCalledTimes(1);
    expect(firstPreflight).toHaveBeenCalledTimes(1);
    expect(RATE_LIMIT_KV.put).toHaveBeenCalledTimes(1);

    generateClaims.mockClear();
    supportCheck.mockClear();
    const hitPreflight = vi.fn(async () => ({ allowed: true }));
    const discoverHit = vi.fn(async () => [work('2026-10-05T00:00:00.000Z')]);

    const hit = await orchestrateResearchAnswer({
      query: 'hydrogen membrane durability',
      env,
      providerGate: { status: 'PASS' },
      modelAdapter: { generateClaims },
      supportCheck,
      cacheScope: 'user:7',
      cacheIdentityContext,
      beforeLiveVerification: hitPreflight,
      discover: discoverHit,
      packOptions: { packIdFactory: () => 'pack-hit' }
    });

    expect(discoverHit).toHaveBeenCalledTimes(1);
    expect(hit).toMatchObject({ ok: true, code: 'OK', verification_reused: true, evidence_pack_id: 'pack-hit' });
    expect(hit.claims[0].evidence_ids).toEqual(['pack-hit:e1']);
    expect(hit.evidence[0].evidence_id).toBe('pack-hit:e1');
    expect(generateClaims).not.toHaveBeenCalled();
    expect(supportCheck).not.toHaveBeenCalled();
    expect(hitPreflight).not.toHaveBeenCalled();
  });

  it('misses across user scopes and runs preflight before model generation', async () => {
    const RATE_LIMIT_KV = kv();
    const env = { ENVIRONMENT: 'staging', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true', RESEARCH_VERIFIED_RESULT_CACHE_HMAC_SECRET: 'test-secret', RATE_LIMIT_KV };
    const order = [];
    const generateClaims = vi.fn(async ({ evidencePack }) => {
      order.push('model');
      return { claims: [{ text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }] };
    });
    const beforeLiveVerification = vi.fn(async () => { order.push('preflight'); return { allowed: true }; });

    await orchestrateResearchAnswer({
      query: 'hydrogen membrane durability', env, providerGate: { status: 'PASS' },
      modelAdapter: { generateClaims }, supportCheck: async () => true,
      cacheScope: 'user:8', cacheIdentityContext, beforeLiveVerification,
      discover: vi.fn(async () => [work()]), packOptions: { packIdFactory: () => 'pack-user-8' }
    });

    expect(order.slice(0, 2)).toEqual(['preflight', 'model']);
  });

  it('fails before model spend when live-verification preflight is unavailable', async () => {
    const generateClaims = vi.fn();
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membrane durability',
      env: {},
      providerGate: { status: 'PASS' },
      modelAdapter: { generateClaims },
      supportCheck: async () => true,
      beforeLiveVerification: async () => ({ allowed: false, reason: 'INVOCATION_BUDGET_EXHAUSTED' }),
      discover: vi.fn(async () => [work()]),
      packOptions: { packIdFactory: () => 'pack-denied' }
    });
    expect(result).toMatchObject({ ok: false, code: 'INVOCATION_BUDGET_EXHAUSTED', claims: [] });
    expect(generateClaims).not.toHaveBeenCalled();
  });
});
