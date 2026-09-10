const BASE_URL = String(process.env.LIBEDGE_SMOKE_BASE_URL || 'https://staging.libedge-website.pages.dev').replace(/\/+$/, '');
const EMAIL = process.env.LIBEDGE_SMOKE_EMAIL;
const PASSWORD = process.env.LIBEDGE_SMOKE_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('Missing smoke credentials');

const GATE_A = {
  minPrecision: 0.85,
  minRecall: 0.70,
  maxJargonFalsePositiveRate: 0.10,
  maxHarmfulApplicationRate: 0.10
};
const GATE_B = {
  minMeanGainPp: 5,
  minNonWorse: 24,
  minStrongImprovement: 5,
  strongImprovementPp: 20,
  maxDisciplineRegressionPp: 5,
  maxSingleQueryRegressionPp: 20,
  minResultsPerQuery: 8
};

const ALLOW_PHRASES = [
  'remote learning', 'digital divide', 'labor market', 'print media', 'social capital',
  'green hydrogen', 'energy transition', 'manuscript transmission', 'open science', 'public history'
];
const TECHNICAL_MARKERS = [
  'pem', 'aemwe', 'iro2', 'oer', 'pt/c', 'orr', 'pemfc', 'crispr', 'cas9', 'hbb',
  'pd-1', 'ctla-4', 'scrna-seq', 'li-s', 'qens', 'etfe', 'aem', 'xps', 'nmr',
  'randomized controlled trial', 'difference-in-differences', 'instrumental variable', 'latent class'
];

const CASES = [
  { id:'A1', group:'ambiguity', discipline:'social-science', intent:'Research on remote learning and student engagement.', q:'remote learning student engagement', probePhrase:'remote learning' },
  { id:'A2', group:'ambiguity', discipline:'social-science', intent:'Research on the digital divide in rural education.', q:'digital divide rural education', probePhrase:'digital divide' },
  { id:'A3', group:'ambiguity', discipline:'social-science', intent:'Research on labor-market polarization associated with automation.', q:'labor market polarization automation', probePhrase:'labor market' },
  { id:'A4', group:'ambiguity', discipline:'social-science', intent:'Research on print media and political trust.', q:'print media political trust', probePhrase:'print media' },
  { id:'A5', group:'ambiguity', discipline:'social-science', intent:'Research on social capital and neighborhood health outcomes.', q:'social capital neighborhood health', probePhrase:'social capital' },
  { id:'A6', group:'ambiguity', discipline:'materials-energy', intent:'Research on policy incentives for green hydrogen.', q:'green hydrogen policy incentives', probePhrase:'green hydrogen' },
  { id:'A7', group:'ambiguity', discipline:'materials-energy', intent:'Research on public acceptance of the energy transition.', q:'energy transition public acceptance', probePhrase:'energy transition' },
  { id:'A8', group:'ambiguity', discipline:'humanities', intent:'Scholarship on manuscript transmission of classical texts.', q:'manuscript transmission classical texts', probePhrase:'manuscript transmission' },
  { id:'A9', group:'ambiguity', discipline:'social-science', intent:'Research on open science and research assessment.', q:'open science research assessment', probePhrase:'open science' },
  { id:'A10', group:'ambiguity', discipline:'humanities', intent:'Scholarship on public history and museum interpretation.', q:'public history museum interpretation', probePhrase:'public history' },

  { id:'J1', group:'jargon', discipline:'materials-energy', intent:'PEM water-electrolyzer research on IrO2 OER stability.', q:'PEM water electrolyzer IrO2 OER stability', probePhrase:'water electrolyzer' },
  { id:'J2', group:'jargon', discipline:'materials-energy', intent:'AEMWE membrane degradation under alkaline operation.', q:'AEMWE membrane degradation alkaline', probePhrase:'membrane degradation' },
  { id:'J3', group:'jargon', discipline:'materials-energy', intent:'Pt/C ORR graphene studies for PEM fuel cells.', q:'Pt/C ORR graphene PEMFC', probePhrase:'ORR graphene' },
  { id:'J4', group:'jargon', discipline:'biomedical', intent:'CRISPR-Cas9 HBB editing for sickle-cell disease.', q:'CRISPR Cas9 HBB editing sickle cell', probePhrase:'sickle cell' },
  { id:'J5', group:'jargon', discipline:'biomedical', intent:'PD-1/CTLA-4 checkpoint resistance in melanoma.', q:'PD-1 CTLA-4 melanoma resistance', probePhrase:'melanoma resistance' },
  { id:'J6', group:'jargon', discipline:'biomedical', intent:'Single-cell RNA-seq studies of T-cell exhaustion in tumors.', q:'scRNA-seq T cell exhaustion tumor', probePhrase:'T cell' },
  { id:'J7', group:'jargon', discipline:'materials-energy', intent:'Lithium-sulfur battery work on polysulfide shuttle and separators.', q:'Li-S battery polysulfide shuttle separator', probePhrase:'polysulfide shuttle' },
  { id:'J8', group:'jargon', discipline:'materials-energy', intent:'QENS studies of ETFE radiation-grafted anion-exchange membranes.', q:'QENS ETFE radiation grafted AEM', probePhrase:'radiation grafted' },
  { id:'J9', group:'jargon', discipline:'social-science', intent:'Difference-in-differences research on minimum-wage employment effects.', q:'difference-in-differences minimum wage employment', probePhrase:'minimum wage' },
  { id:'J10', group:'jargon', discipline:'social-science', intent:'Instrumental-variable studies of education returns.', q:'instrumental variable education returns', probePhrase:'education returns' },

  { id:'N1', group:'neutral', discipline:'materials-energy', intent:'Research on renewable-energy investment policy.', q:'renewable energy investment policy', probePhrase:'renewable energy' },
  { id:'N2', group:'neutral', discipline:'social-science', intent:'Research on workplace flexibility and employee satisfaction.', q:'workplace flexibility employee satisfaction', probePhrase:'workplace flexibility' },
  { id:'N3', group:'neutral', discipline:'biomedical', intent:'Research on adolescent sleep and academic performance.', q:'adolescent sleep academic performance', probePhrase:'adolescent sleep' },
  { id:'N4', group:'neutral', discipline:'biomedical', intent:'Research on barriers to cancer-screening participation.', q:'cancer screening participation barriers', probePhrase:'cancer screening' },
  { id:'N5', group:'neutral', discipline:'humanities', intent:'Scholarship on medieval trade in Mediterranean cities.', q:'medieval trade Mediterranean cities', probePhrase:'medieval trade' },
  { id:'N6', group:'neutral', discipline:'humanities', intent:'Scholarship on Ottoman provincial tax administration.', q:'Ottoman tax administration provinces', probePhrase:'tax administration' },
  { id:'N7', group:'neutral', discipline:'materials-energy', intent:'Research on environmental impacts of battery recycling.', q:'battery recycling environmental impacts', probePhrase:'battery recycling' },
  { id:'N8', group:'neutral', discipline:'social-science', intent:'Research on public trust in science communication.', q:'public trust science communication', probePhrase:'science communication' },
  { id:'N9', group:'neutral', discipline:'social-science', intent:'Research on migration policy and labor integration.', q:'migration policy labor integration', probePhrase:'migration policy' },
  { id:'N10', group:'neutral', discipline:'humanities', intent:'Scholarship on digitization and access to museum collections.', q:'museum collections digitization access', probePhrase:'museum collections' }
];

