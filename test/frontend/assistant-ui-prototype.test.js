import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../assistant.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../assets/js/assistant-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../assets/css/assistant-evidence-first.css', import.meta.url), 'utf8');

describe('Research Assistant live boundary', () => {
    it('uses only the reviewed same-origin Assistant endpoint for live research', () => {
        expect(js).toContain("fetch('/api/assistant/ask'");
        expect(js).toContain("credentials: 'same-origin'");
        expect(js).not.toMatch(/fetch\s*\(\s*['\"]https?:/);
        expect(js).not.toMatch(/XMLHttpRequest/);
        expect(js).not.toContain('assistant-api.js');
    });

    it('keeps fixture bibliographic content explicitly non-authoritative', () => {
        expect(html).toContain('fixture içerik yanıt olarak sunulmaz');
        expect(html).toContain('bibliyografik doğruluk iddiası taşımaz');
    });

    it('keeps every fixture citation chip linked to an existing source card', () => {
        const citationIds = [...html.matchAll(/class="citation-chip"[^>]*data-source="([^"]+)"/g)].map((match) => match[1]);
        expect(citationIds.length).toBeGreaterThan(0);
        for (const sourceId of citationIds) expect(html).toContain(`id="${sourceId}"`);
    });

    it('keeps finding-to-evidence interaction keyboard accessible', () => {
        expect(js).toContain('function focusFindingEvidence');
        expect(js).toContain("finding.setAttribute('role', 'button')");
        expect(js).toContain("finding.setAttribute('aria-pressed', 'false')");
        expect(js).toContain("event.key !== 'Enter' && event.key !== ' '");
        expect(css).toContain('.finding-item.is-evidence-active');
        expect(css).toContain('.source-card.is-related');
    });

    it('keeps fixture source detail disclosure local to existing DOM evidence', () => {
        expect(js).toContain('function ensureSourceDetail');
        expect(js).toContain("detail.dataset.sourceDetail = 'fixture-only'");
        expect(js).toContain('Yeni kaynak verisi getirmez ve bibliyografik doğrulama yapmaz');
        expect(js).toContain("button.setAttribute('aria-expanded', 'false')");
        expect(js).toContain("button.setAttribute('aria-controls', detail.id)");
        expect(js).toContain('sourceFindingLabels(sourceCard)');
    });

    it('renders live success only from claims plus evidence payload', () => {
        expect(js).toContain('function renderLiveAssistantResult(result)');
        expect(js).toContain("Array.isArray(result?.claims)");
        expect(js).toContain("Array.isArray(result?.evidence)");
        expect(js).toContain("node.hidden = true");
        expect(js).toContain('mapLiveAssistantResult(result)');
    });

    it('keeps loading and non-success presentation explicit', () => {
        expect(js).toContain("status.setAttribute('aria-busy', tone === 'loading' ? 'true' : 'false')");
        expect(js).toContain("answerCard?.classList.toggle('is-unavailable', !isSuccess)");
        expect(js).toContain('clearEvidenceFocus();');
        expect(js).toContain('closeSourceDetails();');
        expect(js).toContain('closeSources();');
        expect(css).toContain('.assistant-answer-card.is-unavailable');
        expect(css).toContain('#assistantStatus[aria-busy="true"]');
    });
});
