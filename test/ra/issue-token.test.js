import { describe, it, expect } from 'vitest';

import { buildProxyLandingPath, stableProxyHostLabel } from '../../backend/src/ra/proxy-url.js';

describe('buildProxyLandingPath', () => {
  it('normalizes landing paths without adding a trailing slash', () => {
    expect(buildProxyLandingPath('/research')).toBe('/research');
    expect(buildProxyLandingPath('research')).toBe('/research');
    expect(buildProxyLandingPath('/research/')).toBe('/research/');
    expect(buildProxyLandingPath('')).toBe('/');
    expect(buildProxyLandingPath(null)).toBe('/');
  });
});

describe('stableProxyHostLabel', () => {
  it('creates a deterministic 40-character product host label', async () => {
    const a = await stableProxyHostLabel('emerald-premier', 'www.emerald.com');
    const b = await stableProxyHostLabel('Emerald-Premier', 'WWW.EMERALD.COM');

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{40}$/);
  });
});
