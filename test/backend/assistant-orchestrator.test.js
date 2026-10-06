import { describe, expect, it, vi } from 'vitest';
import { orchestrateResearchAnswer } from '../../backend/src/research/assistant-orchestrator.js';

function work() {
  return {
    id: 'work-1',
    title: 'Hydrogen membranes research',
    authors: [],
    publicationDate: null,
    publicationYear: 2026,
    type: null,
    language: 'en',
    doi: null,
    identifiers: {},
    venue: { name: null, issn: [], publisher: null },
    abstract: 'Evidence text.',
    evidence: {
      level: 'ABSTRACT',
      sources: [{ kind: 'abstract', provider: 'test', sourceRef: 'ref-1', retrievedAt: '2026-09-13T00:00:00.000Z' }]
    },
    openAccess: { isOa: null, status: null, url: null, source: null },
    licenses: [],
    citations: { preferredCount: null, preferredSource: null, observations: [] },
    urls: { doi: null, publisher: null, openAccess: null },
    flags: { retracted: null },
    provenance: [{ provider: 'test', providerId: 'work-1', retrievedAt: '2026-09-13T00:00:00.000Z' }]
  };
}

const passGate = { status: 'PASS' };
const packOptions = { packIdFactory: () => 'pack-1' };

function discoverStub() {
  return vi.fn(async () => [work()]);
}

