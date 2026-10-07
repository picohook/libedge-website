import { describe, expect, it } from 'vitest';
import { RESEARCH_TELEMETRY_METRICS } from '../../backend/src/research/telemetry.js';

describe('Research telemetry normalization metric allowlist', () => {
  it('persists the Assistant normalization timing and failure outcome metrics', () => {
    expect(RESEARCH_TELEMETRY_METRICS.has('assistant_query_normalization_ms_total')).toBe(true);
    expect(RESEARCH_TELEMETRY_METRICS.has('assistant_outcome_query_normalization_failed')).toBe(true);
  });
});
