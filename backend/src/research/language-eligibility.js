import { francAll } from 'franc-min';

const MIN_DETECTION_CHARS = 120;
const MIN_ENGLISH_SCORE = 0.55;
const MIN_SCORE_MARGIN = 0.05;

function normalizedProviderLanguage(value) {
  return String(value || '').trim().toLowerCase();
}

function detectionText(work) {
  return [work?.title, work?.abstract].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function englishEvidenceEligibility(work) {
  const providerLanguage = normalizedProviderLanguage(work?.language);
  if (providerLanguage) {
    return { eligible: providerLanguage === 'en', basis: providerLanguage === 'en' ? 'provider_en' : 'provider_other' };
  }

  const text = detectionText(work);
  if (text.length < MIN_DETECTION_CHARS) return { eligible: false, basis: 'insufficient_text' };

  const ranked = francAll(text, { minLength: 60 });
  const [best] = ranked;
  const bestLanguage = best?.[0] || 'und';
  const bestDistance = Number(best?.[1]);
  const englishDistance = Number(ranked.find(([language]) => language === 'eng')?.[1]);
  const runnerUpDistance = Number(ranked.find(([language]) => language !== 'eng')?.[1]);
  const englishConfidence = Number.isFinite(englishDistance) ? 1 - englishDistance : 0;
  const distanceMargin = Number.isFinite(runnerUpDistance) && Number.isFinite(englishDistance)
    ? runnerUpDistance - englishDistance : 0;
  const eligible = bestLanguage === 'eng'
    && Number.isFinite(bestDistance)
    && englishConfidence >= MIN_ENGLISH_SCORE
    && distanceMargin >= MIN_SCORE_MARGIN;
  return { eligible, basis: eligible ? 'detected_en' : 'detected_not_authorized' };
}

export const __test = { MIN_DETECTION_CHARS, MIN_ENGLISH_SCORE, MIN_SCORE_MARGIN };
