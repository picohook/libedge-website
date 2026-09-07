import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const admin = readFileSync('admin.html', 'utf8');
const nav = readFileSync('assets/js/admin-dashboard-nav.js', 'utf8');

describe('admin dashboard KPI navigation regression coverage', () => {
  it('loads the KPI navigation helper from admin.html', () => {
    expect(admin).toContain('assets/js/admin-dashboard-nav.js?v=20260907b');
  });

  it('maps the overview KPIs to their real admin tabs', () => {
    expect(nav).toContain("{ valueId: 'statUsers', tab: 'users'");
    expect(nav).toContain("{ valueId: 'statSubscriptions', tab: 'subscriptions'");
    expect(nav).toContain("{ valueId: 'statInstitutions', tab: 'institutions'");
    expect(nav).toContain("{ valueId: 'statPublishedAnnouncements', tab: 'announcements'");
    expect(nav).toContain("valueId: 'statPendingRequests'");
    expect(nav).toContain("valueId: 'statTrials'");
    expect(nav).toContain("tab: 'requests'");
  });

  it('opens request KPIs with the matching filter and clears stale request filters first', () => {
    expect(nav).toContain("resetFilters: ['requestsTypeFilter', 'requestsStatusFilter']");
    expect(nav).toContain("filters: { requestsStatusFilter: 'pending' }");
    expect(nav).toContain("filters: { requestsTypeFilter: 'trial' }");
    expect(nav).toContain('applyFilters(resetFilters, filters)');
    expect(nav).toContain("if (element) element.value = ''");
  });

  it('keeps KPI navigation keyboard accessible and leaves system health independent', () => {
    expect(nav).toContain("card.setAttribute('role', 'link')");
    expect(nav).toContain("card.setAttribute('tabindex', '0')");
    expect(nav).toContain("event.key === 'Enter' || event.key === ' '");
    expect(nav).toContain("card.id === 'systemHealthCard'");
    expect(nav).not.toContain('.innerHTML');
  });
});
