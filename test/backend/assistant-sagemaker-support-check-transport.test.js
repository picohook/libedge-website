import { describe, expect, it, vi } from 'vitest';
import { SUPPORT_CHECK_PIN } from '../../backend/src/assistant/support-check-config.js';
import { createSupportCheck } from '../../backend/src/assistant/support-check-client.js';
import { __test, createSageMakerSupportCheckTransport } from '../../backend/src/assistant/sagemaker-support-check-transport.js';

const claim = { text: 'Claim text.' };
const evidence = [{ evidence_id: 'p:e1', title: 'Paper', abstract: 'Evidence text.' }];

function env(overrides = {}) {
  return {
    RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'true',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_TRANSPORT: 'sagemaker',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_AWS_REGION: 'us-east-1',
    RESEARCH_ASSISTANT_SUPPORT_CHECK_SAGEMAKER_ENDPOINT: 'libedge-supportcheck',
    AWS_ACCESS_KEY_ID: 'test-access',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    ...overrides
  };
}

function pinned(primary_decision = 'SUPPORT') {
  return {
    model: SUPPORT_CHECK_PIN.model,
    revision: SUPPORT_CHECK_PIN.revision,
    engine_manifest_sha256: SUPPORT_CHECK_PIN.engineManifestSha256,
    primary_decision,
    diagnostic: primary_decision === 'SUPPORT' ? 'SUPPORT' : 'NOT_SUPPORTING'
  };
}

describe('SageMaker supportCheck transport', () => {
  it('stays unavailable without credentials, region, or endpoint', () => {
    expect(createSageMakerSupportCheckTransport(env({ AWS_SECRET_ACCESS_KEY: '' }))).toBeNull();
    expect(createSageMakerSupportCheckTransport(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_AWS_REGION: '' }))).toBeNull();
    expect(createSageMakerSupportCheckTransport(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_SAGEMAKER_ENDPOINT: '' }))).toBeNull();
  });

  it('sends only pin, claim, and cited evidence to the exact endpoint', async () => {
    const send = vi.fn(async () => ({ Body: new TextEncoder().encode(JSON.stringify(pinned())) }));
    const clientFactory = vi.fn(() => ({ send }));
    const invoke = createSageMakerSupportCheckTransport(env(), { clientFactory });
    await expect(invoke(claim, evidence)).resolves.toEqual(pinned());

    expect(clientFactory).toHaveBeenCalledWith({
      region: 'us-east-1',
      credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' }
    });
    const input = send.mock.calls[0][0].input;
    expect(input.EndpointName).toBe('libedge-supportcheck');
    expect(input.ContentType).toBe('application/json');
    const body = JSON.parse(new TextDecoder().decode(input.Body));
    expect(body).toEqual({ pin: SUPPORT_CHECK_PIN, claim: { text: claim.text }, evidence });
    expect(JSON.stringify(body)).not.toContain('user_id');
    expect(JSON.stringify(body)).not.toContain('email');
  });

  it('preserves the outer privacy/feature gate and exact response pin', async () => {
    const send = vi.fn(async () => ({ Body: new TextEncoder().encode(JSON.stringify(pinned())) }));
    const clientFactory = () => ({ send });

    expect(createSupportCheck(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED: 'false' }), { sagemakerClientFactory: clientFactory })).toBeNull();
    expect(createSupportCheck(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'UNVERIFIED' }), { sagemakerClientFactory: clientFactory })).toBeNull();

    const check = createSupportCheck(env(), { sagemakerClientFactory: clientFactory });
    await expect(check(claim, evidence)).resolves.toEqual({ supported: true, reason: 'SUPPORT' });
  });

  it('fails closed when SageMaker returns the wrong frozen identity', async () => {
    const send = vi.fn(async () => ({
      Body: new TextEncoder().encode(JSON.stringify({ ...pinned(), revision: 'wrong' }))
    }));
    const check = createSupportCheck(env(), { sagemakerClientFactory: () => ({ send }) });
    await expect(check(claim, evidence)).rejects.toThrow('SUPPORT_CHECK_REVISION_MISMATCH');
  });

  it('does not add optional tracking metadata to InvokeEndpoint', () => {
    const body = __test.payloadFor(claim, evidence);
    expect(body).toEqual({ pin: SUPPORT_CHECK_PIN, claim: { text: claim.text }, evidence });
  });
});
