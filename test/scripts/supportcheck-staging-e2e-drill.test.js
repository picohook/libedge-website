import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('SupportCheck staging E2E drill', () => {
  const workflow = fs.readFileSync('.github/workflows/supportcheck-staging-e2e-drill.yml', 'utf8');
  const smoke = fs.readFileSync('scripts/assistant-success-smoke.mjs', 'utf8');

  it('requires explicit staging confirmation and always re-pauses', () => {
    expect(workflow).toContain('SUPPORTCHECK-STAGING-E2E-DRILL');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('"assistant:supportcheck:paused" "resume"');
    expect(workflow).toContain('"assistant:supportcheck:paused" "true"');
    expect(workflow).toContain('--env staging --remote');
  });

  it('requires authorized access plus grounded claims and evidence', () => {
    expect(smoke).toContain('access.body.allowed === true');
    expect(smoke).toContain('answer.ok === true');
    expect(smoke).toContain('answer.claims.length > 0');
    expect(smoke).toContain('answer.evidence.length > 0');
  });
});
