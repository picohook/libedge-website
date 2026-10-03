import { francAll } from 'franc-min';

const MIN_DETECTION_CHARS = 120;
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
  const [best, second] = ranked;
  const bestLanguage = best?.[0] || 'und';
  const bestScore = Number(best?.[1]);
  const secondScore = Number(second?.[1]);
  const scoreMargin = Number.isFinite(bestScore) && Number.isFinite(secondScore)
    ? bestScore - secondScore : 0;
  const eligible = bestLanguage === 'eng' && scoreMargin >= MIN_SCORE_MARGIN;
  return { eligible, basis: eligible ? 'detected_en' : 'detected_not_authorized' };
}

export const __test = { MIN_DETECTION_CHARS, MIN_SCORE_MARGIN };
