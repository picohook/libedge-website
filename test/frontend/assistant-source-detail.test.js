import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../../assets/js/assistant-ui.js', import.meta.url), 'utf8');

describe('Assistant fixture source detail interaction', () => {
    it('keeps source detail fixture-only and transport-free', () => {
        expect(js).toContain("detail.dataset.sourceDetail = 'fixture-only'");
        expect(js).toContain('Yeni kaynak verisi getirmez ve bibliyografik doğrulama yapmaz.');
        expect(js).not.toMatch(/\bfetch\s*\(/);
        expect(js).not.toMatch(/XMLHttpRequest/);
        expect(js).not.toContain('assistant-api.js');
    });

    it('builds detail from already-rendered fixture fields without HTML injection', () => {
        expect(js).toContain("sourceCard.querySelector('.evidence-relation')");
        expect(js).toContain("sourceCard.querySelector('.source-meta')");
        expect(js).toContain("sourceCard.querySelectorAll('.source-badges span')");
        expect(js).not.toContain('innerHTML');
    });

    it('exposes an accessible disclosure state and closes details on Escape', () => {
        expect(js).toContain("button.setAttribute('aria-expanded', 'false')");
        expect(js).toContain("button.setAttribute('aria-controls', detail.id)");
        expect(js).toContain("button.setAttribute('aria-expanded', opening ? 'true' : 'false')");
        expect(js).toContain("if (event.key === 'Escape')");
        expect(js).toContain('closeSourceDetails();');
    });
});
