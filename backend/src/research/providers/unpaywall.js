import { normalizeDoi } from '../normalize.js';

const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';

function providerError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

export function normalizeUnpaywallRecord(record, retrievedAt = new Date().toISOString()) {
  const doi = normalizeDoi(record?.doi);
  if (!doi) return null;
  const best = record?.best_oa_location || {};
  const url = best?.url_for_pdf || best?.url || best?.url_for_landing_page || null;
  return {
    doi,
    isOa: typeof record?.is_oa === 'boolean' ? record.is_oa : null,
    status: record?.oa_status || null,
    url,
    source: 'unpaywall',
    retrievedAt
  };
}

export async function fetchUnpaywallByDoi(doi, env, options = {}) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return null;
  const email = String(env.UNPAYWALL_CONTACT_EMAIL || '').trim();
  if (!email) throw providerError(0, 'UNPAYWALL_CONTACT_EMAIL_MISSING');

  const url = new URL(`${UNPAYWALL_BASE}/${encodeURIComponent(normalized)}`);
  url.searchParams.set('email', email);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 429) throw providerError(429, 'UNPAYWALL_RATE_LIMITED');
    throw providerError(response.status, 'UNPAYWALL_UNAVAILABLE');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw providerError(response.status, 'UNPAYWALL_MALFORMED');
  }
  if (!payload || typeof payload !== 'object') throw providerError(response.status, 'UNPAYWALL_MALFORMED');
  return normalizeUnpaywallRecord(payload, new Date().toISOString());
}
