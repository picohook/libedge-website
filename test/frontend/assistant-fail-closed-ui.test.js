import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const uiPath = new URL('../../assets/js/assistant-ui.js', import.meta.url);
const htmlPath = new URL('../../assistant.html', import.meta.url);

describe('Assistant fail-closed UI contract', () => {
  it('never restores fixture answer/source content during live reset', async () => {
    const source = await readFile(uiPath, 'utf8');
    const reset = source.match(/function resetLiveResult\(\) \{([\s\S]*?)\n    \}/)?.[1] || '';

    expect(reset).toContain('clearLiveContent()');
    expect(reset).toContain('hideFixtureResult()');
    expect(reset).not.toContain('node.hidden = false');
  });

  it('keeps hard-coded fixture metrics hidden until a verified live result', async () => {
    const source = await readFile(uiPath, 'utf8');

    expect(source).toContain("const overview = document.querySelector('.evidence-overview')");
    expect(source).toContain('if (overview) overview.hidden = true');
    expect(source).toContain('if (overview) {');
    expect(source).toContain('overview.hidden = false');
    expect(source).toContain("metrics[0].textContent = String(result.evidence.length)");
    expect(source).toContain("metrics[1].textContent = String(result.claims.length)");
    expect(source).toContain("metrics[2].textContent = '0'");
    expect(source).toContain("metrics[3].textContent = '0'");
  });

  it('ships the cache-busted fail-closed Assistant asset', async () => {
    const html = await readFile(htmlPath, 'utf8');
    expect(html).toContain('assets/js/assistant-ui.js?v=20260923a');
  });
});
