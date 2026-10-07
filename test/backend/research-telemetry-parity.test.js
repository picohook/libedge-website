import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESEARCH_TELEMETRY_METRICS } from '../../backend/src/research/telemetry.js';

const producer = fs.readFileSync('backend/src/assistant/telemetry.js', 'utf8');

function literalAssistantMetrics(source) {
  return [...new Set(
    [...source.matchAll(/['\"](assistant_[a-z0-9_]+)['\"]/g)].map((match) => match[1])
  )];
}

describe('Research telemetry producer/allowlist parity', () => {
  it('allows every literal Assistant metric emitted by the producer', () => {
    const allowlist = new Set(RESEARCH_TELEMETRY_METRICS);
    const missing = literalAssistantMetrics(producer).filter((name) => !allowlist.has(name));
    expect(missing).toEqual([]);
  });

  it('keeps normalization outcome/timing metrics persisted', () => {
    expect(RESEARCH_TELEMETRY_METRICS.has('assistant_query_normalization_ms_total')).toBe(true);
    expect(RESEARCH_TELEMETRY_METRICS.has('assistant_outcome_query_normalization_failed')).toBe(true);
  });
});
