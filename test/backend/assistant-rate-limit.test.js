import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const router = fs.readFileSync('backend/src/assistant/router.js', 'utf8');
const wrangler = fs.readFileSync('wrangler.toml', 'utf8');

describe('Assistant per-user rate-limit contract', () => {
  it('checks a dedicated Assistant quota before provider/orchestrator work', () => {
    expect(router).toContain("checkProtectedRateLimit(c, 'assistant-ask', identifier, limit, windowSeconds)");
    expect(router).toContain("code: 'ASSISTANT_RATE_LIMITED'");
    const quotaAt = router.indexOf("checkProtectedRateLimit(c, 'assistant-ask'");
    const providerAt = router.indexOf('const providerGate = providerGateFromEnv');
    const orchestratorAt = router.indexOf('const result = await orchestrateResearchAnswer');
    expect(quotaAt).toBeGreaterThan(-1);
    expect(quotaAt).toBeLessThan(providerAt);
    expect(quotaAt).toBeLessThan(orchestratorAt);
  });

  it('uses user identity and dedicated configurable limits', () => {
    expect(router).toContain("auth.user?.user_id || auth.user?.sub || auth.user?.email || 'authenticated'");
    expect(router).toContain('RESEARCH_ASSISTANT_USER_RATE_LIMIT');
    expect(router).toContain('RESEARCH_ASSISTANT_USER_RATE_WINDOW_SECONDS');
    expect(wrangler).toContain('RESEARCH_ASSISTANT_USER_RATE_LIMIT = "10"');
    expect(wrangler).toContain('RESEARCH_ASSISTANT_USER_RATE_WINDOW_SECONDS = "300"');
  });
});
