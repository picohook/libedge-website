import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const budget = fs.readFileSync('backend/src/assistant/support-check-invocation-budget.js', 'utf8');
const router = fs.readFileSync('backend/src/assistant/router.js', 'utf8');
const client = fs.readFileSync('backend/src/assistant/support-check-client.js', 'utf8');

describe('Assistant checker budget preflight contract', () => {
  it('defers non-reserving budget preflight to the live-verification callback so cache hits bypass it', () => {
    expect(budget).toContain('export async function preflightSupportCheckInvocation');
    const fnStart = budget.indexOf('export async function preflightSupportCheckInvocation');
    const fnEnd = budget.indexOf('export async function reserveSupportCheckInvocation');
    const preflight = budget.slice(fnStart, fnEnd);
    expect(preflight).toContain('RATE_LIMIT_KV.get');
    expect(preflight).not.toContain('RATE_LIMIT_KV.put');

    const callbackAt = router.indexOf('beforeLiveVerification: async () =>');
    const preflightAt = router.indexOf('await preflightSupportCheckInvocation', callbackAt);
    const orchestratorAt = router.indexOf('await orchestrateResearchAnswer');
    expect(orchestratorAt).toBeGreaterThan(-1);
    expect(callbackAt).toBeGreaterThan(orchestratorAt);
    expect(preflightAt).toBeGreaterThan(callbackAt);
    expect(router.slice(orchestratorAt, callbackAt)).toContain('orchestrateResearchAnswer');
  });

  it('keeps the authoritative reservation immediately inside checker transport', () => {
    expect(client).toContain('await reserveSupportCheckInvocation(env)');
    expect(budget).toContain('await env.RATE_LIMIT_KV.put');
  });
});
