import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../assistant.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../assets/js/assistant-ui.js', import.meta.url), 'utf8');

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
});
