import { describe, expect, it, vi } from 'vitest';
import { SUPPORT_CHECK_PIN, supportCheckGateFromEnv } from '../../backend/src/assistant/support-check-config.js';
import { createSupportCheck } from '../../backend/src/assistant/support-check-client.js';

function enabledEnv(overrides = {}) {
  return {
    RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'true',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_URL: 'https://checker.example.test/v1/support',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_TOKEN: 'secret',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS: '5000',
    ...overrides
  };
}

const claim = { text: 'Claim text.' };
const evidence = [{ evidence_id: 'p:e1', title: 'Paper', abstract: 'Evidence text.' }];

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function pinnedResult(primary_decision = 'SUPPORT') {
  return {
    model: SUPPORT_CHECK_PIN.model,
    revision: SUPPORT_CHECK_PIN.revision,
    engine_manifest_sha256: SUPPORT_CHECK_PIN.engineManifestSha256,
    primary_decision,
    diagnostic: primary_decision === 'SUPPORT' ? 'SUPPORT' : 'NOT_SUPPORTING'
  };
}

describe('Fresh-Checker pin', () => {
  it('freezes the accepted engine identity and thresholds', () => {
    expect(SUPPORT_CHECK_PIN).toEqual({
      model: 'MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli',
      revision: '6f5cf0a2b59cabb106aca4c287eed12e357e90eb',
      engineManifestSha256: '96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918',
      entailmentThreshold: 0.85,
      contradictionThreshold: 0.85,
      aggregateRule: 'ANY_SUPPORT_ELSE_NOT_SUPPORTED'
    });
    expect(Object.isFrozen(SUPPORT_CHECK_PIN)).toBe(true);
  });

  it('keeps the checker gate closed unless both flags explicitly pass', () => {
    expect(supportCheckGateFromEnv({})).toEqual({ enabled: false, privacyStatus: 'UNVERIFIED' });
    expect(createSupportCheck({})).toBeNull();
    expect(createSupportCheck(enabledEnv({ RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'UNVERIFIED' }))).toBeNull();
    expect(createSupportCheck(enabledEnv({ RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'false' }))).toBeNull();
  });

  it('sends only claim plus cited evidence and requires the exact pin in the response', async () => {
    const fetchImpl = vi.fn(async () => response(pinnedResult('SUPPORT')));
    const check = createSupportCheck(enabledEnv(), { fetchImpl });
    await expect(check(claim, evidence)).resolves.toEqual({ supported: true, reason: 'SUPPORT' });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://checker.example.test/v1/support');
    const body = JSON.parse(options.body);
    expect(body.pin).toEqual(SUPPORT_CHECK_PIN);
    expect(body.claim).toEqual({ text: 'Claim text.' });
    expect(body.evidence).toEqual(evidence);
    expect(JSON.stringify(body)).not.toContain('user_id');
    expect(JSON.stringify(body)).not.toContain('email');
  });

  it.each([
    ['model', 'wrong-model'],
    ['revision', 'wrong-revision'],
    ['engine_manifest_sha256', '0'.repeat(64)]
  ])('fails closed on pinned metadata mismatch: %s', async (field, value) => {
    const fetchImpl = vi.fn(async () => response({ ...pinnedResult(), [field]: value }));
    const check = createSupportCheck(enabledEnv(), { fetchImpl });
    await expect(check(claim, evidence)).rejects.toThrow();
  });

  it('maps NOT_SUPPORTED to a rejected semantic result', async () => {
    const fetchImpl = vi.fn(async () => response(pinnedResult('NOT_SUPPORTED')));
    const check = createSupportCheck(enabledEnv(), { fetchImpl });
    await expect(check(claim, evidence)).resolves.toEqual({
      supported: false,
      reason: 'NOT_SUPPORTING'
    });
  });

  it('fails closed on HTTP and invalid-result failures', async () => {
    const httpCheck = createSupportCheck(enabledEnv(), {
      fetchImpl: vi.fn(async () => response({ error: 'unavailable' }, 503))
    });
    await expect(httpCheck(claim, evidence)).rejects.toThrow('SUPPORT_CHECK_HTTP_FAILED');

    const invalidCheck = createSupportCheck(enabledEnv(), {
      fetchImpl: vi.fn(async () => response({ ...pinnedResult(), primary_decision: 'MAYBE' }))
    });
    await expect(invalidCheck(claim, evidence)).rejects.toThrow('SUPPORT_CHECK_INVALID_DECISION');
  });

  it('refuses non-HTTPS checker endpoints', () => {
    expect(createSupportCheck(enabledEnv({
      RESEARCH_ASSISTANT_SUPPORT_CHECK_URL: 'http://checker.example.test/v1/support'
    }))).toBeNull();
  });
});
