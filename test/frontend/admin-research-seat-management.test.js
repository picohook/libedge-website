import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Research institution seat management UI', () => {
  const admin = fs.readFileSync('admin.html', 'utf8');
  const backend = fs.readFileSync('backend/src/index.js', 'utf8');

  it('shows quota usage and exposes seat management only outside read-only preview', () => {
    expect(admin).toContain('Research erişimi:');
    expect(admin).toContain("'Unlimited'");
    expect(admin).toContain('subscriptionEditorAccessMode');
    expect(admin).toContain('Maximum users');
    expect(admin).toContain('openResearchSeatManager');
    expect(admin).toContain("!inst.preview?.read_only");
    expect(admin).toContain("currentAdmin?.role === 'super_admin' && _institutionPreview.id");
  });

  it('uses server-scoped seat APIs for assignment and revocation', () => {
    expect(admin).toContain('/api/admin/research-seats/');
    expect(admin).toContain("method: input.checked ? 'POST' : 'DELETE'");
    expect(admin).toContain('/api/admin/users?');
    expect(admin).toContain("page_size: String(pageSize)");
    expect(admin).toContain("params.set('search', q)");
    expect(admin).toContain("filter === 'assigned'");
    expect(admin).not.toContain("document.querySelectorAll('#myInstRecentUsers tr[data-user-id]')");
    expect(backend).toContain("app.post('/api/admin/research-seats/:subscriptionId/:userId'");
    expect(backend).toContain("app.delete('/api/admin/research-seats/:subscriptionId/:userId'");
  });

  it('returns seat quota and assigned usage in institution subscription summary', () => {
    expect(backend).toContain('is2.seat_limit');
    expect(backend).toContain('AS assigned_seats');
    expect(admin).toContain("s.seat_limit == null ? 'Unlimited'");
    expect(admin).toContain("s.seat_limit != null && !inst.preview?.read_only");
  });
});
