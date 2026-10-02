import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const migration = fs.readFileSync('migrations/0056_research_usage_exact_costs.sql', 'utf8');
const adapter = fs.readFileSync('backend/src/assistant/bedrock-model-adapter.js', 'utf8');
const discover = fs.readFileSync('backend/src/research/discover.js', 'utf8');
const orchestrator = fs.readFileSync('backend/src/research/assistant-orchestrator.js', 'utf8');
const usage = fs.readFileSync('backend/src/research/usage-events.js', 'utf8');
const backend = fs.readFileSync('backend/src/index.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

describe('Research exact provider cost attribution', () => {
  it('keeps exact LLM and discovery costs as separate content-free fields', () => {
    expect(migration).toContain('llm_cost_usd');
    expect(migration).toContain('discovery_cost_usd');
    expect(migration).not.toMatch(/checker|estimated_cost|query|answer|claim|prompt/i);
    expect(usage).toContain('llmCostUsd');
    expect(usage).toContain('discoveryCostUsd');
  });

  it('prices current standard Sonnet 4.6 token usage without checker estimates', () => {
    expect(adapter).toContain('DEFAULT_INPUT_USD_PER_MILLION_TOKENS = 3');
    expect(adapter).toContain('DEFAULT_OUTPUT_USD_PER_MILLION_TOKENS = 15');
    expect(adapter).toContain('llm_cost_usd: exactUsageCostUsd(payload?.usage)');
  });

  it('carries provider requestCostUsd only as non-enumerable Assistant diagnostic metadata', () => {
    expect(discover).toContain("'diagnostic_discovery_cost_usd'");
    expect(discover).toContain('enumerable: false');
    expect(orchestrator).toContain('diagnostic_costs');
  });

  it('aggregates and labels both exact components separately in superadmin Research usage', () => {
    expect(backend).toContain('SUM(e.llm_cost_usd)');
    expect(backend).toContain('SUM(e.discovery_cost_usd)');
    expect(admin).toContain('LLM exact cost');
    expect(admin).toContain('Discovery exact cost');
    expect(admin).toContain('checker hosting tahmini dahil değildir');
  });
});
