const TURKISH_DISTINCTIVE = /[çğıöşüÇĞİÖŞÜ]/;
const TURKISH_COMMON_WORDS = new Set([
  'bir','bu','ve','ile','için','nedir','nasıl','etkisi','etkileri','üzerindeki','çalışma','eğitim','saatlerinin','iş','yaşam'
]);
const NORMALIZATION_VERSION = 'query-en-normalization-v1';

function tokens(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').match(/[a-zçğıöşü]+/gu) || [];
}

export function researchQueryLanguage(query) {
  const text = String(query || '').trim();
  if (!text) return 'und';
  if (TURKISH_DISTINCTIVE.test(text)) return 'tr';
  const tokenList = tokens(text);
  if (tokenList.filter((token) => TURKISH_COMMON_WORDS.has(token)).length >= 2) return 'tr';
  return 'und';
}

export function requiresEnglishQueryNormalization(query) {
  return researchQueryLanguage(query) === 'tr';
}

export const QUERY_NORMALIZATION_VERSION = NORMALIZATION_VERSION;
export const __test = { TURKISH_DISTINCTIVE, TURKISH_COMMON_WORDS };
