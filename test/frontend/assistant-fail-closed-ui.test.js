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
    expect(removeFixture).toContain('if (overview) overview.remove()');
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

  it('removes hard-coded fixture metrics and recreates the overview only from verified live counts', async () => {
    const source = await readFile(uiPath, 'utf8');

    expect(source).toContain("const overview = document.querySelector('.evidence-overview')");
    expect(source).toContain('if (overview) overview.remove()');
    expect(source).toContain("overview.dataset.liveEvidenceOverview = 'true'");
    expect(source).toContain("overview.dataset.researchSummary = 'true'");
    expect(source).toContain("appendMetric(literature.retrieved_count");
    expect(source).toContain("appendMetric(verification.checked_count");
    expect(source).toContain("appendMetric(verification.verified_count");
    expect(source).toContain("appendMetric(result.evidence.length, 'kullanılan kanıt', 'evidence cited')");
    expect(source).not.toContain("'incelenen kaynak', 'sources reviewed'");
    expect(source).not.toContain('overview.hidden = true');
    expect(source).not.toContain('overview.hidden = false');
  });

  it('ships the current cache-busted fail-closed Assistant asset', async () => {
    const html = await readFile(htmlPath, 'utf8');
    expect(html).toContain('assets/js/assistant-ui.js?v=20261003a');
  });
});
