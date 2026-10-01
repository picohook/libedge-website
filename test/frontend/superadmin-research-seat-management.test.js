import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('superadmin Research seat management', () => {
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('shows Kurumum to a superadmin with an institution', () => {
    expect(admin).toContain("isAdmin || (isSuperAdmin && user.institution)");
    expect(admin).toContain("show('myInstitutionTab')");
  });

  it('exposes seat management from global institution Research subscriptions', () => {
    expect(admin).toContain("s.type === 'institution' && s.product_slug === 'research' && s.seat_limit != null");
    expect(admin).toContain('subscription-seat-btn');
    expect(admin).toContain('openResearchSeatManager(subscriptionId, Number(seatBtn.dataset.seatLimit))');
  });

  it('keeps institution preview seat mutations blocked for superadmin', () => {
    expect(admin).toContain("if (currentAdmin?.role === 'super_admin' && _institutionPreview.id) return;");
  });
});
