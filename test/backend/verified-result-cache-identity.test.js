import { describe, expect, it } from 'vitest';
import {
  canonicalVerifiedResultIdentity,
  verifiedResultEvidenceIdentity,
  verifiedResultQueryDigest
} from '../../backend/src/assistant/verified-result-cache-identity.js';

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
  language_policy_version: 'text-detected-en-v2',
  evidence_depth_policy_version: 'depth1'
});

const evidencePack = (packId = 'pack-a', title = 'Stable title') => ({
  pack_id: packId,
  evidence: [{
    evidence_id: `${packId}:e1`,
    language_authorized: true,
    work_id: 'work-1',
    title,
    authors: [{ name: 'A. Author', orcid: null }],
    publicationDate: '2025-01-01',
    publicationYear: 2025,
    doi: '10.1/example',
    venue: { name: 'Journal', publisher: 'Publisher' },
    abstract: 'Evidence text.',
    evidence: { level: 'abstract', sources: [{ provider: 'x' }] },
    urls: { landing: 'https://example.test' },
    flags: {},
    provenance: [{ provider: 'x' }]
  }]
});

describe('verified-result cache identity', () => {
  it('serializes object keys canonically without changing evidence order', () => {
    const a = identity();
    const b = { ...a, evidence: a.evidence.map((item) => ({ fingerprint: item.fingerprint, evidence_id: item.evidence_id })) };
    expect(canonicalVerifiedResultIdentity(a)).toBe(canonicalVerifiedResultIdentity(b));
    expect(canonicalVerifiedResultIdentity({ ...a, evidence: [...a.evidence].reverse() })).not.toBe(canonicalVerifiedResultIdentity(a));
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

  it('HMACs canonical query text with domain separation and never returns plaintext', async () => {
    const a = await verifiedResultQueryDigest('  CRISPR   base editing  ', 'secret-a');
    const b = await verifiedResultQueryDigest('CRISPR base editing', 'secret-a');
    expect(a).toBe(b);
    expect(a).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
    expect(a).not.toContain('CRISPR');
    expect(await verifiedResultQueryDigest('CRISPR base editing', 'secret-b')).not.toBe(a);
    expect(await verifiedResultQueryDigest('CRISPR base editing', '')).toBeNull();
  });

  it('uses stable work identity instead of random pack-local evidence ids', async () => {
    const a = await verifiedResultEvidenceIdentity(evidencePack('pack-a'));
    const b = await verifiedResultEvidenceIdentity(evidencePack('pack-b'));
    expect(a).toEqual(b);
    expect(a[0].evidence_id).toBe('work-1');
  });

  it('invalidates evidence identity when authorized content changes', async () => {
    const a = await verifiedResultEvidenceIdentity(evidencePack('pack-a', 'Stable title'));
    const b = await verifiedResultEvidenceIdentity(evidencePack('pack-b', 'Changed title'));
    expect(a).not.toEqual(b);
  });

  it('fails closed when evidence is empty, lacks stable work identity, or is not language-authorized', async () => {
    expect(await verifiedResultEvidenceIdentity({ evidence: [] })).toBeNull();
    const noId = evidencePack();
    noId.evidence[0].work_id = '';
    expect(await verifiedResultEvidenceIdentity(noId)).toBeNull();
    const unauthorized = evidencePack();
    unauthorized.evidence[0].language_authorized = false;
    expect(await verifiedResultEvidenceIdentity(unauthorized)).toBeNull();
  });
});
