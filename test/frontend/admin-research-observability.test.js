import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Research admin observability', () => {
  const health = fs.readFileSync('backend/src/system-health.js', 'utf8');
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('reports content-free checker pause and daily budget state to superadmins', () => {
    expect(health).toContain('SUPPORT_CHECK_PAUSE_KEY');
    expect(health).toContain('supportCheckInvocationKey()');
    expect(health).toContain('daily_invocations_used');
    expect(health).toContain('daily_invocation_limit');
    expect(health).toContain('support_check: supportCheck');
  });

  it('renders checker state without adding a mutation control', () => {
    expect(admin).toContain('async function loadSystemHealth()');
    expect(admin).toContain('/api/admin/system-health');
    expect(admin).toContain('Checker: duraklatıldı');
    expect(admin).toContain('daily_invocations_used');
    expect(admin).not.toContain('/api/admin/support-check/pause');
  });
});
