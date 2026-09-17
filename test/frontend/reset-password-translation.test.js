import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('reset-password.html', 'utf8');

describe('reset-password localization', () => {
  it('uses the established translatable/data-tr/data-en pattern for static copy', () => {
    expect(source).toContain('class="translatable text-2xl font-bold text-center text-primary mb-2"');
    expect(source).toContain('data-tr="Şifreyi sıfırla" data-en="Reset password"');
    expect(source).toContain('data-tr="Yeni şifre" data-en="New password"');
    expect(source).toContain('data-tr="Yeni şifre (tekrar)" data-en="Confirm new password"');
    expect(source).toContain('data-tr="Şifreyi güncelle" data-en="Update password"');
    expect(source).toContain('data-tr="Ana sayfaya dön" data-en="Back to home"');
  });

  it('keeps dynamic status copy in one dictionary and reads messages by key', () => {
    expect(source).toContain('const resetPasswordMessages = {');
    expect(source).toContain("passwordMismatch: 'Şifreler eşleşmiyor.'");
    expect(source).toContain("passwordMismatch: 'Passwords do not match.'");
    expect(source).toContain("showStatus(message('passwordMismatch'), 'error')");
    expect(source).not.toContain("showStatus('Şifreler eşleşmiyor.'");
  });

  it('localizes the document title from the same selected language', () => {
    expect(source).toContain('document.title = resetPasswordMessages[language].title;');
  });
});
