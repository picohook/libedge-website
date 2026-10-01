import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const budget = fs.readFileSync('backend/src/assistant/support-check-invocation-budget.js', 'utf8');
const router = fs.readFileSync('backend/src/assistant/router.js', 'utf8');
const client = fs.readFileSync('backend/src/assistant/support-check-client.js', 'utf8');

describe('Assistant checker budget preflight contract', () => {
  it('preflights budget before provider/model/orchestrator work without incrementing it', () => {
    expect(budget).toContain('export async function preflightSupportCheckInvocation');
    const fnStart = budget.indexOf('export async function preflightSupportCheckInvocation');
    const fnEnd = budget.indexOf('export async function reserveSupportCheckInvocation');
    const preflight = budget.slice(fnStart, fnEnd);
    expect(preflight).toContain('RATE_LIMIT_KV.get');
    expect(preflight).not.toContain('RATE_LIMIT_KV.put');

    const preflightAt = router.indexOf('await preflightSupportCheckInvocation');
    const modelAt = router.indexOf('createBedrockModelAdapter');
    const orchestratorAt = router.indexOf('await orchestrateResearchAnswer');
    expect(preflightAt).toBeGreaterThan(-1);
    expect(preflightAt).toBeLessThan(modelAt);
    expect(preflightAt).toBeLessThan(orchestratorAt);
  });

  it('keeps the authoritative reservation immediately inside checker transport', () => {
    expect(client).toContain('await reserveSupportCheckInvocation(env)');
    expect(budget).toContain('await env.RATE_LIMIT_KV.put');
  });
});
