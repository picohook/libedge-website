import { doiUrl, normalizeDoi, normalizeOrcid, normalizeTitle, stripCrossrefMarkup } from '../normalize.js';
import { parseResearchWork } from '../research-work.js';

const CROSSREF_BASE = 'https://api.crossref.org';

function crossrefDate(message) {
  const parts = message?.published?.['date-parts']?.[0]
    || message?.['published-print']?.['date-parts']?.[0]
    || message?.['published-online']?.['date-parts']?.[0]
    || message?.issued?.['date-parts']?.[0];
  if (!Array.isArray(parts) || !parts.length) return { date: null, year: null };
  const [y, m = 1, d = 1] = parts.map(Number);
  if (!Number.isInteger(y)) return { date: null, year: null };
  const date = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { date, year: y };
}

function crossrefAuthor(author) {
  const name = [author?.given, author?.family].filter(Boolean).join(' ').trim() || normalizeTitle(author?.name);
  if (!name) return null;
  return { name, orcid: normalizeOrcid(author?.ORCID) };
}

export function normalizeCrossrefMessage(message, retrievedAt = new Date().toISOString()) {
  const doi = normalizeDoi(message?.DOI);
  const title = normalizeTitle(message?.title);
  if (!doi || !title) return null;
  const abstract = stripCrossrefMarkup(message?.abstract);
  const { date, year } = crossrefDate(message);
  const authors = Array.isArray(message?.author) ? message.author.map(crossrefAuthor).filter(Boolean) : [];
  const licenses = Array.isArray(message?.license)
    ? message.license.map((license) => ({
        url: license?.URL || null,
        type: null,
        appliesTo: license?.['content-version'] || null,
        source: 'crossref'
      })).filter((license) => license.url || license.appliesTo)
    : [];
  const count = Number.isInteger(message?.['is-referenced-by-count']) && message['is-referenced-by-count'] >= 0
    ? message['is-referenced-by-count']
    : null;

  return {
    doi,
    title,
    authors,
    publicationDate: date,
    publicationYear: year,
    type: message?.type || null,
    language: message?.language || null,
    identifiers: { doi },
    venue: {
      name: normalizeTitle(message?.['container-title']),
      issn: Array.isArray(message?.ISSN) ? message.ISSN.filter(Boolean).map(String) : [],
      publisher: normalizeTitle(message?.publisher)
    },
    abstract,
    evidenceSource: abstract ? {
      kind: 'abstract', provider: 'crossref', sourceRef: doi, retrievedAt
    } : {
      kind: 'metadata', provider: 'crossref', sourceRef: doi, retrievedAt
    },
    licenses,
    citationObservation: count == null ? null : { source: 'crossref', count, checkedAt: retrievedAt },
    urls: {
      doi: doiUrl(doi),
      publisher: message?.URL || null
    },
    provenance: { provider: 'crossref', providerId: doi, retrievedAt }
  };
}

export function crossrefMessageToResearchWork(message, retrievedAt = new Date().toISOString()) {
  const normalized = normalizeCrossrefMessage(message, retrievedAt);
  if (!normalized) return null;

  const count = normalized.citationObservation?.count ?? null;
  const work = {
    id: `doi:${normalized.doi}`,
    title: normalized.title,
    authors: normalized.authors,
    publicationDate: normalized.publicationDate,
    publicationYear: normalized.publicationYear,
    type: normalized.type,
    language: normalized.language,
    doi: normalized.doi,
    identifiers: normalized.identifiers,
    venue: normalized.venue,
    abstract: normalized.abstract,
    evidence: {
      level: normalized.abstract ? 'ABSTRACT' : 'METADATA_ONLY',
      sources: [normalized.evidenceSource]
    },
    openAccess: {
      isOa: null,
      status: null,
      url: null,
      source: null
    },
    licenses: normalized.licenses,
    citations: {
      preferredCount: count,
      preferredSource: count == null ? null : 'crossref',
      observations: normalized.citationObservation ? [normalized.citationObservation] : []
    },
    urls: {
      doi: normalized.urls.doi,
      publisher: normalized.urls.publisher,
      openAccess: null
    },
    flags: { retracted: null },
    provenance: [normalized.provenance]
  };

  return parseResearchWork(work);
}

function providerError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

function crossrefHeaders(env) {
  const headers = { Accept: 'application/json' };
  if (env.CROSSREF_MAILTO) headers['User-Agent'] = `LibEdge/1.0 (mailto:${env.CROSSREF_MAILTO})`;
  return headers;
}

async function crossrefFetch(url, env, options = {}) {
  if (env.CROSSREF_MAILTO) url.searchParams.set('mailto', env.CROSSREF_MAILTO);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: crossrefHeaders(env) });
  } finally {
    clearTimeout(timeout);
  }
  return response;
}

export async function fetchCrossrefByDoi(doi, env, options = {}) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return null;
  const url = new URL(`${CROSSREF_BASE}/works/${encodeURIComponent(normalized)}`);
  const response = await crossrefFetch(url, env, options);

  if (response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 429) throw providerError(429, 'CROSSREF_RATE_LIMITED');
    throw providerError(response.status, 'CROSSREF_UNAVAILABLE');
  }

  const payload = await response.json();
  return normalizeCrossrefMessage(payload?.message, new Date().toISOString());
}

export async function searchCrossref(query, env, options = {}) {
  const url = new URL(`${CROSSREF_BASE}/works`);
  url.searchParams.set('query.bibliographic', query);
  url.searchParams.set('rows', String(options.perPage || 10));
  const response = await crossrefFetch(url, env, options);

  if (!response.ok) {
    if (response.status === 429) throw providerError(429, 'CROSSREF_RATE_LIMITED');
    throw providerError(response.status, 'CROSSREF_UNAVAILABLE');
  }

  const payload = await response.json();
  const retrievedAt = new Date().toISOString();
  const items = Array.isArray(payload?.message?.items) ? payload.message.items : [];
  return {
    results: items.map((item) => crossrefMessageToResearchWork(item, retrievedAt)).filter(Boolean),
    retrievedAt
  };
}
