import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/supportcheck-staging-lifecycle.yml', 'utf8');
const deploy = fs.readFileSync('scripts/supportcheck-deploy-sagemaker.sh', 'utf8');

describe('SupportCheck staging lifecycle governance', () => {
  it('is staging-only and uses OIDC rather than long-lived AWS keys', () => {
    expect(workflow).toContain('environment: staging');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('SUPPORTCHECK_STAGING_LIFECYCLE_ROLE_ARN');
    expect(workflow).not.toMatch(/AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|production/i);
  });

  it('publishes only content-free infrastructure state to staging KV', () => {
    expect(workflow).toContain('assistant:supportcheck:infrastructure-state');
    expect(workflow).toContain('available');
    expect(workflow).toContain('unavailable');
    expect(workflow).toContain('unknown');
    expect(workflow).toContain('--env staging --remote');
    expect(workflow).not.toMatch(/query|claim|evidence_text|doi/i);
  });

  it('verifies privacy invariants and keeps deploy idempotent', () => {
    expect(workflow).toContain('EnableNetworkIsolation');
    expect(workflow).toContain('DataCaptureConfig.EnableCapture');
    expect(workflow).toContain('@sha256:');
    expect(deploy).toContain('describe-endpoint');
    expect(deploy).toContain('Endpoint already exists; verifying invariants');
  });
});
