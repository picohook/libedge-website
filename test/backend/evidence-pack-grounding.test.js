import { describe, expect, it } from 'vitest';
import { createEvidencePack } from '../../backend/src/research/evidence-pack.js';
import { validateGroundedClaims } from '../../backend/src/research/grounding-validator.js';
import { normalizeOpenAlexWork } from '../../backend/src/research/providers/openalex.js';

function makeWork(id = 'W1') {
  return normalizeOpenAlexWork({
    id: `https://openalex.org/${id}`,
    title: 'PEM water electrolysis study',
    doi: 'https://doi.org/10.1000/example',
    publication_year: 2026,
    authorships: [{ author: { display_name: 'Ada Example', orcid: null } }],
    cited_by_count: 3,
    abstract_inverted_index: { PEM: [0], water: [1], electrolysis: [2] },
    open_access: { is_oa: true, oa_status: 'gold' },
    primary_location: { source: { display_name: 'Journal' } }
  }, '2026-09-13T00:00:00.000Z');
}

describe('EvidencePack', () => {
  it('assigns pack-local evidence IDs distinct from bibliographic work IDs', () => {
    const work = makeWork();
    const pack = createEvidencePack([work], { packIdFactory: () => 'pack-1' });

    expect(pack.pack_id).toBe('pack-1');
    expect(pack.evidence[0].work_id).toBe(work.id);
    expect(pack.evidence[0].evidence_id).toBe('pack-1:e1');
    expect(pack.evidence[0].evidence_id).not.toBe(work.id);
  });

  it('creates an immutable, data-minimized evidence snapshot', () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-2' });

    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(pack.evidence[0])).toBe(true);
    expect(pack).not.toHaveProperty('query');
    expect(pack).not.toHaveProperty('user');
    expect(pack).not.toHaveProperty('email');
    expect(pack.evidence[0]).not.toHaveProperty('citations');
    expect(pack.evidence[0]).not.toHaveProperty('openAccess');
  });
});


