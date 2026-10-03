import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { __test as usageTest } from '../../backend/src/research/usage-events.js';
import { __test as bedrockTest } from '../../backend/src/assistant/bedrock-model-adapter.js';

describe('Research token usage metering', () => {
  it('extracts token counts and deterministic LLM cost from a Bedrock payload', () => {
    const result = bedrockTest.parseClaimsPayload({
      content: [{ type: 'text', text: '{"claims":[]}' }],
      usage: { input_tokens: 123, output_tokens: 45 }
    });
    expect(result).toEqual({ claims: [], usage: { input_tokens: 123, output_tokens: 45, llm_cost_usd: 0.001044 } });
  });

  it('sanitizes optional token counts', () => {
    expect(usageTest.optionalNonNegativeInteger(0)).toBe(0);
    expect(usageTest.optionalNonNegativeInteger('42')).toBe(42);
    expect(usageTest.optionalNonNegativeInteger(-1)).toBeNull();
    expect(usageTest.optionalNonNegativeInteger(1.5)).toBeNull();
    expect(usageTest.optionalNonNegativeInteger(undefined)).toBeNull();
  });

  it('keeps the migration content-free and nullable', () => {
    const migration = fs.readFileSync('migrations/0052_research_usage_token_counts.sql', 'utf8');
    expect(migration).toContain('input_tokens INTEGER');
    expect(migration).toContain('output_tokens INTEGER');
    for (const forbidden of ['query', 'answer', 'prompt', 'evidence', 'input_hash', 'output_hash']) {
      expect(migration.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('strips internal usage diagnostics before the API response', () => {
    const router = fs.readFileSync('backend/src/assistant/router.js', 'utf8');
    expect(router).toContain('sanitizeAssistantHistoryResult(result)');
  });
});
