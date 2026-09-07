import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const admin = readFileSync('admin.html', 'utf8');
const healthUi = readFileSync('assets/js/admin-health.js', 'utf8');
const worker = readFileSync('backend/src/worker.js', 'utf8');

describe('admin system health regression coverage', () => {
  it('replaces all obsolete remote-access tunnel KPIs', () => {
    expect(admin).toContain('id="systemHealthCard"');
    expect(admin).toContain('id="systemHealthStatus"');
    expect(admin).toContain('assets/js/admin-health.js?v=20260907a');
    expect(admin).not.toContain('statActiveTunnels');
    expect(admin).not.toContain('settingsStatTunnels');
    expect(admin).not.toContain('Aktif Tünel');
  });

  it('routes the super-admin health endpoint through the Worker wrapper', () => {
    expect(worker).toContain("'/api/admin/system-health'");
    expect(worker).toContain('handleSystemHealthRequest');
  });

  it('keeps the health UI sanitized and read-only', () => {
    expect(healthUi).toContain("fetch(API_URL, { credentials: 'include', cache: 'no-store' })");
    expect(healthUi).toContain('replaceChildren(');
    expect(healthUi).not.toContain('.innerHTML =');
    expect(healthUi).not.toContain('localStorage');
  });
});
