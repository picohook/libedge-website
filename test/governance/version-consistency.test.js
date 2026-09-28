import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const canonicalVersion = readFileSync(new URL('../../VERSION', import.meta.url), 'utf8').trim();
const footerPages = [
  'index.html',
  'terms.html',
  'privacy.html',
  'cookies.html',
  'profile.html',
];

describe('product version governance', () => {
  it('keeps VERSION as one SemVer value', () => {
    expect(canonicalVersion).toMatch(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
  });

  it.each(footerPages)('%s displays the canonical product version', (page) => {
    const html = readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8');
    expect(html).toContain(`data-product-version="${canonicalVersion}"`);
    expect(html).toContain(`>v${canonicalVersion}</span>`);
  });
});
