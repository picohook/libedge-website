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
});
