import { describe, it, expect } from 'vitest';

import { buildProxyLandingPath } from '../../backend/src/ra/proxy-url.js';

describe('buildProxyLandingPath', () => {
  it('normalizes landing paths without adding a trailing slash', () => {
    expect(buildProxyLandingPath('/research')).toBe('/research');
    expect(buildProxyLandingPath('research')).toBe('/research');
    expect(buildProxyLandingPath('/research/')).toBe('/research/');
    expect(buildProxyLandingPath('')).toBe('/');
    expect(buildProxyLandingPath(null)).toBe('/');
  });
});