function normalize(s) { return String(s || '').toLowerCase(); }
function heuristic(query) {
  const text = normalize(query);
  const markerHits = TECHNICAL_MARKERS.filter((m) => text.includes(m));
  const acronymLike = String(query).split(/\s+/).filter((t) => /^[A-Z0-9][A-Z0-9./-]{2,}$/.test(t)).length;
  const jargonVeto = markerHits.length >= 1 || acronymLike >= 2;
  const phraseHits = ALLOW_PHRASES.filter((p) => text.includes(p));
  if (jargonVeto) return { apply:false, reason:'jargon-veto', markerHits, phraseHits };
  if (phraseHits.length !== 1) return { apply:false, reason:phraseHits.length > 1 ? 'multiple-allow-signals' : 'no-allow-signal', markerHits, phraseHits };
  return { apply:true, reason:'single-allow-signal', markerHits, phraseHits };
}
function quotePhrase(query, phrase) {
  const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return query.replace(re, `"${phrase}"`);
}

const cookies = new Map();
await login();
const rows = [];
for (const test of CASES) {
  const baseline = await runQuery(test.q);
  const phraseQuery = quotePhrase(test.q, test.probePhrase);
  const phrase = await runQuery(phraseQuery);
  const prediction = heuristic(test.q);
  const selected = prediction.apply ? phrase : baseline;
  if (selected.count < GATE_B.minResultsPerQuery) throw new Error(`${test.id} selected result count ${selected.count}`);
  rows.push({ test, baseline, phrase, prediction, phraseQuery });
}

const blindBundle = rows.map(({test, baseline, phrase}, index) => {
  const phraseFirst = stableBit(`p05a:${test.id}:${index}`) === 1;
  return {
    id:test.id,
    group:test.group,
    discipline:test.discipline,
    intent:test.intent,
    X:(phraseFirst ? phrase : baseline).titles,
    Y:(phraseFirst ? baseline : phrase).titles
  };
});
const mapping = rows.map(({test, prediction, phraseQuery}, index) => ({
  id:test.id,
  phraseLabel:stableBit(`p05a:${test.id}:${index}`) === 1 ? 'X' : 'Y',
  heuristicApply:prediction.apply,
  heuristicReason:prediction.reason,
  phraseQuery
}));

console.log('P05A_PREREGISTERED', JSON.stringify({holdout:{total:30, ambiguity:10, jargon:10, neutral:10}, gateA:GATE_A, gateB:GATE_B, precedence:'jargon-veto-overrides-allow', onePhraseMax:true}));
console.log('P05A_BLIND_BUNDLE', JSON.stringify(blindBundle));
console.log('P05A_MAPPING', JSON.stringify(mapping));

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method:'POST', headers:{'content-type':'application/json', origin:new URL(BASE_URL).origin},
    body:JSON.stringify({email:EMAIL, password:PASSWORD}), redirect:'manual'
  });
  applyCookies(response);
  if (response.status !== 200 || !cookies.get('authToken')) throw new Error(`login failed: ${response.status}`);
}
async function runQuery(q) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/research/search?q=${encodeURIComponent(q)}&per_page=10`, {headers:{cookie:cookieHeader()}, redirect:'manual'});
  const body = await response.json();
  if (response.status !== 200) throw new Error(`query failed ${response.status}: ${JSON.stringify(body).slice(0,300)}`);
  const works = Array.isArray(body.results) ? body.results : [];
  return {count:works.length, latencyMs:Date.now()-started, titles:works.slice(0,10).map((w)=>w.title)};
}
function cookieHeader(){return [...cookies.entries()].map(([k,v])=>`${k}=${v}`).join('; ')}
function applyCookies(response){const values=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():splitSetCookie(response.headers.get('set-cookie'));for(const cookie of values){const match=/^([^=;\s]+)=([^;]*)/.exec(cookie||'');if(match?.[2])cookies.set(match[1],match[2]);}}
function splitSetCookie(value){if(!value)return[];return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((item)=>item.trim());}
function stableBit(value){let hash=2166136261;for(const ch of value)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;return hash&1;}
