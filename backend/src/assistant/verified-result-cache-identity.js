const REQUIRED_STRING_FIELDS = [
  'user_scope',
  'query_digest',
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
