import { describe, expect, it } from 'vitest';
import { sanitizeAssistantHistoryResult } from '../../backend/src/assistant/history-storage.js';

describe('assistant public result boundary', () => {
  it('strips known and future diagnostic fields while preserving user-facing result data for live and history boundaries', () => {
    const result = sanitizeAssistantHistoryResult({
      ok: true,
      code: 'OK',
      claims: [{ text: 'verified claim', evidence_ids: ['E1'] }],
      evidence: [{ evidence_id: 'E1', title: 'Evidence' }],
      research_summary: {
        literature: { retrieved_count: 3, authorized_relevant_count: 2, abstract_bearing_count: 1, metadata_only_count: 1 },
        verification: { checked_count: 1, verified_count: 1, truncated_count: 0 }
      },
      diagnostic_grounding: { claim_text: 'private claim', checked_count: 1 },
      diagnostic_usage: { input_tokens: 123 },
      diagnostic_future_private_surface: { query: 'private query', evidence_text: 'private evidence' }
    });

    expect(result).toEqual({
      ok: true,
      code: 'OK',
      claims: [{ text: 'verified claim', evidence_ids: ['E1'] }],
      evidence: [{ evidence_id: 'E1', title: 'Evidence' }],
      research_summary: {
        literature: { retrieved_count: 3, authorized_relevant_count: 2, abstract_bearing_count: 1, metadata_only_count: 1 },
        verification: { checked_count: 1, verified_count: 1, truncated_count: 0 }
      }
    });
    expect(JSON.stringify(result)).not.toContain('private claim');
    expect(JSON.stringify(result)).not.toContain('private query');
    expect(JSON.stringify(result)).not.toContain('private evidence');
  });

  it('fails safely for malformed stored payloads', () => {
    expect(sanitizeAssistantHistoryResult(null)).toEqual({});
    expect(sanitizeAssistantHistoryResult([])).toEqual({});
    expect(sanitizeAssistantHistoryResult('not-an-object')).toEqual({});
  });
});
