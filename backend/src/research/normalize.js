const DOI_PREFIX_RE = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/i;
const DOI_RE = /^10\.\d{4,9}\/\S+$/i;

export function normalizeDoi(value) {
  if (!value) return null;
  let doi = String(value).trim().replace(DOI_PREFIX_RE, '');
  try {
    doi = decodeURIComponent(doi);
  } catch {
    // Keep original text when malformed percent-encoding is present.
  }
  doi = doi.trim().toLowerCase();
  return DOI_RE.test(doi) ? doi : null;
}

export function doiUrl(doi) {
  const normalized = normalizeDoi(doi);
  return normalized ? `https://doi.org/${normalized}` : null;
}

export function reconstructOpenAlexAbstract(index) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) return null;

  const positions = [];
  for (const [token, rawPositions] of Object.entries(index)) {
    if (!token || !Array.isArray(rawPositions)) continue;
    for (const rawPosition of rawPositions) {
      const position = Number(rawPosition);
      if (!Number.isInteger(position) || position < 0) continue;
      positions.push([position, token]);
    }
  }

  if (!positions.length) return null;
  positions.sort((a, b) => a[0] - b[0]);

  const tokens = [];
  let previous = -1;
  for (const [position, token] of positions) {
    if (position === previous) continue;
    tokens.push(token);
    previous = position;
  }

  const text = tokens.join(' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

export function stripCrossrefMarkup(value) {
  if (!value) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

export function normalizeOrcid(value) {
  if (!value) return null;
  const text = String(value).trim().replace(/^https?:\/\/orcid\.org\//i, '');
  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(text) ? text.toUpperCase() : null;
}

export function normalizeTitle(value) {
  if (Array.isArray(value)) value = value[0];
  const title = value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
  return title || null;
}

export function normalizedFingerprintPart(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
