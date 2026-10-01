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

  it('keeps separate Research search traffic out of the Assistant layer breakdown', () => {
    expect(admin).not.toContain("['Research istekleri', metrics.research_requests]");
    expect(admin).toContain("['Discover hatası', metrics.assistant_outcome_discover_failed]");
  });

  it('logs the underlying usage-load error for super-admin diagnosis', () => {
    expect(admin).toContain("console.error('Research account/institution usage load failed', error)");
    expect(admin).toContain('Hesap/kurum kullanım verisi alınamadı.');
  });

  it('keeps loading superadmin-only', () => {
    expect(admin).toContain("async function loadResearchAccountUsage()");
    expect(admin).toContain("if (currentAdmin?.role !== 'super_admin') return;");
  });
});
