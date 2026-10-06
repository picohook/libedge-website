import { describe, expect, it } from 'vitest';
import { QUERY_NORMALIZATION_VERSION, researchQueryLanguage, requiresEnglishQueryNormalization } from '../../backend/src/research/query-language.js';

describe('Research query language pilot boundary', () => {
  it('routes natural Turkish for normalization', () => {
    expect(researchQueryLanguage('Esnek çalışma saatlerinin iş-yaşam dengesi üzerindeki etkisi nedir?')).toBe('tr');
    expect(requiresEnglishQueryNormalization('Esnek çalışma saatlerinin iş-yaşam dengesi üzerindeki etkisi nedir?')).toBe(true);
  });

  it('does not misroute English questions containing names or terms with diacritics', () => {
    for (const query of [
      'Schrödinger equation applications in quantum computing',
      'What did Gödel prove about incompleteness?',
      'Müller-Lyer illusion and cultural perception'
    ]) {
      expect(researchQueryLanguage(query)).not.toBe('tr');
      expect(requiresEnglishQueryNormalization(query)).toBe(false);
    }
  });

  it('routes common ASCII-typed Turkish for normalization', () => {
    const query = 'Turkiye de egitim reformu ve ogretmen yetistirme';
    expect(researchQueryLanguage(query)).toBe('tr');
    expect(requiresEnglishQueryNormalization(query)).toBe(true);
  });

  it('keeps the normalization contract version explicit', () => {
    expect(QUERY_NORMALIZATION_VERSION).toBe('query-en-normalization-v1');
  });
});
