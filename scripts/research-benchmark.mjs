const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('Missing smoke credentials');

const CASES = [
  { name: 'materials-energy', q: 'PEM water electrolysis low iridium catalyst', terms: ['pem', 'electroly', 'iridium', 'catalyst', 'oer'] },
  { name: 'biomedical', q: 'CRISPR base editing sickle cell', terms: ['crispr', 'base edit', 'sickle', 'hemoglobin', 'gene'] },
  { name: 'social-science', q: 'remote work productivity randomized', terms: ['remote work', 'work from home', 'productivity', 'random'] },
  { name: 'humanities', q: 'Ottoman Empire print culture', terms: ['ottoman', 'print', 'printing', 'book', 'culture'] }
];

const cookies = new Map();
const login = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }), redirect: 'manual'
});
applyCookies(login);
if (login.status !== 200 || !cookies.get('authToken')) throw new Error(`login failed: ${login.status}`);

const summaries = [];
for (const test of CASES) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/research/search?q=${encodeURIComponent(test.q)}&per_page=10`, {
    headers: { cookie: [...cookies.entries()].map(([k,v]) => `${k}=${v}`).join('; ') }, redirect: 'manual'
  });
  const latencyMs = Date.now() - started;
  const body = await response.json();
  if (response.status !== 200) throw new Error(`${test.name} failed ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  if (!Array.isArray(body.results) || body.results.length === 0) throw new Error(`${test.name} returned no results`);

  const works = body.results;
  const withDoi = works.filter((w) => w.doi).length;
  const withAbstract = works.filter((w) => w.evidence?.level === 'ABSTRACT' || w.evidence?.level === 'FULL_TEXT').length;
  const withOaKnown = works.filter((w) => typeof w.openAccess?.isOa === 'boolean').length;
  const withAuthors = works.filter((w) => Array.isArray(w.authors) && w.authors.length > 0).length;
  const withVenue = works.filter((w) => Boolean(w.venue?.name)).length;
  const openAlexProvenance = works.filter((w) => w.provenance?.some((p) => p.provider === 'openalex')).length;
  const crossrefProvenance = works.filter((w) => w.provenance?.some((p) => p.provider === 'crossref')).length;
  const top10Relevant = works.filter((w) => {
    const text = `${w.title || ''} ${w.abstract || ''}`.toLowerCase();
    return test.terms.some((term) => text.includes(term));
  }).length;

  const summary = {
    case: test.name,
    query: test.q,
    count: works.length,
    latencyMs,
    cached: body.meta?.cached === true,
    providers: body.meta?.providers,
    coverage: {
      doi: `${withDoi}/${works.length}`,
      abstract: `${withAbstract}/${works.length}`,
      oaKnown: `${withOaKnown}/${works.length}`,
      authors: `${withAuthors}/${works.length}`,
      venue: `${withVenue}/${works.length}`,
      openAlexProvenance: `${openAlexProvenance}/${works.length}`,
      crossrefProvenance: `${crossrefProvenance}/${works.length}`,
      coarseRelevant: `${top10Relevant}/${works.length}`
    },
    topTitles: works.slice(0, 5).map((w) => w.title)
  };
  summaries.push(summary);
  console.log('BENCHMARK_CASE', JSON.stringify(summary));
}

console.log('BENCHMARK_SUMMARY', JSON.stringify(summaries));

function applyCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : splitSetCookie(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) cookies.set(match[1], match[2]);
  }
}
function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((item) => item.trim());
}
