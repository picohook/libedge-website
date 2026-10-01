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
    language: null,
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

  it('returns no render-ready claims if even one claim fails grounding', async () => {
    const result = await orchestrateResearchAnswer({
      query: 'hydrogen membranes',
      env: {},
      providerGate: passGate,
      modelAdapter: {
        generateClaims: async ({ evidencePack }) => ({
          claims: [
            { text: 'Supported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] },
            { text: 'Unsupported claim', evidence_ids: [evidencePack.evidence[0].evidence_id] }
          ]
        })
      },
      discover: discoverStub(),
      supportCheck: (claim) => claim.text === 'Supported claim',
      packOptions
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('GROUNDING_REJECTED');
    expect(result.claims).toEqual([]);
    expect(result).not.toHaveProperty('rejected_claims');
    expect(result).not.toHaveProperty('evidence');
    expect(result.diagnostic_grounding).toEqual({
      rejected_count: 1,
      rejection_counts: { CLAIM_UNSUPPORTED: 1, CLAIM_UNSUPPORTED_UNSUPPORTED: 1 }
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
    expect(result.diagnostic_grounding).toEqual({
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
});