describe('assistant orchestration boundary', () => {
  it('returns a distinct valid-empty outcome before model/checker when no evidence is language-authorized', async () => {
    const generateClaims = vi.fn();
    const result = await orchestrateResearchAnswer({
      query: 'alkaline stability anion exchange membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: { generateClaims },
      discover: vi.fn(async () => [{ ...work(), language: null, title: 'Short technical title', abstract: null }]),
      supportCheck: vi.fn(),
      packOptions
    });

    expect(result).toMatchObject({ ok: true, code: 'NO_AUTHORIZED_EVIDENCE', claims: [], evidence: [] });
    expect(generateClaims).not.toHaveBeenCalled();
    expect(result.diagnostic_retrieval).toEqual({
      retrieval_mode: 'unknown',
      candidate_depth: 1,
      retrieved_count: 1,
      relevant_count: 0,
      language_eligible_count: 0,
      authorized_relevant_count: 0,
      abstract_bearing_count: 0,
      metadata_only_count: 0
    });
  });

  it('preserves relevance ordering while retaining metadata-only fallback', async () => {
    const metadataOnly = { ...work(), id: 'metadata', title: 'Hydrogen membranes metadata', abstract: null, evidence: {
      level: 'METADATA_ONLY',
      sources: [{ kind: 'metadata', provider: 'test', sourceRef: 'metadata', retrievedAt: '2026-09-13T00:00:00.000Z' }]
    }};
    const withAbstract = { ...work(), id: 'abstract', title: 'Hydrogen membranes abstract', abstract: 'Hydrogen membranes evidence text.' };
    const generateClaims = vi.fn(async ({ evidencePack }) => ({
      claims: [{ text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
    }));

    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: { generateClaims },
      discover: vi.fn(async () => [metadataOnly, withAbstract]),
      supportCheck: () => true,
      packOptions
    });

    const evidencePack = generateClaims.mock.calls[0][0].evidencePack;
    expect(evidencePack.evidence.map((item) => item.work_id)).toEqual(['metadata', 'abstract']);
    expect(result.diagnostic_retrieval).toMatchObject({
      authorized_relevant_count: 2,
      abstract_bearing_count: 1,
      metadata_only_count: 1
    });
  });

  it('does not send the research task to a model adapter without Provider Privacy Gate PASS', async () => {
    const discover = discoverStub();
    const generateClaims = vi.fn();

    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: { status: 'UNVERIFIED' },
      modelAdapter: { generateClaims },
      discover,
      packOptions
    });

    expect(discover).toHaveBeenCalledOnce();
    expect(generateClaims).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: 'PROVIDER_PRIVACY_GATE_REQUIRED', claims: [] });
    expect(result).not.toHaveProperty('evidence');
  });

  it('passes only the research task and EvidencePack to the provider-neutral model adapter', async () => {
    const generateClaims = vi.fn(async ({ evidencePack }) => ({
      claims: [{ text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
    }));

    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: { secretContext: 'must-not-cross' },
      providerGate: passGate,
      modelAdapter: { generateClaims },
      discover: discoverStub(),
      supportCheck: () => true,
      packOptions
    });

    const adapterInput = generateClaims.mock.calls[0][0];
    expect(Object.keys(adapterInput).sort()).toEqual(['evidencePack', 'task']);
    expect(adapterInput.task).toBe('hydrogen membranes');
    expect(adapterInput).not.toHaveProperty('env');
    expect(JSON.stringify(adapterInput)).not.toContain('must-not-cross');
    expect(result.ok).toBe(true);
  });

  it('preserves content-free stage timings when model generation fails', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error('provider failure');
        }
      },
      discover: discoverStub(),
      supportCheck: () => true,
      packOptions
    });

    expect(result).toMatchObject({ ok: false, code: 'MODEL_ADAPTER_FAILED', claims: [] });
    expect(result.diagnostic_timings).toEqual(expect.objectContaining({
      discover_ms: expect.any(Number),
      evidence_pack_ms: expect.any(Number),
      model_ms: expect.any(Number)
    }));
    expect(result.diagnostic_timings.model_ms).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(result.diagnostic_timings)).not.toContain('hydrogen membranes');
  });

  it('fails closed on malformed model output', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: { generateClaims: async () => ({ prose: 'free text only' }) },
      discover: discoverStub(),
      supportCheck: () => true,
      packOptions
    });

    expect(result).toMatchObject({ ok: false, code: 'MODEL_OUTPUT_INVALID', claims: [] });
    expect(result).not.toHaveProperty('evidence');
  });

  it('classifies an empty generated claim set as valid-empty without invoking support check', async () => {
    const supportCheck = vi.fn();
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: { generateClaims: async () => ({ claims: [] }) },
      discover: discoverStub(),
      supportCheck,
      packOptions
    });

    expect(result).toMatchObject({ ok: true, code: 'NO_SUPPORTABLE_CLAIMS', claims: [], evidence: [] });
    expect(supportCheck).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('diagnostic_grounding');
  });

  it('fails closed when semantic support checking is absent', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [{ text: 'Claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
        })
      },
      discover: discoverStub(),
      packOptions
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('GROUNDING_REJECTED');
    expect(result.claims).toEqual([]);
    expect(result).not.toHaveProperty('rejected_claims');
    expect(result).not.toHaveProperty('evidence');
  });

  it('returns supported claims when another claim is semantically unsupported', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [
            { text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] },
            { text: 'Unsupported claim', evidence_ids: [evidencePack.evidence[1].evidence_id] }
          ]
        })
      },
      discover: discoverStub(),
      packFactory: () => ({
        pack_id: 'pack-1',
        evidence: [
          { evidence_id: 'pack-1:e1', title: 'Accepted evidence' },
          { evidence_id: 'pack-1:e2', title: 'Rejected-only evidence' }
        ]
      }),
      supportCheck: (claim) => claim.text === 'Supported claim'
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.diagnostic_grounding).toMatchObject({
      accepted_count: 1,
      unique_supporting_source_count: 1,
      single_source_verified_answer: 1
    });
    expect(result.claims).toEqual([{ index: 0, text: 'Supported claim', evidence_ids: ['pack-1:e1'] }]);
    expect(result.evidence).toEqual([{ evidence_id: 'pack-1:e1', title: 'Accepted evidence' }]);
    expect(result.diagnostic_grounding).toMatchObject({
      claim_count: 2,
      accepted_count: 1,
      rejected_count: 1,
      rejection_counts: { CLAIM_UNSUPPORTED: 1, CLAIM_UNSUPPORTED_UNSUPPORTED: 1 }
    });
  });

  it.each([
    ['empty claim text', { text: '', evidence_ids: ['pack-1:e1'] }],
    ['missing evidence IDs', { text: 'Malformed claim', evidence_ids: [] }],
    ['unknown evidence ID', { text: 'Malformed claim', evidence_ids: ['pack-1:missing'] }]
  ])('drops a structurally invalid claim (%s) while preserving an independently verified claim', async (_label, malformedClaim) => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [
            { text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] },
            malformedClaim
          ]
        })
      },
      discover: discoverStub(),
      supportCheck: () => true,
      packOptions
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].text).toBe('Supported claim');
    expect(result.diagnostic_grounding.rejected_count).toBe(1);
  });

  it('fails closed when support checking is unavailable even if another claim is structurally invalid', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [
            { text: 'Would require checker', evidence_ids: [evidencePack.evidence[0].evidence_id] },
            { text: '', evidence_ids: [] }
          ]
        })
      },
      discover: discoverStub(),
      packOptions
    });

    expect(result).toMatchObject({ ok: false, code: 'GROUNDING_REJECTED', claims: [] });
    expect(result).not.toHaveProperty('evidence');
    expect(result.diagnostic_grounding.rejection_counts).toEqual({
      CLAIM_TEXT_REQUIRED: 1,
      SUPPORT_CHECK_REQUIRED: 1
    });
  });

  it('never renders unchecked budget-truncated claims or their evidence', async () => {
    const supportCheck = vi.fn(async () => true);
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: { RESEARCH_SUPPORT_CHECKS_PER_REQUEST: '2' },
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async () => ({
          claims: [
            { text: 'Verified one', evidence_ids: ['pack-cap:e1'] },
            { text: 'Verified two', evidence_ids: ['pack-cap:e2'] },
            { text: 'Unchecked three', evidence_ids: ['pack-cap:e3'] }
          ]
        })
      },
      discover: discoverStub(),
      packFactory: () => ({
        pack_id: 'pack-cap',
        evidence: [
          { evidence_id: 'pack-cap:e1', title: 'Evidence one' },
          { evidence_id: 'pack-cap:e2', title: 'Evidence two' },
          { evidence_id: 'pack-cap:e3', title: 'Unchecked-only evidence' }
        ]
      }),
      supportCheck
    });

    expect(supportCheck).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, code: 'OK' });
    expect(result.claims.map((claim) => claim.text)).toEqual(['Verified one', 'Verified two']);
    expect(result.evidence.map((item) => item.evidence_id)).toEqual(['pack-cap:e1', 'pack-cap:e2']);
    expect(JSON.stringify(result.claims)).not.toContain('Unchecked three');
    expect(JSON.stringify(result.evidence)).not.toContain('Unchecked-only evidence');
    expect(result.diagnostic_grounding).toMatchObject({
      claim_count: 3,
      accepted_count: 2,
      rejected_count: 1,
      eligible_count: 3,
      checked_count: 2,
      truncated_count: 1,
      support_check_limit: 2,
      support_check_ms: expect.any(Number),
      rejection_counts: { SUPPORT_CHECK_BUDGET_TRUNCATED: 1 }
    });
  });

  it('fails the entire response closed when semantic rejection and checker failure are mixed', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [
            { text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] },
            { text: 'Unsupported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] },
            { text: 'Checker failure claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }
          ]
        })
      },
      discover: discoverStub(),
      supportCheck: (claim) => {
        if (claim.text === 'Supported claim') return true;
        if (claim.text === 'Unsupported claim') return false;
        const error = new Error('timeout');
        error.name = 'AbortError';
        throw error;
      },
      packOptions
    });

    expect(result).toMatchObject({ ok: false, code: 'GROUNDING_REJECTED', claims: [] });
    expect(result).not.toHaveProperty('evidence');
    expect(result.diagnostic_grounding).toMatchObject({
      claim_count: 3,
      accepted_count: 1,
      rejected_count: 2,
      rejection_counts: {
        CLAIM_UNSUPPORTED: 1,
        CLAIM_UNSUPPORTED_UNSUPPORTED: 1,
        SUPPORT_CHECK_FAILED: 1,
        SUPPORT_CHECK_FAILED_TIMEOUT: 1
      }
    });
  });

  it('summarizes semantic grounding rejection without claim or evidence content', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [{ text: 'Sensitive claim text', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
        })
      },
      discover: discoverStub(),
      supportCheck: () => ({ supported: false, reason: 'NOT_SUPPORTED' }),
      packOptions
    });

    expect(result.code).toBe('GROUNDING_REJECTED');
    expect(result.diagnostic_grounding).toMatchObject({
      claim_count: 1,
      accepted_count: 0,
      rejected_count: 1,
      rejection_counts: { CLAIM_UNSUPPORTED: 1, CLAIM_UNSUPPORTED_NOT_SUPPORTED: 1 }
    });
    expect(JSON.stringify(result.diagnostic_grounding)).not.toContain('Sensitive claim text');
    expect(JSON.stringify(result.diagnostic_grounding)).not.toContain('pack-1:e1');
  });

  it('returns only grounded structured claims and minimized evidence snapshots after all gates pass', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [{ text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }]
        })
      },
      discover: discoverStub(),
      supportCheck: () => ({ supported: true }),
      packOptions
    });

    expect(result).toMatchObject({
      ok: true,
      code: 'OK',
      claims: [{ index: 0, text: 'Supported claim', evidence_ids: ['pack-1:e1'] }],
      evidence_pack_id: 'pack-1'
    });
    expect(result.diagnostic_grounding).toMatchObject({ claim_count: 1, accepted_count: 1, rejected_count: 0, rejection_counts: {} });
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({
      evidence_id: 'pack-1:e1',
      work_id: 'work-1',
      title: 'Hydrogen membranes research',
      abstract: 'Evidence text.'
    });
    expect(result.evidence[0]).not.toHaveProperty('openAccess');
    expect(result.evidence[0]).not.toHaveProperty('citations');
    expect(JSON.stringify(result.evidence)).not.toContain('hydrogen membranes');
  });
  it('uses the normalized English query for both discovery and model claim generation on Turkish input', async () => {
    const discover = vi.fn(async (query) => {
      expect(query).toBe('flexible work hours work-life balance');
      return [{
        ...work(),
        title: 'Flexible work hours and work-life balance',
        abstract: 'Flexible work arrangements are associated with work-life balance outcomes.'
      }];
    });
    const generateClaims = vi.fn(async ({ task, evidencePack }) => {
      expect(task).toBe('flexible work hours work-life balance');
      return { claims: [{ text: 'Flexible work arrangements are associated with work-life balance outcomes.', evidence_ids: [evidencePack.evidence[0].evidence_id] }] };
    });
    const result = await orchestrateResearchAnswer({
      query: 'Esnek çalışma saatlerinin iş-yaşam dengesi üzerindeki etkisi nedir?',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        normalizeQueryToEnglish: async () => ({ query: 'flexible work hours work-life balance', usage: { llm_cost_usd: 0.001 } }),
        generateClaims
      },
      discover,
      supportCheck: () => ({ supported: true }),
      packOptions
    });

    expect(discover).toHaveBeenCalledTimes(1);
    expect(generateClaims).toHaveBeenCalledTimes(1);
    expect(result.code).toBe('OK');
    expect(result.diagnostic_language).toMatchObject({
      query_language: 'tr',
      evidence_languages: ['en'],
      answer_language: 'en',
      query_normalized: true,
      query_normalization_version: 'query-en-normalization-v1'
    });
    expect(result.diagnostic_costs.normalization_cost_usd).toBe(0.001);
  });

  it('fails closed when Turkish query normalization fails and never reaches discovery or checker', async () => {
    const discover = vi.fn();
    const supportCheck = vi.fn();
    const result = await orchestrateResearchAnswer({
      query: 'Çevrimiçi eğitimin akademik katılıma etkisi nedir?',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        normalizeQueryToEnglish: async () => { throw new Error('normalization unavailable'); },
        generateClaims: vi.fn()
      },
      discover,
      supportCheck,
      packOptions
    });

    expect(result.code).toBe('QUERY_NORMALIZATION_FAILED');
    expect(discover).not.toHaveBeenCalled();
    expect(supportCheck).not.toHaveBeenCalled();
  });

});
