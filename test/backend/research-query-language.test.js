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
      'Müller-Lyer illusion and cultural perception',
      'Erdős–Rényi networks in graph theory'
    ]) {
      expect(researchQueryLanguage(query)).not.toBe('tr');
      expect(requiresEnglishQueryNormalization(query)).toBe(false);
    }
  });

  it('does not misroute ordinary English questions with repeated is or ve token fragments', () => {
    for (const query of [
      'What is the effect of sleep on memory and why is it important?',
      'Why is sleep important and what is its role in learning?',
      'What is machine learning and how is it used in medicine?',
      "I've read that exercise helps; what is the evidence?"
    ]) {
      expect(researchQueryLanguage(query)).toBe('en');
      expect(requiresEnglishQueryNormalization(query)).toBe(false);
    }
  });

  it('routes ASCII-typed Turkish when the language signal or generic cues support it', () => {
    for (const query of [
      'Esnek calisma saatlerinin is yasam dengesi uzerindeki etkisi nedir?',
      'Online egitim universite ogrencilerinin akademik katilimini nasil etkiler?',
      'Bu calisma neden onemli ve hangi sonuclari gosteriyor?'
    ]) {
      expect(researchQueryLanguage(query)).toBe('tr');
      expect(requiresEnglishQueryNormalization(query)).toBe(true);
    }
  });

  it('keeps the normalization contract version explicit', () => {
    expect(QUERY_NORMALIZATION_VERSION).toBe('query-en-normalization-v2');
  });
});
