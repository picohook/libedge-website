import { describe, expect, it } from 'vitest';
import { QUERY_NORMALIZATION_VERSION, researchQueryLanguage, requiresEnglishQueryNormalization } from '../../backend/src/research/query-language.js';

describe('Research query language pilot boundary', () => {
  it('classifies natural Turkish with distinctive characters for normalization', () => {
    expect(researchQueryLanguage('Esnek çalışma saatlerinin iş-yaşam dengesi üzerindeki etkisi nedir?')).toBe('tr');
    expect(requiresEnglishQueryNormalization('Esnek çalışma saatlerinin iş-yaşam dengesi üzerindeki etkisi nedir?')).toBe(true);
  });

  it('leaves clear English queries on the existing path', () => {
    expect(researchQueryLanguage('How do flexible work hours affect work-life balance?')).toBe('en');
    expect(requiresEnglishQueryNormalization('How do flexible work hours affect work-life balance?')).toBe(false);
  });

  it('keeps the normalization contract version explicit', () => {
    expect(QUERY_NORMALIZATION_VERSION).toBe('query-en-normalization-v1');
  });
});
