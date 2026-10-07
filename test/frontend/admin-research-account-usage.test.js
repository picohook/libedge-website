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
    expect(admin).toContain('Kurum Bazlı Kullanım');
    expect(admin).toContain('Kişi Bazlı Kullanım');
  });

  it('defaults to person usage and opens request drill-down from the person name', () => {
    const usersTab = admin.indexOf('id="researchUsageUsersTab"');
    const institutionsTab = admin.indexOf('id="researchUsageInstitutionsTab"');
    expect(usersTab).toBeGreaterThan(-1);
    expect(usersTab).toBeLessThan(institutionsTab);
    expect(admin).toContain('id="researchUsageUsersTab" role="tab" aria-controls="researchUsageUsersPanel" tabindex="0"');
    expect(admin).toContain('id="researchUsageInstitutionsPanel" role="tabpanel" aria-labelledby="researchUsageInstitutionsTab" class="hidden" hidden');
    expect(admin).not.toContain('<th class="text-right px-3">Detay</th>');
    expect(admin).toContain('data-research-request-user="');
    expect(admin).toContain('aria-expanded="false" aria-controls="researchRequestDrilldown-');
    expect(admin).toContain('<td colspan="9" class="px-4 py-3"></td>');
    expect(admin).toContain("trigger?.setAttribute('aria-expanded', 'true')");
    expect(admin).toContain("trigger?.setAttribute('aria-expanded', 'false')");
  });

  it('states that content/hash are excluded and exposes exact provider cost fields', () => {
    expect(admin).toContain('sorgu/yanıt içeriği ve hash gösterilmez');
    expect(admin).toContain('researchUsageValidEmptyRate');
    expect(admin).toContain('outcome_count_consistent');
    expect(admin).toContain('researchUsageLlmCost');
    expect(admin).toContain('researchUsageDiscoveryCost');
  });

  it('keeps loading superadmin-only', () => {
    expect(admin).toContain("async function loadResearchAccountUsage()");
    expect(admin).toContain("if (currentAdmin?.role !== 'super_admin') return;");
  });
});
