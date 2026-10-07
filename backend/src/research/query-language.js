import { francAll } from 'franc-min';

const TURKISH_DISTINCTIVE = /[çğıöşüÇĞİÖŞÜ]/;
const TURKISH_GENERIC_CUES = new Set([
  'bir', 'bu', 've', 'ile', 'icin', 'için', 'nedir', 'nasil', 'nasıl',
  'neden', 'hangi', 'olarak', 'olan', 'mi', 'mı', 'mu', 'mü'
]);
const NORMALIZATION_VERSION = 'query-en-normalization-v2';

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

  const signal = francSignal(text);
  if (signal === 'en') return 'en';
  if (signal === 'tr') return 'tr';

  const cueSet = new Set(tokens(text).filter((token) => TURKISH_GENERIC_CUES.has(token)));
  if (cueSet.size >= 2) return 'tr';
  if (TURKISH_DISTINCTIVE.test(text) && cueSet.size >= 1) return 'tr';
  return 'und';
}

export function requiresEnglishQueryNormalization(query) {
  return researchQueryLanguage(query) === 'tr';
}

export const QUERY_NORMALIZATION_VERSION = NORMALIZATION_VERSION;
export const __test = { TURKISH_DISTINCTIVE, TURKISH_GENERIC_CUES, francSignal };
