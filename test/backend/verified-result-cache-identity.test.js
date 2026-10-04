import { describe, expect, it } from 'vitest';
import { canonicalVerifiedResultIdentity } from '../../backend/src/assistant/verified-result-cache-identity.js';

const identity = () => ({
  user_scope: 'user:7',
  query_digest: 'hmac:abc',
  evidence: [{ evidence_id: 'e2', fingerprint: 'f2' }, { evidence_id: 'e1', fingerprint: 'f1' }],
  generation_model_id: 'model',
  generation_contract_version: 'g1',
  checker_model: 'checker',
  checker_revision: 'r1',
  checker_manifest: 'm1',
  checker_threshold: 0.8,
  decision_contract_version: 'd023-v1',
  evidence_policy_version: 'ep1',
  cache_schema_version: 'v1',
  language_policy_version: 'lang1',
  evidence_depth_policy_version: 'depth1'
});

describe('verified-result cache identity', () => {
  it('serializes object keys canonically without changing evidence order', () => {
    const a = identity();
    const b = { ...a, evidence: a.evidence.map((item) => ({ fingerprint: item.fingerprint, evidence_id: item.evidence_id })) };
    expect(canonicalVerifiedResultIdentity(a)).toBe(canonicalVerifiedResultIdentity(b));
    const reversed = { ...a, evidence: [...a.evidence].reverse() };
    expect(canonicalVerifiedResultIdentity(reversed)).not.toBe(canonicalVerifiedResultIdentity(a));
  });

  it('fails closed when any required identity field is missing', () => {
    for (const field of Object.keys(identity())) {
      const candidate = identity();
      delete candidate[field];
      expect(canonicalVerifiedResultIdentity(candidate)).toBeNull();
    }
  });

  it('fails closed for incomplete or invalid evidence entries', () => {
    expect(canonicalVerifiedResultIdentity({ ...identity(), evidence: [] })).toBeNull();
    expect(canonicalVerifiedResultIdentity({ ...identity(), evidence: [null] })).toBeNull();
    expect(canonicalVerifiedResultIdentity({ ...identity(), evidence: [{ evidence_id: 'e1' }] })).toBeNull();
    expect(canonicalVerifiedResultIdentity({ ...identity(), evidence: [{ evidence_id: 'e1', fingerprint: undefined }] })).toBeNull();
  });

  it('fails closed for non-finite thresholds and invalid string fields', () => {
    expect(canonicalVerifiedResultIdentity({ ...identity(), checker_threshold: NaN })).toBeNull();
    expect(canonicalVerifiedResultIdentity({ ...identity(), checker_threshold: Infinity })).toBeNull();
    expect(canonicalVerifiedResultIdentity({ ...identity(), checker_model: '   ' })).toBeNull();
    expect(canonicalVerifiedResultIdentity({ ...identity(), user_scope: 7 })).toBeNull();
  });

  it('does not include unrelated fields in the trust identity', () => {
    expect(canonicalVerifiedResultIdentity({ ...identity(), query_text: 'must not enter identity' }))
      .toBe(canonicalVerifiedResultIdentity(identity()));
  });
});
