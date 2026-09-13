import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../assistant.html', import.meta.url), 'utf8');
const uiJs = readFileSync(new URL('../../assets/js/assistant-ui.js', import.meta.url), 'utf8');
const apiJs = readFileSync(new URL('../../assets/js/assistant-api.js', import.meta.url), 'utf8');

describe('Research Assistant UI prototype boundary', () => {
    it('keeps network access isolated to the reviewed Assistant transport', () => {
        expect(uiJs).not.toMatch(/\bfetch\s*\(/);
        expect(uiJs).not.toMatch(/XMLHttpRequest/);
        expect(apiJs).toContain("'/api/assistant/ask'");
        expect(apiJs).toContain("credentials: 'include'");
        expect(apiJs).not.toMatch(/openai|anthropic|bedrock|claude|gpt/i);
    });

    it('labels fixture evidence as non-bibliographic prototype data', () => {
        expect(html).toContain('bibliyografik doğruluk iddiası taşımaz');
        expect(uiJs).toContain('İlk görünüm fixture');
        expect(uiJs).toContain('Model/provider hâlâ kapalıdır');
    });

    it('keeps every fixture citation chip linked to an existing source card', () => {
        const citationIds = [...html.matchAll(/class="citation-chip"[^>]*data-source="([^"]+)"/g)]
            .map((match) => match[1]);
        expect(citationIds.length).toBeGreaterThan(0);
        for (const sourceId of citationIds) expect(html).toContain(`id="${sourceId}"`);
    });

    it('does not show fixture evidence after a live request begins', () => {
        expect(uiJs).toContain('hideFixtureResult()');
        expect(uiJs).toContain("code: 'EVIDENCE_PAYLOAD_REQUIRED'");
    });
});
