const CASES = [
  { id:'A1', q:'remote learning student engagement', intent:'remote learning and student engagement' },
  { id:'A2', q:'digital divide rural education', intent:'digital divide in rural education' },
  { id:'A5', q:'social capital neighborhood health', intent:'social capital and neighborhood health outcomes' },
  { id:'A6', q:'green hydrogen policy incentives', intent:'policy incentives for green hydrogen' },
  { id:'A7', q:'energy transition public acceptance', intent:'public acceptance of the energy transition' }
];

for (const test of CASES) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', test.q);
  url.searchParams.set('per-page', '100');
  url.searchParams.set('select', 'id,title,doi');
  const response = await fetch(url, { headers: { 'User-Agent': 'LibEdge-P05-Candidate-Probe/1.0' } });
  if (!response.ok) throw new Error(`${test.id} OpenAlex ${response.status}: ${(await response.text()).slice(0,300)}`);
  const body = await response.json();
  const rows = (body.results || []).map((w, i) => ({ rank:i+1, title:w.title, doi:w.doi, id:w.id }));
  console.log(`P05_CANDIDATE_POOL ${test.id} ${JSON.stringify({query:test.q,intent:test.intent,count:rows.length,top100:rows})}`);
}
