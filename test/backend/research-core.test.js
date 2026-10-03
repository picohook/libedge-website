import { describe, expect, it } from 'vitest';
import { normalizeDoi, reconstructOpenAlexAbstract, stripCrossrefMarkup } from '../../backend/src/research/normalize.js';
import { normalizeOpenAlexWork, extractOpenAlexTelemetry } from '../../backend/src/research/providers/openalex.js';
import { normalizeCrossrefMessage } from '../../backend/src/research/providers/crossref.js';
import { deduplicateResearchWorks, mergeCrossrefEnrichment } from '../../backend/src/research/deduplicate.js';
import { canonicalParentDoiForSupplementaryWork, canonicalResearchWorks, isSupplementaryMaterialWork, needsCrossrefEnrichment, selectCrossrefEnrichmentCandidates } from '../../backend/src/research/policy.js';
import { parseResearchWork } from '../../backend/src/research/research-work.js';
import { recoverCanonicalParentWorks, selectAssistantCandidates } from '../../backend/src/research/discover.js';

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

describe('canonical research evidence policy', () => {
  it('rejects ACS Supporting Information DOI records without rejecting the parent article', () => {
    expect(isSupplementaryMaterialWork({ doi: '10.1021/acs.macromol.7b00401.s001', type: 'article' })).toBe(true);
    expect(isSupplementaryMaterialWork({ doi: '10.1021/acs.macromol.7b00401', type: 'article' })).toBe(false);
    expect(canonicalParentDoiForSupplementaryWork({ doi: '10.1021/acs.macromol.7b00401.s001' })).toBe('10.1021/acs.macromol.7b00401');
    expect(canonicalParentDoiForSupplementaryWork({ doi: '10.1000/example.s001' })).toBeNull();
  });

  it('rejects provider-declared supplementary records and retains canonical article records', () => {
    const works = [
      { id: 'supp', doi: '10.1000/supp', type: 'supplementary-material' },
      { id: 'article', doi: '10.1000/article', type: 'journal-article' }
    ];
    expect(canonicalResearchWorks(works).map((work) => work.id)).toEqual(['article']);
  });
});

describe('canonical parent recovery', () => {
  const supplementary = {
    id: 'supp',
    doi: '10.1021/acs.macromol.7b00401.s001',
    type: 'article',
    title: 'Supporting record'
  };
  const parentNormalized = {
    doi: '10.1021/acs.macromol.7b00401',
    title: 'Canonical article',
    authors: [{ name: 'A. Author', orcid: null }],
    publicationDate: '2017-01-01',
    publicationYear: 2017,
    type: 'journal-article',
    language: 'en',
    identifiers: { doi: '10.1021/acs.macromol.7b00401' },
    venue: { name: 'Macromolecules', issn: [], publisher: 'ACS' },
    abstract: 'Canonical abstract.',
    evidenceSource: { kind: 'abstract', provider: 'crossref', sourceRef: '10.1021/acs.macromol.7b00401', retrievedAt: '2026-10-03T00:00:00.000Z' },
    licenses: [],
    citationObservation: null,
    urls: { doi: 'https://doi.org/10.1021/acs.macromol.7b00401', publisher: null },
    provenance: { provider: 'crossref', providerId: '10.1021/acs.macromol.7b00401', retrievedAt: '2026-10-03T00:00:00.000Z' }
  };

  it('replaces an ACS supplementary hit with the fetched canonical parent', async () => {
    const calls = [];
    const results = await recoverCanonicalParentWorks([supplementary], {}, {
      fetchByDoi: async (doi) => { calls.push(doi); return parentNormalized; }
    });
    expect(calls).toEqual(['10.1021/acs.macromol.7b00401']);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ doi: '10.1021/acs.macromol.7b00401', publicationYear: 2017 });
    expect(results[0].doi).not.toMatch(/\.s\d+$/);
  });

  it('stays fail-closed when canonical parent recovery misses', async () => {
    const results = await recoverCanonicalParentWorks([supplementary], {}, { fetchByDoi: async () => null });
    expect(results).toEqual([]);
  });

  it('does not refetch a parent already present and preserves normal records', async () => {
    const parent = { ...supplementary, id: 'parent', doi: '10.1021/acs.macromol.7b00401', type: 'journal-article' };
    let calls = 0;
    const results = await recoverCanonicalParentWorks([supplementary, parent], {}, {
      fetchByDoi: async () => { calls += 1; return parentNormalized; }
    });
    expect(calls).toBe(0);
    expect(results).toEqual([parent]);
  });
});


describe('Assistant bounded candidate selection', () => {
  const candidate = (id, title, abstract = null, language = 'en') => ({ id, title, abstract, language });

  it('selects the final target from the full eligible candidate pool', () => {
    const pool = [
      candidate('weak-1', 'Unrelated polymer processing'),
      candidate('weak-2', 'General membrane fabrication'),
      candidate('strong-11', 'Alkaline stability anion exchange membranes degradation mechanisms', 'Evidence-rich abstract.')
    ];
    const selection = selectAssistantCandidates('alkaline stability anion exchange membranes', pool, 1);
    expect(selection.selected.map((work) => work.id)).toEqual(['strong-11']);
    expect(selection.diagnostics).toEqual({
      retrievedCount: 3,
      relevantCount: 1,
      languageEligibleCount: 3,
      authorizedRelevantCount: 1
    });
  });

  it('never promotes a weaker-relevance abstract merely because evidence depth is higher', () => {
    const strongerMetadata = candidate('strong', 'Alkaline stability anion exchange membranes', null);
    const weakerAbstract = candidate('weak', 'Alkaline stability membranes', 'Has an abstract.');
    const selection = selectAssistantCandidates(
      'alkaline stability anion exchange membranes',
      [strongerMetadata, weakerAbstract],
      2
    );
    expect(selection.selected.map((work) => work.id)).toEqual(['strong', 'weak']);
  });

  it('uses abstract availability only as a tie-break at equal relevance', () => {
    const metadata = candidate('metadata', 'Hydrogen membranes', null);
    const abstract = candidate('abstract', 'Hydrogen membranes', 'Evidence text.');
    const selection = selectAssistantCandidates('hydrogen membranes', [metadata, abstract], 2);
    expect(selection.selected.map((work) => work.id)).toEqual(['abstract', 'metadata']);
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
