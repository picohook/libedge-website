import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('superadmin registration toggle UI', () => {
  const html = fs.readFileSync('admin.html', 'utf8');

  it('shows an explicit registration control and uses the admin endpoint', () => {
    expect(html).toContain('id="registrationControlCard"');
    expect(html).toContain('id="registrationToggleBtn"');
    expect(html).toContain('/api/admin/registration-state');
    expect(html).toContain("currentAdmin?.role === 'super_admin'");
    expect(html).toContain('Kayıtları Kapat');
    expect(html).toContain('Kayıtları Aç');
  });
});
