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
    RESEARCH_ASSISTANT_SUPPORT_CHECK_DAILY_INVOCATION_LIMIT: '100',
    RATE_LIMIT_KV: {
      get: vi.fn(async (key) => key === 'assistant:supportcheck:daily-invocation-limit' ? null : '0'),
      put: vi.fn(async () => {})
    },
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

  it('passes an abort signal and bounds the SageMaker invocation timeout', async () => {
    vi.useFakeTimers();
    try {
      let capturedSignal;
      const send = vi.fn((_command, options) => {
        capturedSignal = options.abortSignal;
        return new Promise((_resolve, reject) => {
          options.abortSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      });
      const check = createSupportCheck(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS: '25' }), {
        sagemakerClientFactory: () => ({ send })
      });
      const pending = check(claim, evidence);
      const rejection = expect(pending).rejects.toThrow('aborted');
      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(capturedSignal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs only content-free SageMaker error metadata and rethrows', async () => {
    const error = Object.assign(new Error('sensitive original message'), {
      name: 'ModelError',
      $fault: 'client',
      OriginalStatusCode: 500,
      LogStreamArn: 'arn:aws:logs:us-east-1:123:log-stream:test',
      OriginalMessage: 'must never be logged'
    });
    const send = vi.fn(async () => { throw error; });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const invoke = createSageMakerSupportCheckTransport(env(), { clientFactory: () => ({ send }) });
      await expect(invoke(claim, evidence)).rejects.toBe(error);
      expect(spy).toHaveBeenCalledWith('supportCheck SageMaker invocation failed', {
        name: 'ModelError',
        fault: 'client',
        originalStatusCode: 500,
        logStreamArn: 'arn:aws:logs:us-east-1:123:log-stream:test'
      });
      expect(JSON.stringify(spy.mock.calls)).not.toContain('must never be logged');
      expect(JSON.stringify(spy.mock.calls)).not.toContain('sensitive original message');
    } finally {
      spy.mockRestore();
    }
  });

  it('caps configured SageMaker timeout at 45000ms', () => {
    expect(__test.timeoutMs(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS: '999999' }))).toBe(45000);
    expect(__test.timeoutMs(env({ RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS: 'invalid' }))).toBe(5000);
  });

  it('does not add optional tracking metadata to InvokeEndpoint', () => {
    const body = __test.payloadFor(claim, evidence);
    expect(body).toEqual({ pin: SUPPORT_CHECK_PIN, claim: { text: claim.text }, evidence });
  });
});
