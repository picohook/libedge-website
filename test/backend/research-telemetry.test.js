import { describe, expect, it } from 'vitest';
import { recordResearchMetric, recordSemanticTelemetry, researchTelemetryMetricKey } from '../../backend/src/research/telemetry.js';

function createKv() {
  const store = new Map();
  return {
    async get(key) { return store.get(key) ?? null; },
    async put(key, value, options) { store.set(key, value); store.set(`${key}:ttl`, options?.expirationTtl ?? null); },
    store
  };
}

describe('research telemetry', () => {
  it('stores only allowlisted aggregate numeric counters under date-scoped keys', async () => {
    const kv = createKv();
    const env = { RATE_LIMIT_KV: kv };
    const now = new Date('2026-09-11T12:00:00.000Z');

    await recordResearchMetric(env, 'semantic_successes', 2, now);
    await recordResearchMetric(env, 'semantic_successes', 3, now);
    await recordResearchMetric(env, 'not_allowed_metric', 99, now);

    const key = researchTelemetryMetricKey('semantic_successes', now);
    expect(kv.store.get(key)).toBe('5');
    expect(key).toBe('research:telemetry:v1:2026-09-11:semantic_successes');
    expect([...kv.store.keys()].some((item) => item.includes('not_allowed_metric'))).toBe(false);
  });

  it('records charged semantic cost and credits as aggregates without research-interest fields', async () => {
    const kv = createKv();
    const env = { RATE_LIMIT_KV: kv };
    const now = new Date('2026-09-11T12:00:00.000Z');

    await recordSemanticTelemetry(env, { requestCostUsd: 0.001, requestCredits: 10 }, now);

    const material = JSON.stringify([...kv.store.entries()]);
    expect(material).toContain('semantic_charged_responses');
    expect(material).toContain('semantic_cost_microusd_total');
    expect(material).toContain('semantic_credits_total');
    expect(kv.store.get(researchTelemetryMetricKey('semantic_charged_responses', now))).toBe('1');
    expect(kv.store.get(researchTelemetryMetricKey('semantic_cost_microusd_total', now))).toBe('1000');
    expect(kv.store.get(researchTelemetryMetricKey('semantic_credits_total', now))).toBe('10');
    expect(material).not.toContain('green hydrogen');
    expect(material).not.toContain('researcher@example.test');
    expect(material).not.toContain('10.1000/');
  });

  it('ignores negative or nonnumeric metric amounts', async () => {
    const kv = createKv();
    const env = { RATE_LIMIT_KV: kv };
    await recordResearchMetric(env, 'semantic_successes', -1);
    await recordResearchMetric(env, 'semantic_successes', 'NaN');
    expect([...kv.store.keys()]).toHaveLength(0);
  });
});
