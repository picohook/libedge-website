const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('Missing smoke credentials');

// PRE-REGISTERED before observing candidate results.
// Human/blind PASS gate (applied after result-level labels are returned):
// 1) mean Relevant@10 must improve by >= 15 percentage points;
// 2) at least 5/8 queries must be non-worse and >= 3/8 must improve by >= 20 points;
// 3) no discipline mean may regress by > 10 points and no single query by > 20 points;
// 4) candidate must return >= 8 results for every query.
// Automated retrieval-safety guard below checks only (4) and coarse term regression; it is NOT the relevance decision.
const PASS_GATE = {
  meanRelevantGainPp: 15,
  minNonWorseQueries: 5,
  minStrongImprovementQueries: 3,
  strongImprovementPp: 20,
  maxDisciplineRegressionPp: 10,
  maxSingleQueryRegressionPp: 20,
  minResultsPerQuery: 8
};

const CASES = [
  {
    id: 'ME1', discipline: 'materials-energy',
    intent: 'PEM water electrolysis literature focused on low-iridium/iridium catalyst constraints and alternatives.',
    baseline: 'PEM water electrolysis low iridium catalyst',
    candidate: 'PEM "water electrolysis" low iridium catalyst',
    terms: ['pem', 'water electrolysis', 'iridium', 'catalyst', 'oer']
  },
  {
    id: 'ME2', discipline: 'materials-energy',
    intent: 'Anion-exchange membrane water electrolysis research on membrane durability/degradation.',
    baseline: 'anion exchange membrane water electrolysis durability',
    candidate: '"anion exchange membrane" "water electrolysis" durability',
    terms: ['anion exchange', 'aem', 'water electrolysis', 'durab', 'degrad']
  },
  {
    id: 'BM1', discipline: 'biomedical',
    intent: 'CRISPR base-editing approaches relevant to sickle-cell disease.',
    baseline: 'CRISPR base editing sickle cell',
    candidate: 'CRISPR "base editing" "sickle cell"',
    terms: ['crispr', 'base edit', 'sickle cell', 'hemoglobin', 'gene']
  },
  {
    id: 'BM2', discipline: 'biomedical',
    intent: 'Immune-checkpoint inhibitor therapy research specifically concerning melanoma resistance.',
    baseline: 'immune checkpoint inhibitor melanoma resistance',
    candidate: '"immune checkpoint" inhibitor melanoma resistance',
    terms: ['checkpoint', 'melanoma', 'resistance', 'pd-1', 'immunotherap']
  },
  {
    id: 'SS1', discipline: 'social-science',
    intent: 'Studies of remote work/work-from-home and productivity, with preference for randomized evidence.',
    baseline: 'remote work productivity randomized',
    candidate: '"remote work" productivity randomized',
    terms: ['remote work', 'work from home', 'productivity', 'random']
  },
  {
    id: 'SS2', discipline: 'social-science',
    intent: 'Research on social-media use and adolescent mental health.',
    baseline: 'social media adolescent mental health',
    candidate: '"social media" adolescent "mental health"',
    terms: ['social media', 'adolescent', 'mental health', 'depress', 'anxiety']
  },
  {
    id: 'HU1', discipline: 'humanities',
    intent: 'Scholarship on print/printing culture in the Ottoman Empire.',
    baseline: 'Ottoman Empire print culture',
    candidate: '"Ottoman Empire" "print culture"',
    terms: ['ottoman', 'print', 'printing', 'book', 'culture']
  },
  {
    id: 'HU2', discipline: 'humanities',
    intent: 'Scholarship on manuscript culture in medieval Europe.',
    baseline: 'medieval Europe manuscript culture',
    candidate: '"medieval Europe" "manuscript culture"',
    terms: ['medieval', 'manuscript', 'scrib', 'codex', 'book']
  }
];

const cookies = new Map();
await login();

const results = [];
for (const test of CASES) {
  const baseline = await runQuery(test.baseline, test.terms);
  const candidate = await runQuery(test.candidate, test.terms);
  if (candidate.count < PASS_GATE.minResultsPerQuery) {
    throw new Error(`${test.id} candidate returned ${candidate.count}; minimum is ${PASS_GATE.minResultsPerQuery}`);
  }
  results.push({ test, baseline, candidate });
}

const coarseRegressions = results.filter(({ baseline, candidate }) => candidate.coarseRelevant + 2 < baseline.coarseRelevant);
console.log('AB_PREREGISTERED_GATE', JSON.stringify(PASS_GATE));
console.log('AB_AUTOMATED_SAFETY', JSON.stringify({
  queries: results.length,
  coarseRegressionsOver2Results: coarseRegressions.map(({ test }) => test.id),
  note: 'Coarse terms are diagnostic only; human/blind result-level labels decide PASS.'
}));

// Randomized presentation order prevents a fixed A-first/B-first cue.
const blindBundle = results.map(({ test, baseline, candidate }, index) => {
  const candidateFirst = stableBit(test.id + ':' + index) === 1;
  const X = candidateFirst ? candidate : baseline;
  const Y = candidateFirst ? baseline : candidate;
  return {
    id: test.id,
    discipline: test.discipline,
    intent: test.intent,
    X: X.titles,
    Y: Y.titles
  };
});
console.log('AB_BLIND_BUNDLE', JSON.stringify(blindBundle));

// Mapping is emitted separately for the primary implementer, not for the blind evaluator.
console.log('AB_MAPPING', JSON.stringify(results.map(({ test }, index) => ({
  id: test.id,
  candidateLabel: stableBit(test.id + ':' + index) === 1 ? 'X' : 'Y'
}))));

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: 'manual'
  });
  applyCookies(response);
  if (response.status !== 200 || !cookies.get('authToken')) throw new Error(`login failed: ${response.status}`);
}

async function runQuery(q, terms) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/research/search?q=${encodeURIComponent(q)}&per_page=10`, {
    headers: { cookie: cookieHeader() }, redirect: 'manual'
  });
  const latencyMs = Date.now() - started;
  const body = await response.json();
  if (response.status !== 200) throw new Error(`query failed ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const works = Array.isArray(body.results) ? body.results : [];
  const coarseRelevant = works.filter((w) => {
    const text = `${w.title || ''} ${w.abstract || ''}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  }).length;
  return {
    count: works.length,
    latencyMs,
    providers: body.meta?.providers,
    coarseRelevant,
    titles: works.slice(0, 10).map((w) => w.title)
  };
}

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
function applyCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : splitSetCookie(response.headers.get('set-cookie'));
  for (const cookie of values) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(cookie || '');
    if (match?.[2]) cookies.set(match[1], match[2]);
  }
}
function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((item) => item.trim());
}
function stableBit(value) {
  let hash = 2166136261;
  for (const ch of value) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash & 1;
}
