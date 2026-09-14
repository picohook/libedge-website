import { describe, expect, it } from 'vitest';
import { buildResearchObservationLog } from '../../backend/src/research/router.js';

describe('research observability payload', () => {
  it('contains only the reviewed minimal fields', () => {
    const payload = buildResearchObservationLog(429, 61_000, 62_234);

    expect(payload).toEqual({
      event: 'research_request_observed',
      timestamp_bucket: 1,
      path_class: 'research_search',
      status_class: '4xx',
      duration_ms: 1234,
    });

    expect(Object.keys(payload).sort()).toEqual([
      'duration_ms',
      'event',
      'path_class',
      'status_class',
      'timestamp_bucket',
    ]);
  });

  it('never carries request-derived content into the structured payload', () => {
    const payload = buildResearchObservationLog(200, 120_000, 120_045);
    const serialized = JSON.stringify(payload).toLowerCase();

    for (const forbidden of [
      'query',
      'authorization',
      'cookie',
      'header',
      'user_id',
      'email',
      'ip',
      'asn',
      'geolocation',
      'provider',
      'model',
      'body',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('coarsens status and time while keeping duration non-negative', () => {
    expect(buildResearchObservationLog(401, 120_050, 120_000)).toEqual({
      event: 'research_request_observed',
      timestamp_bucket: 2,
      path_class: 'research_search',
      status_class: '4xx',
      duration_ms: 0,
    });
  });
});
