import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const uiPath = new URL('../../assets/js/assistant-ui.js', import.meta.url);
const htmlPath = new URL('../../assistant.html', import.meta.url);

describe('Assistant fail-closed UI contract', () => {
  it('removes fixture answer/source DOM before live rendering instead of relying on hidden CSS', async () => {
    const source = await readFile(uiPath, 'utf8');
    const removeStart = source.indexOf('function removeFixtureResult() {');
    const removeEnd = source.indexOf('\n    function resetLiveResult()', removeStart);
    const removeFixture = removeStart >= 0 && removeEnd > removeStart ? source.slice(removeStart, removeEnd) : '';

    expect(removeFixture).toContain('node.remove()');
    expect(removeFixture).toContain("#assistantSources > .source-card:not([data-live-evidence])");
    expect(removeFixture).not.toContain('node.hidden = true');
  });

  it('resets the evidence count only during reset, not while removing fixture DOM after a live render', async () => {
    const source = await readFile(uiPath, 'utf8');
    const removeStart = source.indexOf('function removeFixtureResult() {');
    const removeEnd = source.indexOf('\n    function resetLiveResult()', removeStart);
    const removeFixture = removeStart >= 0 && removeEnd > removeStart ? source.slice(removeStart, removeEnd) : '';
    const resetStart = source.indexOf('function resetLiveResult() {');
    const resetEnd = source.indexOf('\n    function setInitialLiveState()', resetStart);
    const reset = resetStart >= 0 && resetEnd > resetStart ? source.slice(resetStart, resetEnd) : '';

    expect(removeFixture).not.toContain("sourceCount.textContent = '0'");
    expect(reset).toContain("sourceCount.textContent = '0'");
    expect(source).toContain('sourceCount.textContent = String(result.evidence.length)');
  });

  it('keeps hard-coded fixture metrics hidden until a verified live result', async () => {
    const source = await readFile(uiPath, 'utf8');

    expect(source).toContain("const overview = document.querySelector('.evidence-overview')");
    expect(source).toContain('if (overview) overview.hidden = true');
    expect(source).toContain('if (overview) {');
    expect(source).toContain('overview.hidden = false');
    expect(source).toContain("metrics[0].textContent = String(result.evidence.length)");
    expect(source).toContain("metrics[1].textContent = String(result.claims.length)");
    expect(source).toContain("metrics[2].closest('div').hidden = true");
    expect(source).toContain("metrics[3].closest('div').hidden = true");
    expect(source).not.toContain("metrics[2].textContent = '0'");
    expect(source).not.toContain("metrics[3].textContent = '0'");
  });

  it('ships the current cache-busted fail-closed Assistant asset', async () => {
    const html = await readFile(htmlPath, 'utf8');
    expect(html).toContain('assets/js/assistant-ui.js?v=20261002a');
  });
});
