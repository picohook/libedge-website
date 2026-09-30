import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('superadmin institution preview regression', () => {
  const backend = fs.readFileSync('backend/src/index.js', 'utf8');
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('keeps preview server-authorized and superadmin-only', () => {
    expect(backend).toContain("app.get('/api/admin/institution-preview/:id'");
    expect(backend).toContain("if (auth.user.role !== 'super_admin')");
    expect(backend).toContain("entityType: 'institution_preview'");
    expect(backend).toContain("action: 'preview_start'");
    expect(backend).toContain("action: 'preview_end'");
    expect(backend).toContain('duration_seconds');
  });

  it('uses a visible read-only preview state without changing auth identity', () => {
    expect(admin).toContain('institutionPreviewBanner');
    expect(admin).toContain('salt-okunur');
    expect(admin).toContain('inst-preview-btn');
    expect(admin).toContain("inst.preview?.read_only");
    expect(admin).toContain("submit.style.display = inst.preview?.read_only ? 'none' : ''");
    expect(admin).toContain('exitInstitutionPreview');
    expect(admin).not.toContain('impersonat');
  });
});
