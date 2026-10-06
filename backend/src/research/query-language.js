import { francAll } from 'franc-min';

const TURKISH_DISTINCTIVE = /[çğıöşüÇĞİÖŞÜ]/;
const TURKISH_COMMON_WORDS = new Set([
  'bir','bu','ve','ile','icin','için','nedir','nasil','nasıl','etkisi','etkileri','uzerindeki','üzerindeki',
  'calisma','çalışma','egitim','eğitim','saatlerinin','is','iş','yasam','yaşam','turkiye','türkiye','ogretmen',
  'öğretmen','yetistirme','yetiştirme','reformu','universite','üniversite','ogrenci','öğrenci'
]);
const NORMALIZATION_VERSION = 'query-en-normalization-v1';

function tokens(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').match(/[a-zçğıöşü]+/gu) || [];
}

function francSignal(text) {
  if (String(text || '').trim().length < 10) return 'und';
  const ranked = francAll(text, { minLength: 10 }).slice(0, 3);
  const [best, second] = ranked;
  const margin = Number(best?.[1]) - Number(second?.[1]);
  if (Number.isFinite(margin) && margin >= 0.02 && best?.[0] === 'eng') return 'en';
  if (Number.isFinite(margin) && margin >= 0.02 && best?.[0] === 'tur') return 'tr';
  return 'und';
}

export function researchQueryLanguage(query) {
  const text = String(query || '').trim();
  if (!text) return 'und';
  const cueCount = tokens(text).filter((token) => TURKISH_COMMON_WORDS.has(token)).length;
  if (cueCount >= 2) return 'tr';
  const signal = francSignal(text);
  if (signal === 'en') return 'en';
  if (signal === 'tr') return 'tr';
  if (TURKISH_DISTINCTIVE.test(text) && cueCount >= 1) return 'tr';
  return 'und';
}

export function requiresEnglishQueryNormalization(query) {
  return researchQueryLanguage(query) === 'tr';
}

export const QUERY_NORMALIZATION_VERSION = NORMALIZATION_VERSION;
export const __test = { TURKISH_DISTINCTIVE, TURKISH_COMMON_WORDS, francSignal };
