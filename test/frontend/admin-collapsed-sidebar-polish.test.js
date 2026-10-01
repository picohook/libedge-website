import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('collapsed admin sidebar polish', () => {
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('preserves the logo aspect ratio in collapsed mode', () => {
    expect(admin).toContain('.admin-sidebar-shell.collapsed .admin-sidebar-inner > div:first-child img');
    expect(admin).toContain('object-fit: contain');
    expect(admin).toContain('flex-shrink: 0');
  });

  it('renders notification counts as overlay dots without shifting icons', () => {
    expect(admin).toContain('.admin-sidebar-shell.collapsed #sidebarBadgeRequests');
    expect(admin).toContain('.admin-sidebar-shell.collapsed #sidebarBadgeSupport');
    expect(admin).toContain('position: absolute');
    expect(admin).toContain('color: transparent');
    expect(admin).toContain('font-size: 0');
  });
});
