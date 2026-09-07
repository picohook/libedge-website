import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const headerSource = readFileSync('assets/js/header.js', 'utf8');
const sharedHeader = readFileSync('partials/header.html', 'utf8');
const stylesheet = readFileSync('style.css', 'utf8');
const pagesHeaders = readFileSync('_headers', 'utf8');

describe('mobile header regression coverage', () => {
  it('keeps a hamburger button in both shared and fallback headers', () => {
    expect(sharedHeader).toContain('class="hamburger"');
    expect(headerSource).toContain('class="hamburger"');
    expect(headerSource).toContain('aria-expanded="false"');
  });

  it('keeps the mobile navigation sticky above the menu overlay', () => {
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*639px\)[\s\S]*?\.nav-glass\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;[\s\S]*?z-index:\s*1001;/);
    expect(stylesheet).toMatch(/\.hamburger\s*\{[\s\S]*?z-index:\s*1002;/);
    expect(stylesheet).toMatch(/\.nav-overlay\s*\{[\s\S]*?z-index:\s*999;/);
  });

  it('forces critical navigation assets to revalidate on Pages', () => {
    expect(pagesHeaders).toContain('/style.css\n  Cache-Control: no-cache, must-revalidate');
    expect(pagesHeaders).toContain('/assets/js/header.js\n  Cache-Control: no-cache, must-revalidate');
    expect(pagesHeaders).toContain('/assets/js/header-controller.js\n  Cache-Control: no-cache, must-revalidate');
    expect(pagesHeaders).toContain('/partials/header.html\n  Cache-Control: no-cache, must-revalidate');
  });
});
