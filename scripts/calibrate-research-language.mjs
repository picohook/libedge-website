import { francAll } from 'franc-min';

const queries = [
  'anion exchange membrane alkaline stability',
  'polymer electrolyte membrane water electrolysis',
  'fuel cell catalyst durability',
  'lithium sulfur battery cathode'
];

const samples = [];
for (const query of queries) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('filter', 'language:en,has_abstract:true');
  url.searchParams.set('per-page', '10');
  const response = await fetch(url, { headers: { 'User-Agent': 'LibEdge language calibration' } });
  if (!response.ok) throw new Error(`OpenAlex failed: ${response.status}`);
  const body = await response.json();
  for (const work of body.results || []) {
    const abstract = work.abstract_inverted_index
      ? Object.entries(work.abstract_inverted_index)
          .flatMap(([word, positions]) => positions.map((position) => [position, word]))
          .sort((a, b) => a[0] - b[0]).map(([, word]) => word).join(' ')
      : '';
    const text = [work.title, abstract].filter(Boolean).join(' ');
    if (text.length < 120) continue;
    const [best, second] = francAll(text, { minLength: 60 });
    samples.push({ query, id: work.id, provider_language: work.language, best: best?.[0], margin: Number(best?.[1] || 0) - Number(second?.[1] || 0) });
  }
}

const englishMisses = samples.filter((sample) => sample.best !== 'eng' || sample.margin < 0.02);
console.log(JSON.stringify({
  sample_count: samples.length,
  min_margin: samples.length ? Math.min(...samples.map((sample) => sample.margin)) : null,
  best_language_counts: samples.reduce((counts, sample) => ({ ...counts, [sample.best]: (counts[sample.best] || 0) + 1 }), {}),
  misses: englishMisses
}, null, 2));
if (samples.length < 30 || englishMisses.length) process.exitCode = 1;
