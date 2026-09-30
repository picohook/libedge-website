import { describe, expect, it } from 'vitest';
import { supportCheckLanguageBoundary } from '../../backend/src/assistant/support-check-language-boundary.js';

describe('D-023 supportCheck language boundary', () => {
  it('allows plain English checker input', () => {
    expect(supportCheckLanguageBoundary(
      { text: 'The catalyst improves hydrogen evolution.' },
      [{ title: 'Hydrogen catalyst study', abstract: 'The catalyst improved the measured rate.' }]
    )).toEqual({ authorized: true, language: 'en' });
  });

  it.each([
    ['Turkish', 'Bu katalizör hidrojen üretimini artırır.'],
    ['accented non-English', 'Le catalyseur améliore la réaction.'],
    ['empty', '']
  ])('fails closed for %s input', (_label, text) => {
    expect(supportCheckLanguageBoundary({ text }, [])).toEqual({
      authorized: false,
      reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED'
    });
  });

  it('fails closed when cited evidence is outside the authorized scope', () => {
    expect(supportCheckLanguageBoundary(
      { text: 'The catalyst improves hydrogen evolution.' },
      [{ title: 'Çalışma', abstract: 'Katalizör aktiviteyi artırdı.' }]
    ).authorized).toBe(false);
  });
});
