const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','what','which','are','is','of','to','in','on','as','at','by','an','a',
  've','veya','ile','için','icin','bu','şu','su','nedir','nelerdir','hangi','olarak','açısından','acisindan','mevcut',
  'bir','de','da','mi','mı','mu','mü','ne','nasıl','nasil'
]);

function fold(value) {
  return String(value || '').toLocaleLowerCase('tr').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9çğıöşü\s-]/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function relevanceTerms(query) {
  return [...new Set(fold(query).split(/\s+/).filter((term) => term.length >= 4 && !STOPWORDS.has(term)))];
}

export function lexicalRelevanceScore(query, work) {
  const terms = relevanceTerms(query);
  if (!terms.length) return 0;
  const title = fold(work?.title);
  const text = fold([work?.title, work?.abstract].filter(Boolean).join(' '));
  let matched = 0;
  let titleMatched = 0;
  for (const term of terms) {
    if (text.includes(term)) matched += 1;
    if (title.includes(term)) titleMatched += 1;
  }
  return (matched / terms.length) + (titleMatched / terms.length) * 0.5;
}

export function filterRelevantWorks(query, works, { minScore = 0.2 } = {}) {
  if (!Array.isArray(works)) return [];
  return works.map((work, index) => ({ work, index, score: lexicalRelevanceScore(query, work) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.work);
}
