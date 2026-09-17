import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('tools.html'), 'utf8');

describe('tools catalog translation contract', () => {
  it('marks static page copy with TR/EN attributes', () => {
    expect(source).toContain('class="tools-title translatable"');
    expect(source).toContain('data-en="Selected tools for academic work"');
    expect(source).toContain('data-en="Loading tools..."');
    expect(source).toContain('data-en-placeholder="Search by tool, category, or need"');
  });

  it('uses one local dictionary for dynamic page-owned UI copy', () => {
    expect(source).toContain('const toolsMessages = {');
    expect(source).toContain("label: toolMessage('all')");
    expect(source).toContain("toolMessage('loadError')");
    expect(source).toContain("toolMessage('gateTitle')");
    expect(source).toContain("toolMessage('affiliateCta')");
    expect(source).not.toContain("label: 'Tümü'");
    expect(source).not.toContain("grid.innerHTML = '<div class=\"tools-empty\">Bireysel araçlar yüklenemedi.</div>'");
  });

  it('keeps API-owned Turkish summaries explicit until the public API exposes English summaries', () => {
    expect(source).toContain("const summary = tool.summary_tr || toolMessage('summaryFallback');");
    expect(source).toContain('Public /api/individual-tools currently exposes summary_tr only.');
    expect(source).not.toContain('tool.summary_en ||');
  });

  it('localizes the document title and reads the established language preference', () => {
    expect(source).toContain("localStorage.getItem('language') === 'en'");
    expect(source).toContain('document.title = toolsMessages[lang].title;');
  });
});
