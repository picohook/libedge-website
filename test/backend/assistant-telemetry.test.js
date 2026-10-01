import { describe, expect, it, vi } from 'vitest';
import { __test, recordAssistantOutcome } from '../../backend/src/assistant/telemetry.js';

describe('assistant privacy-safe telemetry', () => {
  it('allows only bounded outcome codes', () => {
    expect(__test.safeCode('GROUNDING_REJECTED')).toBe('GROUNDING_REJECTED');
    expect(__test.safeCode('user query text')).toBe('OTHER');
  });

  it('logs no query, evidence, claim, user, session, pack, or credential fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    recordAssistantOutcome({ ENVIRONMENT: 'staging' }, {
      code: 'MODEL_ADAPTER_REQUIRED',
      durationMs: 12.4,
      query: 'private query',
      evidence: [{ abstract: 'private evidence' }],
      user_id: 42
    });

    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload).toEqual({
      event: 'research_assistant_outcome',
      code: 'MODEL_ADAPTER_REQUIRED',
      duration_ms: 12,
      environment: 'staging'
    });
    expect(JSON.stringify(payload)).not.toContain('private query');
    expect(JSON.stringify(payload)).not.toContain('private evidence');
    expect(payload).not.toHaveProperty('query');
    expect(payload).not.toHaveProperty('evidence');
    expect(payload).not.toHaveProperty('user_id');
    spy.mockRestore();
  });
  it('logs only a sanitized error class and rejects message-like values', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    recordAssistantOutcome({ ENVIRONMENT: 'staging' }, {
      code: 'MODEL_ADAPTER_FAILED',
      durationMs: 5,
      errorClass: 'CredentialsProviderError'
    });
    expect(JSON.parse(spy.mock.calls[0][0])).toMatchObject({
      code: 'MODEL_ADAPTER_FAILED',
      error_class: 'CredentialsProviderError'
    });

    recordAssistantOutcome({}, {
      code: 'MODEL_ADAPTER_FAILED',
      errorClass: 'Error: secret/request context'
    });
    expect(JSON.parse(spy.mock.calls[1][0])).not.toHaveProperty('error_class');
    spy.mockRestore();
  });

  it('logs only allowlisted content-free diagnostic reasons', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    recordAssistantOutcome({ ENVIRONMENT: 'staging' }, {
      code: 'MODEL_ADAPTER_FAILED',
      diagnosticReason: 'MODEL_OUTPUT_NOT_JSON'
    });
    expect(JSON.parse(spy.mock.calls[0][0])).toMatchObject({ diagnostic_reason: 'MODEL_OUTPUT_NOT_JSON' });

    recordAssistantOutcome({}, {
      code: 'MODEL_ADAPTER_FAILED',
      diagnosticReason: 'private provider message'
    });
    expect(JSON.parse(spy.mock.calls[1][0])).not.toHaveProperty('diagnostic_reason');
    spy.mockRestore();
  });


  it('logs only allowlisted stage timings and no arbitrary diagnostic fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    recordAssistantOutcome({ ENVIRONMENT: 'staging' }, {
      code: 'OK',
      durationMs: 100,
      stageTimings: {
        discover_ms: 11.2,
        evidence_pack_ms: 2,
        model_ms: 33.8,
        grounding_ms: 51,
        query: 'private query',
        arbitrary_ms: 999
      }
    });
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload).toMatchObject({
      discover_ms: 11,
      evidence_pack_ms: 2,
      model_ms: 34,
      grounding_ms: 51
    });
    expect(payload).not.toHaveProperty('query');
    expect(payload).not.toHaveProperty('arbitrary_ms');
    spy.mockRestore();
  });
});