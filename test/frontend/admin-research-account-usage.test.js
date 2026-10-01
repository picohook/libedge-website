import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Research account usage admin UI', () => {
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('loads bounded content-free account and institution aggregates', () => {
    expect(admin).toContain('/api/admin/research/usage?days=');
    expect(admin).toContain('id="researchUsageDays"');
    expect(admin).toContain('id="researchUsageUsers"');
    expect(admin).toContain('id="researchUsageInstitutions"');
    expect(admin).toContain('90 gün retention');
  });

  it('states that content/hash and non-deterministic cost are excluded', () => {
    expect(admin).toContain('sorgu/yanıt içeriği ve hash gösterilmez');
    expect(admin).toContain('Maliyet, deterministik kaynak olmadığı için gösterilmez');
  });

  it('keeps loading superadmin-only', () => {
    expect(admin).toContain("async function loadResearchAccountUsage()");
    expect(admin).toContain("if (currentAdmin?.role !== 'super_admin') return;");
  });
});
