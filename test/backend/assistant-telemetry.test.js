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

  it('maps model adapter failures to bounded aggregate classes and never to raw provider text', () => {
    expect(__test.modelFailureMetric('AccessDeniedException')).toBe('assistant_model_failure_access_denied_exception');
    expect(__test.modelFailureMetric('ThrottlingException')).toBe('assistant_model_failure_throttling_exception');
    expect(__test.modelFailureMetric('private provider/query text')).toBe('assistant_model_failure_other');
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


  it('logs only bounded grounding cardinality and ignores content-like diagnostic fields', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await recordAssistantOutcome({ ENVIRONMENT: 'staging' }, {
      code: 'GROUNDING_REJECTED',
      groundingDiagnostic: {
        claim_count: 4,
        accepted_count: 3,
        rejected_count: 1,
        query: 'private query',
        claim: 'private claim',
        evidence: 'private evidence',
        fingerprint: 'do-not-log'
      }
    });
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload.grounding_cardinality).toEqual({ claim_count: 4, accepted_count: 3, rejected_count: 1 });
    expect(JSON.stringify(payload)).not.toMatch(/private query|private claim|private evidence|do-not-log/);
    spy.mockRestore();
  });

  it('allowlists bounded checker cardinality while excluding content-like fields', async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn() })) }));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await recordAssistantOutcome({ ENVIRONMENT: 'staging', DB: { prepare, batch } }, {
      code: 'OK',
      groundingDiagnostic: {
        claim_count: 6,
        accepted_count: 4,
        rejected_count: 2,
        eligible_count: 6,
        checked_count: 4,
        truncated_count: 2,
        support_check_limit: 4,
        rejection_counts: { SUPPORT_CHECK_BUDGET_TRUNCATED: 2 },
        claim: 'private scientific claim',
        evidence: 'private evidence'
      }
    });
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload.grounding_cardinality).toEqual({
      claim_count: 6, accepted_count: 4, rejected_count: 2,
      eligible_count: 6, checked_count: 4, truncated_count: 2, support_check_limit: 4
    });
    expect(payload.grounding_rejection_counts).toEqual({ SUPPORT_CHECK_BUDGET_TRUNCATED: 2 });
    expect(JSON.stringify(payload)).not.toMatch(/private scientific claim|private evidence/);

    const binds = prepare.mock.results.map((result) => result.value.bind.mock.calls[0]).filter(Boolean);
    const metrics = Object.fromEntries(binds.map((args) => [args[1], args[2]]));
    expect(metrics).toMatchObject({
      assistant_grounding_eligible_claims_total: 6,
      assistant_grounding_checked_claims_total: 4,
      assistant_grounding_truncated_claims_total: 2,
      assistant_grounding_rejection_support_check_budget_truncated: 2
    });
    spy.mockRestore();
  });

  it('persists content-free verification breadth counters only for successful verified answers', async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn() })) }));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await recordAssistantOutcome({ ENVIRONMENT: 'staging', DB: { prepare, batch } }, {
      code: 'OK',
      groundingDiagnostic: {
        accepted_count: 3,
        unique_supporting_source_count: 2,
        single_source_verified_answer: 0,
        claim: 'private claim',
        evidence: 'private evidence'
      }
    });
    const binds = prepare.mock.results.map((result) => result.value.bind.mock.calls[0]).filter(Boolean);
    const metrics = Object.fromEntries(binds.map((args) => [args[1], args[2]]));
    expect(metrics).toMatchObject({
      assistant_verified_claims_total: 3,
      assistant_unique_supporting_sources_total: 2
    });
    expect(metrics).not.toHaveProperty('assistant_single_source_verified_answers');
    expect(JSON.stringify(metrics)).not.toMatch(/private claim|private evidence/);
    spy.mockRestore();
  });

  it('persists only aggregate content-free timing counters', async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn() })) }));
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await recordAssistantOutcome({ ENVIRONMENT: 'staging', DB: { prepare, batch } }, {
      code: 'OK',
      durationMs: 100,
      stageTimings: { discover_ms: 11, evidence_pack_ms: 2, model_ms: 34, grounding_ms: 51, support_check_ms: 47, query: 'private query' }
    });
    const binds = prepare.mock.results.map((result) => result.value.bind.mock.calls[0]).filter(Boolean);
    const metricAmounts = Object.fromEntries(binds.map((args) => [args[1], args[2]]));
    expect(metricAmounts).toMatchObject({
      assistant_requests: 1,
      assistant_duration_ms_total: 100,
      assistant_discover_ms_total: 11,
      assistant_evidence_pack_ms_total: 2,
      assistant_model_ms_total: 34,
      assistant_grounding_ms_total: 51,
      assistant_support_check_ms_total: 47
    });
    expect(JSON.stringify(metricAmounts)).not.toContain('private query');
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
        support_check_ms: 47.2,
        query: 'private query',
        arbitrary_ms: 999
      }
    });
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(payload).toMatchObject({
      discover_ms: 11,
      evidence_pack_ms: 2,
      model_ms: 34,
      grounding_ms: 51,
      support_check_ms: 47
    });
    expect(payload).not.toHaveProperty('query');
    expect(payload).not.toHaveProperty('arbitrary_ms');
    spy.mockRestore();
  });
});