describe('grounding validator', () => {
  it('fails closed when no semantic support checker is supplied', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-3' });
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims: [{ text: 'PEM water electrolysis is discussed.', evidence_ids: ['pack-3:e1'] }]
    });

    expect(result.ok).toBe(false);
    expect(result.acceptedClaims).toHaveLength(0);
    expect(result.rejectedClaims[0].code).toBe('SUPPORT_CHECK_REQUIRED');
  });

  it('rejects claims with missing or unknown evidence IDs before semantic checking', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-4' });
    const supportCheck = () => true;
    const result = await validateGroundedClaims({
      evidencePack: pack,
      supportCheck,
      claims: [
        { text: 'No citation.', evidence_ids: [] },
        { text: 'Unknown citation.', evidence_ids: ['pack-4:e99'] }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.rejectedClaims.map((claim) => claim.code)).toEqual([
      'EVIDENCE_ID_REQUIRED',
      'EVIDENCE_ID_UNKNOWN'
    ]);
  });

  it('accepts a claim only when its cited pack evidence passes semantic support checking', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-5' });
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims: [{ text: 'The evidence concerns PEM water electrolysis.', evidence_ids: ['pack-5:e1'] }],
      supportCheck: (claim, evidence) => ({
        supported: claim.text.includes('PEM') && evidence[0].abstract.includes('PEM'),
        reason: 'ABSTRACT_SUPPORT'
      })
    });

    expect(result.ok).toBe(true);
    expect(result.acceptedClaims).toHaveLength(1);
    expect(result.rejectedClaims).toHaveLength(0);
  });

  it('rejects semantically unsupported claims even when citation IDs are valid', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-6' });
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims: [{ text: 'The study proves a 50% efficiency gain.', evidence_ids: ['pack-6:e1'] }],
      supportCheck: () => ({ supported: false, reason: 'NOT_IN_EVIDENCE' })
    });

    expect(result.ok).toBe(false);
    expect(result.rejectedClaims[0]).toMatchObject({ code: 'CLAIM_UNSUPPORTED', reason: 'NOT_IN_EVIDENCE' });
  });
  it('classifies support-check exceptions without exposing raw error text', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-failure-reason' });
    const timeoutError = new Error('request aborted after secret provider detail');
    timeoutError.name = 'AbortError';
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims: [{ text: 'Claim', evidence_ids: ['pack-failure-reason:e1'] }],
      supportCheck: async () => { throw timeoutError; }
    });

    expect(result.ok).toBe(false);
    expect(result.rejectedClaims[0]).toMatchObject({ code: 'SUPPORT_CHECK_FAILED', reason: 'TIMEOUT' });

    for (const [name, reason] of [
      ['ModelError', 'TRANSPORT_MODEL_ERROR'],
      ['ServiceUnavailable', 'TRANSPORT_SERVICE_UNAVAILABLE'],
      ['InternalFailure', 'TRANSPORT_SERVICE_UNAVAILABLE'],
      ['InternalDependencyException', 'TRANSPORT_SERVICE_UNAVAILABLE'],
      ['ModelNotReadyException', 'TRANSPORT_MODEL_NOT_READY'],
      ['ValidationError', 'TRANSPORT_VALIDATION'],
      ['ModelStreamError', 'TRANSPORT_STREAM_ERROR'],
      ['InternalStreamFailure', 'TRANSPORT_STREAM_ERROR']
    ]) {
      const sdkError = Object.assign(new Error('provider detail'), { name });
      const classified = await validateGroundedClaims({
        claims: [{ text: 'Claim', evidence_ids: ['pack-failure-reason:e1'] }],
        evidencePack: pack,
        supportCheck: async () => { throw sdkError; }
      });
      expect(classified.rejectedClaims[0]).toMatchObject({ code: 'SUPPORT_CHECK_FAILED', reason });
    }
    expect(JSON.stringify(result)).not.toContain('secret provider detail');
  });

  it('classifies real invocation budget errors as BUDGET', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-budget-reason' });
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims: [{ text: 'Claim', evidence_ids: ['pack-budget-reason:e1'] }],
      supportCheck: async () => { throw new Error('INVOCATION_BUDGET_EXHAUSTED'); }
    });

    expect(result.ok).toBe(false);
    expect(result.rejectedClaims[0]).toMatchObject({ code: 'SUPPORT_CHECK_FAILED', reason: 'BUDGET' });
  });

  it('bounds semantic support checks to two concurrent calls while preserving claim order', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-concurrency' });
    let active = 0;
    let maxActive = 0;
    const calls = [];
    const claims = Array.from({ length: 5 }, (_, index) => ({
      text: `Claim ${index}`,
      evidence_ids: ['pack-concurrency:e1']
    }));

    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims,
      supportCheck: async (claim) => {
        calls.push(claim.index);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, claim.index % 2 === 0 ? 8 : 2));
        active -= 1;
        return true;
      }
    });

    expect(result.ok).toBe(false);
    expect(maxActive).toBe(2);
    expect(calls.sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(result.acceptedClaims.map((claim) => claim.index)).toEqual([0, 1, 2, 3]);
    expect(result.rejectedClaims[0]).toMatchObject({ index: 4, code: 'SUPPORT_CHECK_BUDGET_TRUNCATED' });
  });

  it('hard-caps semantic checks per request and rejects unchecked claims deterministically', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-request-cap' });
    let calls = 0;
    const claims = Array.from({ length: 6 }, (_, index) => ({
      text: `Claim ${index}`,
      evidence_ids: ['pack-request-cap:e1']
    }));

    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims,
      maxSupportChecks: 4,
      supportCheck: async () => {
        calls += 1;
        return true;
      }
    });

    expect(calls).toBe(4);
    expect(result.acceptedClaims.map((claim) => claim.index)).toEqual([0, 1, 2, 3]);
    expect(result.rejectedClaims.slice(-2).map((claim) => claim.code)).toEqual([
      'SUPPORT_CHECK_BUDGET_TRUNCATED',
      'SUPPORT_CHECK_BUDGET_TRUNCATED'
    ]);
    expect(result.diagnostics).toEqual({
      eligible_count: 6,
      checked_count: 4,
      truncated_count: 2,
      support_check_limit: 4,
      support_check_ms: expect.any(Number)
    });
  });

  it('does not allow configuration to raise the hard request cap above four', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-hard-cap' });
    let calls = 0;
    const claims = Array.from({ length: 7 }, (_, index) => ({
      text: `Claim ${index}`,
      evidence_ids: ['pack-hard-cap:e1']
    }));
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims,
      maxSupportChecks: 99,
      supportCheck: async () => {
        calls += 1;
        return true;
      }
    });

    expect(calls).toBe(4);
    expect(result.acceptedClaims).toHaveLength(4);
    expect(result.diagnostics).toMatchObject({ checked_count: 4, truncated_count: 3, support_check_limit: 4 });
  });

  it('runs no semantic check for structurally ineligible claims', async () => {
    const pack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-structural-first' });
    let calls = 0;
    const result = await validateGroundedClaims({
      evidencePack: pack,
      claims: [
        { text: '', evidence_ids: ['pack-structural-first:e1'] },
        { text: 'No citation', evidence_ids: [] },
        { text: 'Eligible', evidence_ids: ['pack-structural-first:e1'] }
      ],
      supportCheck: async () => {
        calls += 1;
        return true;
      }
    });

    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.acceptedClaims.map((claim) => claim.index)).toEqual([2]);
    expect(result.rejectedClaims.map((claim) => claim.index)).toEqual([0, 1]);
  });


  it('preserves evidence-side language rejection through grounding validation', async () => {
    const evidencePack = createEvidencePack([makeWork()], { packIdFactory: () => 'pack-language-evidence' });
    const evidenceId = evidencePack.evidence[0].evidence_id;
    const result = await validateGroundedClaims({
      claims: [{ text: 'Claim text.', evidence_ids: [evidenceId] }],
      evidencePack,
      supportCheck: async () => { throw new Error('SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED_EVIDENCE'); }
    });
    expect(result.rejectedClaims[0]).toMatchObject({ code: 'SUPPORT_CHECK_FAILED', reason: 'LANGUAGE_EVIDENCE' });
  });
});
