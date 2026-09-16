import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync('profile.html', 'utf8');

describe('profile translation user-content boundary', () => {
  it('skips marked user-owned subtrees in both text and title translation paths', () => {
    expect(profileSource).toContain("if (parent.closest('[data-no-translate]'))");
    expect(profileSource).toMatch(/querySelectorAll\('\[title\]'\)[\s\S]*?if \(element\.closest\('\[data-no-translate\]'\)\) return;[\s\S]*?translateProfileString/);
  });

  it('marks rendered full_name as user-owned but leaves the Kullanıcı fallback translatable', () => {
    expect(profileSource).toMatch(/profileName[\s\S]*?textContent = user\.full_name \|\| 'Kullanıcı';[\s\S]*?toggleAttribute\('data-no-translate', Boolean\(user\.full_name\)\)/);
    expect(profileSource).toMatch(/overviewName[\s\S]*?textContent = user\.full_name \|\| 'Kullanıcı';[\s\S]*?toggleAttribute\('data-no-translate', Boolean\(user\.full_name\)\)/);
    expect(profileSource).not.toContain("toggleAttribute('data-no-translate', true)");
  });

  it('marks user-defined profile and social labels while leaving cfg.label fallbacks unmarked', () => {
    const conditionalMarker = "const noTranslateAttr = link.label ? ' data-no-translate' : '';";
    expect(profileSource.split(conditionalMarker)).toHaveLength(3);
    expect(profileSource).toMatch(/const label = link\.label \|\| cfg\.label;[\s\S]*?const noTranslateAttr = link\.label \? ' data-no-translate' : '';[\s\S]*?title=\\"\$\{escapeHtml\(label\)\}\\"[\s\S]*?\$\{noTranslateAttr\}/);
  });

  it('keeps the profile translator reversible for repeated TR/EN toggles', () => {
    expect(profileSource).toContain('const profileTranslationsReverse = Object.fromEntries(');
    expect(profileSource).toMatch(/function translateProfileString\(value, toEnglish\)[\s\S]*?toEnglish \? profileTranslations : profileTranslationsReverse/);
    expect(profileSource).toMatch(/function translateProfilePage\(toEnglish\)[\s\S]*?translateProfileString\(node\.nodeValue, toEnglish\)/);
  });
});
