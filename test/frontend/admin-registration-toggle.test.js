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


describe('public registration availability UX', () => {
  const authJs = fs.readFileSync('assets/js/auth.js', 'utf8');
  const backend = fs.readFileSync('backend/src/index.js', 'utf8');

  it('exposes only the enabled flag from the public registration-state endpoint', () => {
    expect(backend).toContain("app.get('/api/auth/registration-state'");
    expect(backend).toContain("return c.json({ enabled: registration.enabled });");
  });

  it('checks registration availability when opening the registration modal', () => {
    expect(authJs).toContain("window.openRegisterModal = async function()");
    expect(authJs).toContain("/api/auth/registration-state");
    expect(authJs).toContain("if (state?.enabled === false)");
    expect(authJs).toContain("Şu anda yeni kayıt kabul etmiyoruz. Daha sonra tekrar deneyin.");
    expect(authJs).toContain("window.register = async function");
    expect(authJs).toContain("/api/auth/register");
  });
});
