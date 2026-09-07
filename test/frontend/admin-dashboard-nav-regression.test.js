import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const admin = readFileSync('admin.html', 'utf8');
const nav = readFileSync('assets/js/admin-dashboard-nav.js', 'utf8');

describe('admin dashboard navigation regression coverage', () => {
  it('loads the dashboard navigation helper from admin.html', () => {
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

  it('makes action-required items actionable without inventing unsupported filters', () => {
    expect(nav).toContain('const ACTION_LINKS = {');
    expect(nav).toContain('pending_requests: {');
    expect(nav).toContain('users_without_institution: {');
    expect(nav).toContain('expiring_subscriptions: {');
    expect(nav).toContain("filters: { requestsStatusFilter: 'pending' }");
    expect(nav).toContain("resetFilters: ['userSearchInput', 'userRoleFilter', 'userInstitutionFilter']");
    expect(nav).toContain("resetFilters: ['subscriptionSearchInput', 'subscriptionTypeFilter', 'subscriptionStatusFilter']");
    expect(nav).toContain('wrapActionRenderer()');
    expect(nav).toContain('bindActionRows(items)');
  });

  it('links activity feed entries to the appropriate admin sections', () => {
    expect(nav).toContain('const ACTIVITY_LINKS = {');
    expect(nav).toContain("user: {");
    expect(nav).toContain("institution: {");
    expect(nav).toContain("announcement: {");
    expect(nav).toContain("subscription: {");
    expect(nav).toContain("institution_subscription: {");
    expect(nav).toContain("searchId: 'userSearchInput'");
    expect(nav).toContain("searchId: 'institutionSearchInput'");
    expect(nav).toContain("searchId: 'subscriptionSearchInput'");
    expect(nav).toContain('wrapActivityRenderer()');
    expect(nav).toContain('bindActivityRows(items)');
  });

  it('keeps dashboard navigation keyboard accessible and leaves system health independent', () => {
    expect(nav).toContain("card.setAttribute('role', 'link')");
    expect(nav).toContain("card.setAttribute('tabindex', '0')");
    expect(nav).toContain("row.setAttribute('role', 'link')");
    expect(nav).toContain("row.setAttribute('tabindex', '0')");
    expect(nav).toContain("event.key === 'Enter' || event.key === ' '");
    expect(nav).toContain("card.id === 'systemHealthCard'");
    expect(nav).not.toContain('.innerHTML');
  });
});
