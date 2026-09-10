import { doiUrl, normalizeDoi, normalizeOrcid, normalizeTitle, reconstructOpenAlexAbstract } from '../normalize.js';
import { parseResearchWork } from '../research-work.js';

const OPENALEX_BASE = 'https://api.openalex.org';

function readHeaderNumber(headers, names) {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw == null || raw === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function detectHeaderFamily(headers) {
  const hasUsd = ['X-RateLimit-Limit-USD', 'X-RateLimit-Remaining-USD', 'X-RateLimit-Cost-USD', 'X-RateLimit-Prepaid-Remaining-USD']
    .some((name) => headers.has(name));
  const hasCredits = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Credits-Used', 'X-RateLimit-Reset']
    .some((name) => headers.has(name));
  if (hasUsd && hasCredits) return 'mixed';
  if (hasUsd) return 'usd';
  if (hasCredits) return 'credits';
  return null;
}

export function extractOpenAlexTelemetry(response, payload = null) {
  return {
    headerFamily: detectHeaderFamily(response.headers),
    limit: readHeaderNumber(response.headers, ['X-RateLimit-Limit', 'X-RateLimit-Limit-USD']),
    remaining: readHeaderNumber(response.headers, ['X-RateLimit-Remaining', 'X-RateLimit-Remaining-USD']),
    requestCredits: readHeaderNumber(response.headers, ['X-RateLimit-Credits-Used']),
    requestCostUsd: readHeaderNumber(response.headers, ['X-RateLimit-Cost-USD'])
      ?? (Number.isFinite(Number(payload?.meta?.cost_usd)) ? Number(payload.meta.cost_usd) : null),
    prepaidRemainingUsd: readHeaderNumber(response.headers, ['X-RateLimit-Prepaid-Remaining-USD']),
    resetSeconds: readHeaderNumber(response.headers, ['X-RateLimit-Reset'])
  };
}

function openAlexAuthor(authorship) {
  const author = authorship?.author || {};
  const name = normalizeTitle(author.display_name);
  if (!name) return null;
  return {
    name,
    orcid: normalizeOrcid(author.orcid)
  };
}

function openAlexIdentifiers(record, doi) {
  const ids = {};
  if (doi) ids.doi = doi;
  if (record?.id) ids.openalex = String(record.id).replace(/^https?:\/\/openalex\.org\//i, '');
  if (record?.ids?.pmid) ids.pmid = String(record.ids.pmid).replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//i, '').replace(/\/$/, '');
  if (record?.ids?.pmcid) ids.pmcid = String(record.ids.pmcid).replace(/^https?:\/\/www\.ncbi\.nlm\.nih\.gov\/pmc\/articles\//i, '').replace(/\/$/, '');
  return ids;
}

export function normalizeOpenAlexWork(record, retrievedAt = new Date().toISOString()) {
  const title = normalizeTitle(record?.title || record?.display_name);
  if (!title) return null;

  const doi = normalizeDoi(record?.doi || record?.ids?.doi);
  const abstract = reconstructOpenAlexAbstract(record?.abstract_inverted_index);
  const source = record?.primary_location?.source || {};
  const oa = record?.open_access || {};
  const providerId = record?.id ? String(record.id).replace(/^https?:\/\/openalex\.org\//i, '') : null;
  const identifiers = openAlexIdentifiers(record, doi);
  const authors = Array.isArray(record?.authorships)
    ? record.authorships.map(openAlexAuthor).filter(Boolean)
    : [];
  const citationCount = Number.isInteger(record?.cited_by_count) && record.cited_by_count >= 0
    ? record.cited_by_count
    : null;
  const licenseValue = record?.primary_location?.license || record?.best_oa_location?.license || null;
  const licenseUrl = record?.primary_location?.license_url || record?.best_oa_location?.license_url || null;

  const work = {
    id: doi ? `doi:${doi}` : providerId ? `openalex:${providerId}` : `openalex-title:${title.toLowerCase()}`,
    title,
    authors,
    publicationDate: record?.publication_date || null,
    publicationYear: Number.isInteger(record?.publication_year) ? record.publication_year : null,
    type: record?.type || null,
    language: record?.language || null,
    doi,
    identifiers,
    venue: {
      name: normalizeTitle(source?.display_name),
      issn: Array.isArray(source?.issn) ? source.issn.filter(Boolean).map(String) : [],
      publisher: normalizeTitle(source?.host_organization_name || source?.publisher)
    },
    abstract,
    evidence: {
      level: abstract ? 'ABSTRACT' : 'METADATA_ONLY',
      sources: [{
        kind: abstract ? 'abstract' : 'metadata',
        provider: 'openalex',
        sourceRef: providerId,
        retrievedAt
      }]
    },
    openAccess: {
      isOa: typeof oa?.is_oa === 'boolean' ? oa.is_oa : null,
      status: oa?.oa_status || null,
      url: record?.best_oa_location?.landing_page_url || record?.best_oa_location?.pdf_url || oa?.oa_url || null,
      source: 'openalex'
    },
    licenses: licenseValue || licenseUrl ? [{
      url: licenseUrl,
      type: licenseValue,
      appliesTo: 'work',
      source: 'openalex'
    }] : [],
    citations: {
      preferredCount: citationCount,
      preferredSource: citationCount == null ? null : 'openalex',
      observations: citationCount == null ? [] : [{ source: 'openalex', count: citationCount, checkedAt: retrievedAt }]
    },
    urls: {
      doi: doiUrl(doi),
      publisher: record?.primary_location?.landing_page_url || null,
      openAccess: record?.best_oa_location?.landing_page_url || record?.best_oa_location?.pdf_url || null
    },
    flags: {
      retracted: typeof record?.is_retracted === 'boolean' ? record.is_retracted : null
    },
    provenance: [{ provider: 'openalex', providerId, retrievedAt }]
  };

  return parseResearchWork(work);
}

function providerError(status, code, telemetry = null) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  error.telemetry = telemetry;
  return error;
}

export async function searchOpenAlex(query, env, options = {}) {
  const url = new URL(`${OPENALEX_BASE}/works`);
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', String(options.perPage || 25));
  if (env.OPENALEX_API_KEY) url.searchParams.set('api_key', env.OPENALEX_API_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const telemetry = extractOpenAlexTelemetry(response);
    if (response.status === 429) throw providerError(429, 'OPENALEX_RATE_LIMITED', telemetry);
    throw providerError(response.status, 'OPENALEX_UNAVAILABLE', telemetry);
  }

  const payload = await response.json();
  const retrievedAt = new Date().toISOString();
  const results = Array.isArray(payload?.results)
    ? payload.results.map((record) => normalizeOpenAlexWork(record, retrievedAt)).filter(Boolean)
    : [];

  return {
    results,
    telemetry: extractOpenAlexTelemetry(response, payload),
    retrievedAt
  };
}
