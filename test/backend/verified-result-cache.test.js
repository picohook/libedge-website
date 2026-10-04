import { describe, expect, it } from 'vitest';
import { verifiedResultCacheEnabled } from '../../backend/src/assistant/verified-result-cache.js';

describe('verified-result cache production guard', () => {
  it('is disabled by default', () => {
    expect(verifiedResultCacheEnabled({})).toBe(false);
  });

  it('can be explicitly enabled only in staging/local', () => {
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'staging', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(true);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'local', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(true);
  });

  it('fails closed for production, missing and unknown environments even when the flag is true', () => {
    expect(verifiedResultCacheEnabled({ RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'prod', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'production', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'PRODUCTION', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
  });
});
