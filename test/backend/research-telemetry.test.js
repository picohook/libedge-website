import { describe, expect, it } from 'vitest';
import {
  RESEARCH_TELEMETRY_METRICS,
  pruneResearchTelemetry,
  readResearchTelemetrySnapshot,
  recordResearchMetric,
  recordResearchMetrics,
  recordSemanticTelemetry
} from '../../backend/src/research/telemetry.js';

function createD1() {
  const rows = new Map();
  const observedBinds = [];

  function statement(sql, args = []) {
    return {
      bind(...nextArgs) {
        observedBinds.push(nextArgs);
        return statement(sql, nextArgs);
      },
      async run() {
        if (sql.includes('INSERT INTO research_telemetry_counters')) {
          const [date, metric, amount] = args;
          const key = `${date}|${metric}`;
          rows.set(key, (rows.get(key) || 0) + Number(amount));
          return { success: true };
        }
        if (sql.includes('DELETE FROM research_telemetry_counters')) {
          const [cutoff] = args;
          for (const key of [...rows.keys()]) {
            if (key.split('|')[0] < cutoff) rows.delete(key);
          }
          return { success: true };
        }
        return { success: true };
      },
      async all() {
        if (sql.includes('SELECT metric, value FROM research_telemetry_counters')) {
          const [date] = args;
          return {
            results: [...rows.entries()]
              .filter(([key]) => key.startsWith(`${date}|`))
              .map(([key, value]) => ({ metric: key.split('|')[1], value }))
          };
        }
        return { results: [] };
      }
    };
  }

  return {
    prepare(sql) { return statement(sql); },
    async batch(statements) {
      const results = [];
      for (const item of statements) results.push(await item.run());
      return results;
    },
    rows,
    observedBinds
  };
}

describe('research telemetry D1 counters', () => {
  it('A: preserves exact concurrent same-metric increments', async () => {
    const db = createD1();
    const env = { DB: db };
    const now = new Date('2026-09-11T12:00:00.000Z');

    await Promise.all([
      recordResearchMetric(env, 'semantic_successes', 1, now),
      recordResearchMetric(env, 'semantic_successes', 1, now),
      recordResearchMetric(env, 'semantic_successes', 1, now)
    ]);

    const snapshot = await readResearchTelemetrySnapshot(env, now);
    expect(snapshot.metrics.semantic_successes).toBe(3);
  });

  it('B: preserves exact mixed positive deltas', async () => {
    const db = createD1();
    const env = { DB: db };
    const now = new Date('2026-09-11T12:00:00.000Z');

    await Promise.all([
      recordResearchMetric(env, 'semantic_pacing_wait_ms_total', 100, now),
      recordResearchMetric(env, 'semantic_pacing_wait_ms_total', 250, now),
      recordResearchMetric(env, 'semantic_pacing_wait_ms_total', 1150, now)
    ]);

    const snapshot = await readResearchTelemetrySnapshot(env, now);
    expect(snapshot.metrics.semantic_pacing_wait_ms_total).toBe(1500);
  });

  it('C: ignores unsupported metrics and returns exactly the shared allowlist', async () => {
    const db = createD1();
    const env = { DB: db };
    const now = new Date('2026-09-11T12:00:00.000Z');

    await recordResearchMetric(env, 'not_allowed_metric', 99, now);
    await recordResearchMetric(env, 'semantic_successes', 2, now);

    const snapshot = await readResearchTelemetrySnapshot(env, now);
    expect(Object.keys(snapshot.metrics).sort()).toEqual([...RESEARCH_TELEMETRY_METRICS].sort());
    expect(snapshot.metrics.semantic_successes).toBe(2);
    expect([...db.rows.keys()].some((key) => key.includes('not_allowed_metric'))).toBe(false);
  });

  it('D: persists only date, allowlisted metric and numeric deltas', async () => {
    const db = createD1();
    const env = { DB: db };
    const now = new Date('2026-09-11T12:00:00.000Z');

    await recordSemanticTelemetry(env, { requestCostUsd: 0.001, requestCredits: 10 }, now);

    const material = JSON.stringify(db.observedBinds).toLowerCase();
    expect(material).not.toContain('query');
    expect(material).not.toContain('email');
    expect(material).not.toContain('topic');
    expect(material).not.toContain('doi');
    expect(material).not.toContain('title');
    expect(material).not.toContain('result');
    expect(material).not.toContain('provider');

    const snapshot = await readResearchTelemetrySnapshot(env, now);
    expect(snapshot.metrics.semantic_charged_responses).toBe(1);
    expect(snapshot.metrics.semantic_cost_microusd_total).toBe(1000);
    expect(snapshot.metrics.semantic_credits_total).toBe(10);
  });

  it('E: isolates UTC-day buckets', async () => {
    const db = createD1();
    const env = { DB: db };
    const day1 = new Date('2026-09-11T23:59:59.000Z');
    const day2 = new Date('2026-09-12T00:00:01.000Z');

    await recordResearchMetric(env, 'semantic_attempts', 2, day1);
    await recordResearchMetric(env, 'semantic_attempts', 5, day2);

    expect((await readResearchTelemetrySnapshot(env, day1)).metrics.semantic_attempts).toBe(2);
    expect((await readResearchTelemetrySnapshot(env, day2)).metrics.semantic_attempts).toBe(5);
  });

  it('I: keeps cross-metric semantic success invariant under concurrency', async () => {
    const db = createD1();
    const env = { DB: db };
    const now = new Date('2026-09-11T12:00:00.000Z');
    const count = 25;

    await Promise.all(Array.from({ length: count }, () => (
      recordResearchMetrics(env, [
        ['semantic_attempts', 1],
        ['semantic_successes', 1]
      ], now)
    )));

    const snapshot = await readResearchTelemetrySnapshot(env, now);
    expect(snapshot.metrics.semantic_successes).toBeLessThanOrEqual(snapshot.metrics.semantic_attempts);
    expect(snapshot.metrics.semantic_attempts).toBe(count);
    expect(snapshot.metrics.semantic_successes).toBe(count);
  });

  it('prunes rows older than the retained eight UTC-day buckets', async () => {
    const db = createD1();
    const env = { DB: db };
    await recordResearchMetric(env, 'semantic_attempts', 1, new Date('2026-09-03T12:00:00Z'));
    await recordResearchMetric(env, 'semantic_attempts', 2, new Date('2026-09-04T12:00:00Z'));
    await recordResearchMetric(env, 'semantic_attempts', 3, new Date('2026-09-11T12:00:00Z'));

    await pruneResearchTelemetry(env, new Date('2026-09-11T12:00:00Z'));

    expect((await readResearchTelemetrySnapshot(env, new Date('2026-09-03T12:00:00Z'))).metrics.semantic_attempts).toBe(0);
    expect((await readResearchTelemetrySnapshot(env, new Date('2026-09-04T12:00:00Z'))).metrics.semantic_attempts).toBe(2);
    expect((await readResearchTelemetrySnapshot(env, new Date('2026-09-11T12:00:00Z'))).metrics.semantic_attempts).toBe(3);
  });

  it('ignores negative, zero, and nonnumeric metric amounts', async () => {
    const db = createD1();
    const env = { DB: db };
    await recordResearchMetric(env, 'semantic_successes', -1);
    await recordResearchMetric(env, 'semantic_successes', 0);
    await recordResearchMetric(env, 'semantic_successes', 'NaN');
    expect(db.rows.size).toBe(0);
  });
});
