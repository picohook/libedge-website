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
    ['typographic punctuation', 'PEM water electrolysis – catalyst activity reaches 80% at 60 °C.'],
    ['Greek scientific notation', 'The β phase uses a 25 μm membrane at ΔP = 1 bar.'],
    ['mathematical symbols', 'Current density ≥ 2 A cm⁻² and efficiency ≈ 75%.']
  ])('allows English academic text containing %s', (_label, text) => {
    expect(supportCheckLanguageBoundary({ text }, [])).toEqual({ authorized: true, language: 'en' });
  });

  it.each([
    ['Turkish', 'Bu katalizör hidrojen üretimini artırır.'],
    ['accented non-English', 'Le catalyseur améliore la réaction.'],
    ['empty', '']
  ])('fails closed for %s input', (_label, text) => {
    expect(supportCheckLanguageBoundary({ text }, [])).toEqual({
      authorized: false,
      reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED',
      source: 'claim'
    });
  });

  it('fails closed when cited evidence is outside the authorized scope', () => {
    expect(supportCheckLanguageBoundary(
      { text: 'The catalyst improves hydrogen evolution.' },
      [{ title: 'Çalışma', abstract: 'Katalizör aktiviteyi artırdı.' }]
    )).toEqual({ authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED', source: 'evidence' });
  });

  it('preserves the prior behavior for evidence items with no title or abstract', () => {
    expect(supportCheckLanguageBoundary(
      { text: 'The catalyst improves hydrogen evolution.' },
      [{ evidence_id: 'doi:10.1/example' }]
    )).toEqual({ authorized: true, language: 'en' });
  });

  it('identifies accented evidence as the evidence-side rejection without exposing content', () => {
    expect(supportCheckLanguageBoundary(
      { text: 'The archive contains correspondence from the period.' },
      [{ title: 'José Martínez archive study', abstract: 'The archive contains correspondence and catalog records.' }]
    )).toEqual({ authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED', source: 'evidence' });
  });
});
