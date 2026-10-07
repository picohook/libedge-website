import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESEARCH_TELEMETRY_METRICS } from '../../backend/src/research/telemetry.js';

const producer = fs.readFileSync('backend/src/assistant/telemetry.js', 'utf8');

describe('Research telemetry producer/allowlist parity', () => {
  it('allows every literal Assistant metric emitted by the producer', () => {
    const literals = [...producer.matchAll(/['\"](assistant_[a-z0-9_]+)['\"]/g)].map((match) => match[1]);
    const emitted = [...new Set(literals.filter((name) =>
      name !== 'assistant_model_failure_other' || producer.includes(name)
    ))];
    const allowlist = new Set(RESEARCH_TELEMETRY_METRICS);
    const missing = emitted.filter((name) => !allowlist.has(name) && !name.endsWith('_outcome_'));
    expect(missing).toEqual([]);
  });

  it('keeps normalization outcome/timing metrics persisted', () => {
    expect(RESEARCH_TELEMETRY_METRICS.has('assistant_query_normalization_ms_total')).toBe(true);
    expect(RESEARCH_TELEMETRY_METRICS.has('assistant_outcome_query_normalization_failed')).toBe(true);
  });
});
