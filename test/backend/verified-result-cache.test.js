import { describe, expect, it } from 'vitest';
import { verifiedResultCacheEnabled } from '../../backend/src/assistant/verified-result-cache.js';

describe('verified-result cache production guard', () => {
  it('is disabled by default', () => {
    expect(verifiedResultCacheEnabled({})).toBe(false);
  });

  it('can be explicitly enabled outside production', () => {
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'staging', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(true);
  });

  it('is forced off in production even when the flag is true', () => {
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'production', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
    expect(verifiedResultCacheEnabled({ ENVIRONMENT: 'PRODUCTION', RESEARCH_VERIFIED_RESULT_CACHE_ENABLED: 'true' })).toBe(false);
  });
});
