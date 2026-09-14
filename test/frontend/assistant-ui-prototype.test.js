import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../assistant.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../assets/js/assistant-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../assets/css/assistant-evidence-first.css', import.meta.url), 'utf8');

describe('Research Assistant UI prototype boundary', () => {
    it('does not perform network calls or load the live Assistant transport', () => {
        expect(js).not.toMatch(/\bfetch\s*\(/);
        expect(js).not.toMatch(/XMLHttpRequest/);
        expect(js).not.toContain('assistant-api.js');
    });

    it('labels fixture evidence as non-bibliographic prototype data', () => {
        expect(html).toContain('fixture verisi kullanır; AI/provider çağrısı yapmaz');
        expect(html).toContain('bibliyografik doğruluk iddiası taşımaz');
    });

    it('keeps every citation chip linked to an existing source card', () => {
        const citationIds = [...html.matchAll(/class="citation-chip"[^>]*data-source="([^"]+)"/g)]
            .map((match) => match[1]);
        expect(citationIds.length).toBeGreaterThan(0);
        for (const sourceId of citationIds) {
            expect(html).toContain(`id="${sourceId}"`);
        }
    });

    it('keeps finding-to-evidence interaction fixture-only and keyboard accessible', () => {
        expect(js).toContain('function focusFindingEvidence');
        expect(js).toContain("finding.setAttribute('role', 'button')");
        expect(js).toContain("finding.setAttribute('aria-pressed', 'false')");
        expect(js).toContain("event.key !== 'Enter' && event.key !== ' '");
        expect(css).toContain('.finding-item.is-evidence-active');
        expect(css).toContain('.source-card.is-related');
    });

    it('keeps loading and non-success presentation explicit without adding transport', () => {
        expect(js).toContain("status.setAttribute('aria-busy', tone === 'loading' ? 'true' : 'false')");
        expect(js).toContain("answerCard?.classList.toggle('is-unavailable', !isSuccess)");
        expect(js).toContain('clearEvidenceFocus();');
        expect(js).toContain('closeSources();');
        expect(css).toContain('.assistant-answer-card.is-unavailable');
        expect(css).toContain('#assistantStatus[aria-busy="true"]');
    });
});
