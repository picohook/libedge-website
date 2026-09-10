export const DEFAULT_CROSSREF_MAX_ENRICHMENTS = 10;

export function hasUsefulAbstract(work) {
  return typeof work?.abstract === 'string' && work.abstract.trim().length > 0;
}

export function hasLicenseObservation(work) {
  return Array.isArray(work?.licenses) && work.licenses.length > 0;
}

export function needsCrossrefEnrichment(work, options = {}) {
  if (!work?.doi) return false;

  const requireAbstract = options.requireAbstract !== false;
  const requireLicense = options.requireLicense === true;

  if (requireAbstract && !hasUsefulAbstract(work)) return true;
  if (requireLicense && !hasLicenseObservation(work)) return true;

  return false;
}

export function selectCrossrefEnrichmentCandidates(works, options = {}) {
  const max = Number.isFinite(options.max)
    ? Math.max(0, Math.floor(options.max))
    : DEFAULT_CROSSREF_MAX_ENRICHMENTS;

  if (!Array.isArray(works) || max === 0) return [];

  const selected = [];
  const seenDois = new Set();
  const candidates = works
    .filter((work) => work?.doi)
    .map((work, index) => ({
      work,
      index,
      missingAbstract: !hasUsefulAbstract(work),
      missingLicense: !hasLicenseObservation(work)
    }))
    .filter(({ work }) => needsCrossrefEnrichment(work, options))
    .sort((a, b) => Number(b.missingAbstract) - Number(a.missingAbstract) || a.index - b.index);

  for (const candidate of candidates) {
    const doi = String(candidate.work.doi || '').trim().toLowerCase();
    if (!doi || seenDois.has(doi)) continue;
    seenDois.add(doi);
    selected.push(candidate.work);
    if (selected.length >= max) break;
  }

  return selected;
}
