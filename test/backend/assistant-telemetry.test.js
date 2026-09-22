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
});
