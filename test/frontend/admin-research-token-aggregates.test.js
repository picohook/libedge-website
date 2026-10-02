import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('superadmin Research token aggregates', () => {
  const backend = fs.readFileSync('backend/src/index.js', 'utf8');
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('aggregates input/output tokens alongside separately attributed exact costs', () => {
    expect(backend).toContain('COALESCE(SUM(e.input_tokens), 0) AS input_tokens');
    expect(backend).toContain('COALESCE(SUM(e.output_tokens), 0) AS output_tokens');
  });

  it('renders factual token volumes in the Research admin view', () => {
    expect(admin).toContain('researchUsageInputTokens');
    expect(admin).toContain('researchUsageOutputTokens');
    expect(admin).toContain('Number(row.input_tokens || 0) + Number(row.output_tokens || 0)');
    expect(admin).toContain('researchUsageLlmCost');
    expect(admin).toContain('researchUsageDiscoveryCost');
  });
});
