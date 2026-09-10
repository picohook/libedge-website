import { normalizedFingerprintPart } from './normalize.js';
import { parseResearchWork } from './research-work.js';

export function researchWorkFingerprint(work) {
  const firstAuthor = work?.authors?.[0]?.name || '';
  return [
    normalizedFingerprintPart(work?.title),
    String(work?.publicationYear || ''),
    normalizedFingerprintPart(firstAuthor)
  ].join('|');
}

export function deduplicateResearchWorks(works) {
  if (!Array.isArray(works)) return [];
  const result = [];
  const doiIndex = new Map();
  const providerIdIndex = new Set();
  const fingerprintIndex = new Map();

  for (const work of works) {
    if (!work) continue;
    if (work.doi) {
      if (doiIndex.has(work.doi)) continue;
      doiIndex.set(work.doi, result.length);
      result.push(work);
      continue;
    }

    const providerKey = work.provenance?.[0]?.provider && work.provenance?.[0]?.providerId
      ? `${work.provenance[0].provider}:${work.provenance[0].providerId}`
      : null;
    if (providerKey && providerIdIndex.has(providerKey)) continue;
    if (providerKey) providerIdIndex.add(providerKey);

    const fingerprint = researchWorkFingerprint(work);
    const isHighConfidence = Boolean(
      normalizedFingerprintPart(work.title)
      && work.publicationYear
      && normalizedFingerprintPart(work.authors?.[0]?.name)
    );
    if (isHighConfidence && fingerprintIndex.has(fingerprint)) continue;
    if (isHighConfidence) fingerprintIndex.set(fingerprint, result.length);
    result.push(work);
  }

  return result;
}

function mergeUniqueStrings(a = [], b = []) {
  return [...new Set([...a, ...b].filter(Boolean))];
}

export function mergeCrossrefEnrichment(work, enrichment) {
  if (!work || !enrichment || !work.doi || work.doi !== enrichment.doi) return work;

  const identifiers = { ...work.identifiers, ...enrichment.identifiers, doi: work.doi };
  const abstract = work.abstract || enrichment.abstract || null;
  const evidenceSources = [...work.evidence.sources];
  if (enrichment.evidenceSource) {
    const duplicate = evidenceSources.some((source) => source.provider === enrichment.evidenceSource.provider
      && source.kind === enrichment.evidenceSource.kind
      && source.sourceRef === enrichment.evidenceSource.sourceRef);
    if (!duplicate) evidenceSources.push(enrichment.evidenceSource);
  }

  const citations = [...work.citations.observations];
  if (enrichment.citationObservation) {
    const exists = citations.some((item) => item.source === enrichment.citationObservation.source);
    if (!exists) citations.push(enrichment.citationObservation);
  }

  const licenses = [...work.licenses];
  for (const license of enrichment.licenses || []) {
    const duplicate = licenses.some((item) => item.source === license.source && item.url === license.url && item.appliesTo === license.appliesTo);
    if (!duplicate) licenses.push(license);
  }

  const merged = {
    ...work,
    title: work.title || enrichment.title,
    authors: work.authors.length ? work.authors : enrichment.authors,
    publicationDate: work.publicationDate || enrichment.publicationDate,
    publicationYear: work.publicationYear || enrichment.publicationYear,
    type: work.type || enrichment.type,
    language: work.language || enrichment.language,
    identifiers,
    venue: {
      name: work.venue.name || enrichment.venue.name,
      issn: mergeUniqueStrings(work.venue.issn, enrichment.venue.issn),
      publisher: work.venue.publisher || enrichment.venue.publisher
    },
    abstract,
    evidence: {
      level: abstract ? 'ABSTRACT' : work.evidence.level,
      sources: evidenceSources
    },
    licenses,
    citations: {
      ...work.citations,
      observations: citations
    },
    urls: {
      ...work.urls,
      doi: work.urls.doi || enrichment.urls?.doi || null,
      publisher: work.urls.publisher || enrichment.urls?.publisher || null
    },
    provenance: [...work.provenance, enrichment.provenance]
  };

  return parseResearchWork(merged);
}
