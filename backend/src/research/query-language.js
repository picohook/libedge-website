import { francAll } from 'franc-min';

const TURKISH_DISTINCTIVE = /[çğıöşüÇĞİÖŞÜ]/;
const NORMALIZATION_VERSION = 'query-en-normalization-v1';

export function researchQueryLanguage(query) {
  const text = String(query || '').trim();
  if (!text) return 'und';
  if (TURKISH_DISTINCTIVE.test(text)) return 'tr';
  if (text.length < 10) return 'und';
  const ranked = francAll(text, { minLength: 10 });
  const best = ranked?.[0]?.[0] || 'und';
  if (best === 'tur') return 'tr';
  if (best === 'eng') return 'en';
  return 'und';
}

export function requiresEnglishQueryNormalization(query) {
  return researchQueryLanguage(query) === 'tr';
}

export const QUERY_NORMALIZATION_VERSION = NORMALIZATION_VERSION;
export const __test = { TURKISH_DISTINCTIVE };
