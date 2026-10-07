const REQUIRED_STRING_FIELDS = [
  'user_scope',
  'query_digest',
  'retrieval_query_digest',
  'query_normalization_version',
  'generation_model_id',
  'generation_contract_version',
  'checker_model',
  'checker_revision',
  'checker_manifest',
  'decision_contract_version',
  'evidence_policy_version',
  'cache_schema_version',
  'language_policy_version',
  'evidence_depth_policy_version'
];

const textEncoder = new TextEncoder();

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, domain, value) {
  if (!nonEmptyString(secret)) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${domain}\0${value}`));
  return hex(signature);
}

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', textEncoder.encode(value)));
}

function stripVolatileRetrievalFields(value) {
  if (Array.isArray(value)) return value.map(stripVolatileRetrievalFields);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['retrievedAt', 'retrieved_at'].includes(key))
        .map(([key, child]) => [key, stripVolatileRetrievalFields(child)])
    );
  }
  return value;
}

function stableEvidenceSnapshot(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const workId = String(item.work_id || '').trim();
  if (!workId) return null;
  return {
    work_id: workId,
    language_authorized: item.language_authorized === true,
    title: String(item.title || ''),
    authors: Array.isArray(item.authors) ? item.authors : [],
    publicationDate: item.publicationDate ?? null,
    publicationYear: item.publicationYear ?? null,
    doi: item.doi ?? null,
    venue: item.venue ?? null,
    abstract: item.abstract ?? null,
    evidence: stripVolatileRetrievalFields(item.evidence ?? null),
    urls: item.urls ?? null,
    flags: item.flags ?? null,
    provenance: stripVolatileRetrievalFields(item.provenance ?? null)
  };
}

export async function verifiedResultQueryDigest(query, secret) {
  const canonicalQuery = String(query ?? '').trim().replace(/\s+/g, ' ');
  if (!canonicalQuery) return null;
  const digest = await hmac(secret, 'libedge:research-query:v1', canonicalQuery);
  return digest ? `hmac-sha256:${digest}` : null;
}

export async function verifiedResultEvidenceIdentity(evidencePack) {
  const evidence = Array.isArray(evidencePack?.evidence) ? evidencePack.evidence : [];
  if (!evidence.length) return null;
  const identities = [];
  for (const item of evidence) {
    const snapshot = stableEvidenceSnapshot(item);
    if (!snapshot || snapshot.language_authorized !== true) return null;
    identities.push({
      evidence_id: snapshot.work_id,
      fingerprint: `sha256:${await sha256(JSON.stringify(stable(snapshot)))}`
    });
  }
  return identities;
}

export function canonicalVerifiedResultIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return null;
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!nonEmptyString(identity[field])) return null;
  }
  if (typeof identity.checker_threshold !== 'number' || !Number.isFinite(identity.checker_threshold)) return null;
  if (!Array.isArray(identity.evidence) || identity.evidence.length === 0) return null;
  for (const item of identity.evidence) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (!nonEmptyString(item.evidence_id) || !nonEmptyString(item.fingerprint)) return null;
  }
  const required = {
    user_scope: identity.user_scope,
    query_digest: identity.query_digest,
    retrieval_query_digest: identity.retrieval_query_digest,
    query_normalization_version: identity.query_normalization_version,
    evidence: identity.evidence,
    generation_model_id: identity.generation_model_id,
    generation_contract_version: identity.generation_contract_version,
    checker_model: identity.checker_model,
    checker_revision: identity.checker_revision,
    checker_manifest: identity.checker_manifest,
    checker_threshold: identity.checker_threshold,
    decision_contract_version: identity.decision_contract_version,
    evidence_policy_version: identity.evidence_policy_version,
    cache_schema_version: identity.cache_schema_version,
    language_policy_version: identity.language_policy_version,
    evidence_depth_policy_version: identity.evidence_depth_policy_version
  };
  return JSON.stringify(stable(required));
}
