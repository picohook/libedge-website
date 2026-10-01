import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('mobile hero pagination spacing', () => {
  const css = fs.readFileSync('style.css', 'utf8');

  it('reserves vertical space for slider controls on mobile', () => {
    const mobile = css.slice(css.lastIndexOf('/* Hero slider mobil */'));
    expect(mobile).toContain('@media (max-width: 768px)');
    expect(mobile).toContain('.hero-content');
    expect(mobile).toContain('padding-bottom: 5.5rem');
    expect(css).toContain('.slider-dots-container');
    expect(css).toContain('bottom: 64px');
  });
});
