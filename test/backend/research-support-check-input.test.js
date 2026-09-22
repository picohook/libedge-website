import { describe, expect, it } from 'vitest';
import { buildSupportCheckInput, buildSupportCheckInputs } from '../../backend/src/research/support-check-input.js';

function work() {
  return {
    id: 'doi:10.1000/example',
    title: 'Example work',
    authors: [{ name: 'A. Author', orcid: null }],
    publicationDate: '2026-01-01',
    publicationYear: 2026,
    type: 'article',
    language: 'en',
    doi: '10.1000/example',
    identifiers: { doi: '10.1000/example' },
    venue: { name: 'Journal', issn: [], publisher: null },
    abstract: 'Evidence text.',
    evidence: {
      level: 'ABSTRACT',
      sources: [{ kind: 'abstract', provider: 'openalex', sourceRef: 'W1', retrievedAt: '2026-09-22T00:00:00Z' }]
    },
    openAccess: { isOa: null, status: null, url: null, source: null },
    licenses: [],
    citations: { preferredCount: null, preferredSource: null, observations: [] },
    urls: { doi: 'https://doi.org/10.1000/example', publisher: null, openAccess: null },
    flags: { retracted: false },
    provenance: [{ provider: 'openalex', providerId: 'W1', retrievedAt: '2026-09-22T00:00:00Z' }]
  };
}

describe('support-check input adapter', () => {
  it('preserves evidence and provenance without retrieval metadata', () => {
    const input = buildSupportCheckInput(work());

    expect(input).toEqual({
      version: 'v1',
      workId: 'doi:10.1000/example',
      title: 'Example work',
      abstract: 'Evidence text.',
      evidence: {
        level: 'ABSTRACT',
        sources: [{ kind: 'abstract', provider: 'openalex', sourceRef: 'W1', retrievedAt: '2026-09-22T00:00:00Z' }]
      },
      provenance: [{ provider: 'openalex', providerId: 'W1', retrievedAt: '2026-09-22T00:00:00Z' }]
    });
    expect(input).not.toHaveProperty('retrievalSource');
    expect(input).not.toHaveProperty('rank');
  });

  it('validates ResearchWork before building the envelope', () => {
    const invalid = work();
    invalid.identifiers.doi = '10.1000/different';
    expect(() => buildSupportCheckInput(invalid)).toThrow();
  });

  it('maps batches deterministically and treats non-arrays as empty', () => {
    const first = work();
    const second = { ...work(), id: 'openalex:W2', doi: null, identifiers: {}, title: 'Second work' };
    expect(buildSupportCheckInputs([first, second]).map((item) => item.workId))
      .toEqual(['doi:10.1000/example', 'openalex:W2']);
    expect(buildSupportCheckInputs(null)).toEqual([]);
  });
});
