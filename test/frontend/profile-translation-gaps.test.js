import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync('profile.html', 'utf8');

function getProfileTranslationBlock() {
  const match = profileSource.match(/const profileTranslations = \{([\s\S]*?)\n\};/);
  expect(match).toBeTruthy();
  return match[1];
}

describe('profile social-link translation gaps', () => {
  it('defines the required profile and social-link dictionary entries', () => {
    const dictionary = getProfileTranslationBlock();
    const expectedEntries = {
      'Profil linki ekleyin': 'Add profile link',
      'Sosyal hesap ekleyin': 'Add social account',
      'Henüz profil linki eklenmedi.': 'No profile links added yet.',
      'Henüz sosyal medya hesabı eklenmedi.': 'No social media accounts added yet.',
      'Sil': 'Delete',
      'Linkler http:// veya https:// ile başlamalı.': 'Links must start with http:// or https://.',
      'Profil linkleri kaydedildi.': 'Profile links saved.',
      'Profil linkleri kaydedilemedi.': 'Profile links could not be saved.',
      'Oturum yenileme çok sık denendi. Biraz bekleyip tekrar kontrol edeceğim.': 'Session refresh was attempted too often. I will wait a bit and check again.',
      'Geçici bağlantı sorunu var. Oturum kapatılmadı.': 'There is a temporary connection issue. Your session was not signed out.',
    };

    for (const [turkish, english] of Object.entries(expectedEntries)) {
      expect(dictionary).toContain(`'${turkish}': '${english}'`);
    }
  });

  it('keeps the #102 data-no-translate TreeWalker guard present', () => {
    expect(profileSource).toContain("if (parent.closest('[data-no-translate]'))");
  });

  it('keeps the #102 title translation data-no-translate guard present', () => {
    expect(profileSource).toMatch(/querySelectorAll\('\[title\]'\)[\s\S]*?if \(element\.closest\('\[data-no-translate\]'\)\) return;[\s\S]*?translateProfileString/);
  });

  it('does not add a new translation mechanism or profile-specific extension', () => {
    expect(profileSource.match(/const profileTranslations = \{/g)).toHaveLength(1);
    expect(profileSource.match(/const profileTranslationsReverse = Object\.fromEntries/g)).toHaveLength(1);
    expect(profileSource.match(/function translateProfileString\(/g)).toHaveLength(1);
    expect(profileSource.match(/function applyProfileLanguageFromStorage\(/g)).toHaveLength(1);
    expect(profileSource).not.toMatch(/profile(?:Link|Social)Translations/);
    expect(profileSource).not.toMatch(/extraProfileTranslations|profileTranslationsExtension|profileTranslationExtension/);
  });
});
