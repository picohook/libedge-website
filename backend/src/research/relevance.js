import { englishEvidenceEligibility } from './language-eligibility.js';

const RAW_STOPWORDS = [
  'the','and','for','with','from','that','this','what','which','are','is','of','to','in','on','as','at','by','an','a',
  've','veya','ile','için','bu','şu','nedir','nelerdir','hangi','olarak','açısından','mevcut','bir','de','da','mi','mı','mu','mü','ne','nasıl',
  'tabanlı','uygulama','uygulamalar','uygulamalarda','güvenlik','güvenlilik','etkinlik'
];

function fold(value) {
  return String(value || '').toLocaleLowerCase('tr').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9çğıöşü\s-]/gi, ' ')
    .replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const STOPWORDS = new Set(RAW_STOPWORDS.map(fold));

export function relevanceTerms(query) {
  return [...new Set(fold(query).split(/\s+/).filter((term) => term.length >= 4 && !STOPWORDS.has(term)))];
}

export function lexicalRelevanceScore(query, work) {
  const terms = relevanceTerms(query);
  if (!terms.length) return 0;
  const title = fold(work?.title);
  const text = fold([work?.title, work?.abstract].filter(Boolean).join(' '));
  const matched = terms.filter((term) => text.includes(term));
  const titleMatched = terms.filter((term) => title.includes(term));
  const distinctiveTitleMatch = titleMatched.length >= Math.min(2, terms.length);
  return distinctiveTitleMatch ? (matched.length / terms.length) + (titleMatched.length / terms.length) * 0.5 : 0;
}

export function filterRelevantWorks(query, works, { minScore = 0.2, language = null } = {}) {
  if (!Array.isArray(works)) return [];
  return works
    .filter((work) => !language || (language === 'en' ? englishEvidenceEligibility(work).eligible : String(work?.language || '').trim().toLowerCase() === language))
    .map((work, index) => ({ work, index, score: lexicalRelevanceScore(query, work) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.work);
}
