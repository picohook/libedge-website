import { describe, expect, it, vi } from 'vitest';
import {
  RESEARCH_USAGE_RETENTION_DAYS,
  recordResearchUsageEvent,
  pruneResearchUsageEvents,
  __test
} from '../../backend/src/research/usage-events.js';

function dbMock() {
  const run = vi.fn(async () => ({ success: true }));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind, run }));
  return { DB: { prepare }, prepare, bind, run };
}

describe('Research usage events', () => {
  it('records only the bounded content-free operational fields', async () => {
    const db = dbMock();
    const ok = await recordResearchUsageEvent(db, {
      userId: 42,
      institutionId: 7,
      operation: 'assistant_ask',
      outcomeCode: 'OK',
      latencyMs: 123.6,
      query: 'must never be accepted by SQL',
      answer: 'must never be accepted by SQL'
    });

    expect(ok).toBe(true);
    expect(db.prepare).toHaveBeenCalledTimes(1);
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('research_usage_events');
    expect(sql).not.toMatch(/\b(query|answer|claim|evidence|prompt|hash|payload)\b/i);
    expect(db.bind).toHaveBeenCalledWith(42, 7, 'assistant_ask', 'OK', 124, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
  });

  it('records allowlisted content-free retrieval diagnostics', async () => {
    const db = dbMock();
    await recordResearchUsageEvent(db, {
      userId: 42,
      outcomeCode: 'OK',
      retrievalDiagnostic: {
        retrieval_mode: 'lexical',
        candidate_depth: 50,
        retrieved_count: 10,
        authorized_relevant_count: 6,
        abstract_bearing_count: 1,
        metadata_only_count: 5,
        query: 'must not be stored'
      }
    });
    expect(db.bind).toHaveBeenCalledWith(
      42, null, 'assistant_ask', 'OK', 0, null, null, null, null, null, null, null, null,
      'lexical', 50, 10, 6, 1, 5
    );
    expect(db.prepare.mock.calls[0][0]).not.toMatch(/query|title|doi|claim|evidence_text|payload/i);
  });

  it('fails closed for missing user identity or unknown operation without touching D1', async () => {
    const db = dbMock();
    expect(await recordResearchUsageEvent(db, { operation: 'assistant_ask', outcomeCode: 'OK' })).toBe(false);
    expect(await recordResearchUsageEvent(db, { userId: 42, operation: 'unknown', outcomeCode: 'OK' })).toBe(false);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('sanitizes outcome codes and normalizes nullable institution ids', async () => {
    const db = dbMock();
    await recordResearchUsageEvent(db, {
      userId: 42,
      institutionId: 0,
      outcomeCode: 'bad value with spaces',
      latencyMs: -5
    });
    expect(db.bind).toHaveBeenCalledWith(42, null, 'assistant_ask', 'OTHER', 0, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
    expect(__test.safeOutcomeCode('GROUNDING_REJECTED')).toBe('GROUNDING_REJECTED');
  });

  it('uses explicit 90-day retention pruning', async () => {
    const db = dbMock();
    expect(RESEARCH_USAGE_RETENTION_DAYS).toBe(90);
    expect(await pruneResearchUsageEvents(db)).toBe(true);
    expect(db.prepare.mock.calls[0][0]).toContain("-90 days");
  });

  it('is best-effort when D1 writes fail', async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({ run: vi.fn(async () => { throw new Error('D1 unavailable'); }) })
        })
      }
    };
    expect(await recordResearchUsageEvent(env, { userId: 42, outcomeCode: 'OK', latencyMs: 1 })).toBe(false);
  });
});
