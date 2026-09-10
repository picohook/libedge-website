import { describe, expect, it } from 'vitest';
import { normalizeDoi, reconstructOpenAlexAbstract, stripCrossrefMarkup } from '../../backend/src/research/normalize.js';
import { normalizeOpenAlexWork, extractOpenAlexTelemetry } from '../../backend/src/research/providers/openalex.js';
import { normalizeCrossrefMessage } from '../../backend/src/research/providers/crossref.js';
import { deduplicateResearchWorks, mergeCrossrefEnrichment } from '../../backend/src/research/deduplicate.js';
import { needsCrossrefEnrichment, selectCrossrefEnrichmentCandidates } from '../../backend/src/research/policy.js';
import { parseResearchWork } from '../../backend/src/research/research-work.js';

describe('research normalization', () => {
  it('normalizes DOI variants to a canonical lowercase DOI', () => {
    expect(normalizeDoi('DOI: 10.1038/ABC123')).toBe('10.1038/abc123');
    expect(normalizeDoi('https://doi.org/10.1038/ABC123')).toBe('10.1038/abc123');
    expect(normalizeDoi('http://dx.doi.org/10.1038/ABC123')).toBe('10.1038/abc123');
  });

  it('reconstructs OpenAlex inverted abstracts by token position', () => {
    expect(reconstructOpenAlexAbstract({ electrolysis: [2], PEM: [0], water: [1] }))
      .toBe('PEM water electrolysis');
  });

  it('strips Crossref JATS markup to plaintext', () => {
    expect(stripCrossrefMarkup('<jats:p>PEM &amp; water <jats:bold>electrolysis</jats:bold>.</jats:p>'))
      .toBe('PEM & water electrolysis .');
  });
});

describe('ResearchWork schema', () => {
  it('supports future FULL_TEXT evidence and extensible identifiers', () => {
    const work = normalizeOpenAlexWork({
      id: 'https://openalex.org/W1',
      title: 'Example work',
      doi: 'https://doi.org/10.1000/example',
      publication_year: 2026,
      ids: { pmcid: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123/' },
      authorships: [],
      cited_by_count: 0,
      open_access: { is_oa: true, oa_status: 'gold' },
      primary_location: { source: { display_name: 'Journal' } }
    }, '2026-09-10T00:00:00.000Z');

    const future = {
      ...work,
      identifiers: { ...work.identifiers, arxiv: '2609.00001' },
      evidence: {
        level: 'FULL_TEXT',
        sources: [{ kind: 'full_text', provider: 'pmc', sourceRef: 'PMC123', retrievedAt: '2026-09-10T00:00:00.000Z' }]
      }
    };
    expect(parseResearchWork(future).identifiers.pmcid).toBe('PMC123');
    expect(parseResearchWork(future).identifiers.arxiv).toBe('2609.00001');
  });
});

describe('Crossref enrichment policy', () => {
  const base = {
    doi: '10.1000/example',
    abstract: null,
    licenses: []
  };

  it('requires DOI and prioritizes abstract gaps by default', () => {
    expect(needsCrossrefEnrichment(base)).toBe(true);
    expect(needsCrossrefEnrichment({ ...base, doi: null })).toBe(false);
    expect(needsCrossrefEnrichment({ ...base, abstract: 'Present', licenses: [] })).toBe(false);
    expect(needsCrossrefEnrichment({ ...base, abstract: 'Present', licenses: [] }, { requireLicense: true })).toBe(true);
  });

  it('caps enrichment candidates, deduplicates DOI requests, and gives abstract-missing works priority', () => {
    const works = [
      { ...base, id: 'license-only', abstract: 'Present', doi: '10.1000/license' },
      { ...base, id: 'abstract-gap', doi: '10.1000/abstract' },
      { ...base, id: 'duplicate', doi: '10.1000/abstract' }
    ];
    expect(selectCrossrefEnrichmentCandidates(works, { max: 2, requireLicense: true }).map((work) => work.id))
      .toEqual(['abstract-gap', 'license-only']);
  });
});

describe('provider normalization and merge', () => {
  it('keeps citation counts as separate provider observations', () => {
    const openAlex = normalizeOpenAlexWork({
      id: 'https://openalex.org/W42',
      title: 'Shared DOI work',
      doi: 'https://doi.org/10.1000/shared',
      publication_year: 2026,
      authorships: [],
      cited_by_count: 127,
      open_access: { is_oa: null },
      primary_location: { source: { display_name: 'Journal' } }
    }, '2026-09-10T00:00:00.000Z');

    const crossref = normalizeCrossrefMessage({
      DOI: '10.1000/shared',
      title: ['Shared DOI work'],
      'is-referenced-by-count': 103,
      abstract: '<jats:p>Crossref abstract.</jats:p>',
      license: [{ URL: 'https://creativecommons.org/licenses/by/4.0/', 'content-version': 'vor' }]
    }, '2026-09-10T00:01:00.000Z');

    const merged = mergeCrossrefEnrichment(openAlex, crossref);
    expect(merged.citations.preferredCount).toBe(127);
    expect(merged.citations.preferredSource).toBe('openalex');
    expect(merged.citations.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'openalex', count: 127 }),
      expect.objectContaining({ source: 'crossref', count: 103 })
    ]));
    expect(merged.abstract).toBe('Crossref abstract.');
    expect(merged.evidence.level).toBe('ABSTRACT');
  });

  it('does not deduplicate different DOI works even with matching titles', () => {
    const make = (doi) => normalizeOpenAlexWork({
      id: `https://openalex.org/${doi}`,
      title: 'Nearly identical title',
      doi: `https://doi.org/${doi}`,
      publication_year: 2026,
      authorships: [],
      open_access: {}
    });
    expect(deduplicateResearchWorks([make('10.1000/a'), make('10.1000/b')])).toHaveLength(2);
  });
});

describe('OpenAlex telemetry compatibility', () => {
  it('accepts both documented header naming families', () => {
    const response = new Response('{}', {
      headers: {
        'X-RateLimit-Limit-USD': '1',
        'X-RateLimit-Remaining-USD': '0.9',
        'X-RateLimit-Cost-USD': '0.001'
      }
    });
    expect(extractOpenAlexTelemetry(response, { meta: {} })).toMatchObject({
      limit: 1,
      remaining: 0.9,
      requestCostUsd: 0.001
    });
  });
});
