const CASES = [
  { id:'A1', q:'remote learning student engagement', intent:'Research on remote learning and student engagement.' },
  { id:'A2', q:'digital divide rural education', intent:'Research on the digital divide in rural education.' },
  { id:'A5', q:'social capital neighborhood health', intent:'Research on social capital and neighborhood health outcomes.' },
  { id:'A6', q:'green hydrogen policy incentives', intent:'Research on policy incentives for green hydrogen.' },
  { id:'A7', q:'energy transition public acceptance', intent:'Research on public acceptance of the energy transition.' }
];

for (const test of CASES) {
  const lexical = await query('search', test.q, 100);
  await sleep(1100);
  const semantic = await query('search.semantic', test.intent, 50);
  const lexIds = new Set(lexical.map((w) => w.id));
  const overlap = semantic.filter((w) => lexIds.has(w.id));
  const semanticOnly = semantic.filter((w) => !lexIds.has(w.id));
  console.log('P05_SEMANTIC_GAP', JSON.stringify({
    id:test.id,
    lexicalCount:lexical.length,
    semanticCount:semantic.length,
    semanticOverlapCount:overlap.length,
    semanticOnlyCount:semanticOnly.length,
    semanticOnlyTop20:semanticOnly.slice(0,20).map((w)=>({semanticRank:semantic.findIndex((x)=>x.id===w.id)+1,title:w.title,id:w.id,relevance_score:w.relevance_score}))
  }));
  await sleep(1100);
}

async function query(param, value, perPage) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set(param, value);
  url.searchParams.set('per-page', String(perPage));
  url.searchParams.set('select', 'id,title,relevance_score');
  const response = await fetch(url, { headers: { 'User-Agent': 'LibEdge-P05-Semantic-Gap-Probe/1.0' } });
  if (!response.ok) throw new Error(`${param} ${response.status}: ${(await response.text()).slice(0,300)}`);
  const body = await response.json();
  return body.results || [];
}
function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
