import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeOpenAlexWork, extractOpenAlexTelemetry } from '../backend/src/research/providers/openalex.js';

const OPENALEX_BASE = 'https://api.openalex.org/works';
const MODE = String(process.env.P05_RETRIEVAL_MODE || 'fresh').trim().toLowerCase();
const VALIDATE_ONLY = process.env.P05_VALIDATE_ONLY === '1';
const SOURCE_PATH = process.env.P05_QUERY_SOURCE
  || (MODE === 'harm' ? 'scripts/research-query-conditional.mjs' : 'docs/experiments/p05-hybrid-semantic-holdout.md');
const OUT_DIR = process.env.P05_OUTPUT_DIR
  || (MODE === 'harm' ? 'docs/experiments/p05-harm-regression-retrieval' : 'docs/experiments/p05-hybrid-semantic-retrieval');
const SUMMARY_PATH = `${OUT_DIR}/summary.json`;
const API_KEY = process.env.OPENALEX_API_KEY;
const MAX_RETRIES = 2;
const EXPECTED_COST_USD = 0.001;
const RRF_K = 60;
const GLOBAL_CALL_CAP = 120;
const EXPECTED_QUERY_COUNT = Number(process.env.P05_EXPECTED_QUERY_COUNT || (MODE === 'harm' ? 5 : 40));
const PRIOR_CHARGED_CALLS = Number(process.env.P05_PRIOR_CHARGED_CALLS || 0);
const PRIOR_OBSERVED_COST_USD = Number(process.env.P05_PRIOR_OBSERVED_COST_USD || 0);
const RESERVED_FUTURE_CALLS = Number(process.env.P05_RESERVED_FUTURE_CALLS || (MODE === 'fresh' ? 10 : 0));
const SELECTED_IDS = String(process.env.P05_QUERY_IDS || (MODE === 'harm' ? 'A1,A2,A5,A6,A7' : ''))
  .split(',').map((v) => v.trim()).filter(Boolean);

if (!['fresh', 'harm'].includes(MODE)) throw new Error(`Unsupported P05_RETRIEVAL_MODE: ${MODE}`);
if (!Number.isInteger(EXPECTED_QUERY_COUNT) || EXPECTED_QUERY_COUNT <= 0) throw new Error('P05_EXPECTED_QUERY_COUNT must be a positive integer');
if (!Number.isInteger(PRIOR_CHARGED_CALLS) || PRIOR_CHARGED_CALLS < 0) throw new Error('P05_PRIOR_CHARGED_CALLS must be a non-negative integer');
if (!Number.isFinite(PRIOR_OBSERVED_COST_USD) || PRIOR_OBSERVED_COST_USD < 0) throw new Error('P05_PRIOR_OBSERVED_COST_USD must be non-negative');
if (!Number.isInteger(RESERVED_FUTURE_CALLS) || RESERVED_FUTURE_CALLS < 0) throw new Error('P05_RESERVED_FUTURE_CALLS must be a non-negative integer');
if (PRIOR_CHARGED_CALLS + RESERVED_FUTURE_CALLS >= GLOBAL_CALL_CAP) throw new Error('No provider-call budget remains under the frozen global cap');

const LOCAL_ATTEMPT_CAP = GLOBAL_CALL_CAP - PRIOR_CHARGED_CALLS - RESERVED_FUTURE_CALLS;

let totalAttempts = 0;
let chargedResponses = 0;
let observedCostUsd = 0;
const pricingAnomalies = [];
let lastSemanticStartedAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseFreshHoldout(markdown) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\|\s*(ME|BM|SS|HU)\d{2}\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((v) => v.trim());
    if (cells.length < 4) continue;
    const [id, domain, intent, slicesRaw] = cells;
    rows.push({
      id,
      domain,
      intent,
      retrievalText: intent,
      slices: slicesRaw === '—' ? [] : slicesRaw.split(',').map((v) => v.trim()).filter(Boolean),
      sourceKind: 'fresh-holdout-markdown'
    });
  }
  return rows;
}

function parseHistoricalCases(sourceText) {
  const rows = [];
  const casePattern = /\{\s*id:'([^']+)',\s*group:'([^']+)',\s*discipline:'([^']+)',\s*intent:'([^']*)',\s*q:'([^']*)',\s*probePhrase:'([^']*)'\s*\}/g;
  for (const match of sourceText.matchAll(casePattern)) {
    const [, id, group, discipline, intent, q, probePhrase] = match;
    rows.push({
      id,
      domain: discipline,
      intent,
      retrievalText: q,
      slices: [],
      group,
      probePhrase,
      sourceKind: 'p05a-historical-case-source'
    });
  }
  return rows;
}

async function loadQueries() {
  const sourceText = await fs.readFile(SOURCE_PATH, 'utf8');
  if (MODE === 'fresh') return parseFreshHoldout(sourceText);

  const allCases = parseHistoricalCases(sourceText);
  const byId = new Map(allCases.map((row) => [row.id, row]));
  const missing = SELECTED_IDS.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`Selected historical case IDs not found in canonical source: ${missing.join(',')}`);
  if (new Set(SELECTED_IDS).size !== SELECTED_IDS.length) throw new Error('Duplicate P05_QUERY_IDS are not permitted');
  return SELECTED_IDS.map((id) => byId.get(id));
}

function normalizeDoi(value) {
  if (!value) return null;
  return String(value).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase() || null;
}

function normalizeTitleIdentity(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function openAlexId(record) {
  if (!record?.id) return null;
  return String(record.id).replace(/^https?:\/\/openalex\.org\//i, '') || null;
}

function canonicalIdentity(record) {
  const oa = openAlexId(record);
  if (oa) return `openalex:${oa}`;
  const doi = normalizeDoi(record?.doi || record?.ids?.doi);
  if (doi) return `doi:${doi}`;
  const title = normalizeTitleIdentity(record?.title || record?.display_name);
  return title ? `title:${title}` : null;
}

function dedupeRanked(rawRecords) {
  const seen = new Set();
  const out = [];
  rawRecords.forEach((record, index) => {
    const normalized = normalizeOpenAlexWork(record);
    if (!normalized) return;
    const identity = canonicalIdentity(record);
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    out.push({ identity, providerRank: index + 1, raw: record, normalized });
  });
  return out;
}

function compareNullableRank(a, b) {
  return (Number.isInteger(a) ? a : Infinity) - (Number.isInteger(b) ? b : Infinity);
}

function buildHybrid(lPool, sPool) {
  const byId = new Map();
  for (const item of lPool) {
    byId.set(item.identity, {
      identity: item.identity,
      lRank: item.providerRank,
      sRank: null,
      raw: item.raw,
      normalized: item.normalized
    });
  }
  for (const item of sPool) {
    const existing = byId.get(item.identity);
    if (existing) existing.sRank = item.providerRank;
    else {
      byId.set(item.identity, {
        identity: item.identity,
        lRank: null,
        sRank: item.providerRank,
        raw: item.raw,
        normalized: item.normalized
      });
    }
  }

  const items = [...byId.values()].map((item) => ({
    ...item,
    rrf: (item.lRank == null ? 0 : 1 / (RRF_K + item.lRank))
      + (item.sRank == null ? 0 : 1 / (RRF_K + item.sRank))
  }));

  items.sort((a, b) => {
    if (b.rrf !== a.rrf) return b.rrf - a.rrf;
    const aMin = Math.min(a.lRank ?? Infinity, a.sRank ?? Infinity);
    const bMin = Math.min(b.lRank ?? Infinity, b.sRank ?? Infinity);
    if (aMin !== bMin) return aMin - bMin;
    const lCmp = compareNullableRank(a.lRank, b.lRank);
    if (lCmp !== 0) return lCmp;
    const sCmp = compareNullableRank(a.sRank, b.sRank);
    if (sCmp !== 0) return sCmp;
    return a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0;
  });

  return items.map((item, index) => ({ ...item, hRank: index + 1 }));
}

function isRetryable(error) {
  if (error?.name === 'AbortError') return true;
  if (error?.cause?.code && /^(ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ECONNREFUSED)$/.test(error.cause.code)) return true;
  const status = Number(error?.status);
  return status === 429 || status >= 500;
}

async function paceSemantic() {
  const elapsed = Date.now() - lastSemanticStartedAt;
  if (lastSemanticStartedAt && elapsed < 1100) await sleep(1100 - elapsed);
  lastSemanticStartedAt = Date.now();
}

function parseHeaderNumber(response, name) {
  const raw = response.headers.get(name);
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function costEvidence(response, payload) {
  const headerCostUsd = parseHeaderNumber(response, 'X-RateLimit-Cost-USD');
  const bodyRaw = payload?.meta?.cost_usd;
  const bodyCostUsd = Number.isFinite(Number(bodyRaw)) ? Number(bodyRaw) : null;
  return {
    headerCostUsd,
    bodyCostUsd,
    conflict: headerCostUsd != null && bodyCostUsd != null && Math.abs(headerCostUsd - bodyCostUsd) > 1e-9
  };
}

function recordPricingObservation(arm, attemptNumber, startedAt, evidence, telemetry) {
  const observed = telemetry.requestCostUsd;
  if (observed != null) {
    chargedResponses += 1;
    observedCostUsd += observed;
  }
  const differs = observed != null && Math.abs(observed - EXPECTED_COST_USD) > 1e-9;
  if (differs || evidence.conflict) {
    pricingAnomalies.push({
      arm,
      attemptNumber,
      startedAt,
      expectedCostUsd: EXPECTED_COST_USD,
      observedCostUsd: observed,
      headerCostUsd: evidence.headerCostUsd,
      bodyCostUsd: evidence.bodyCostUsd,
      bodyHeaderConflict: evidence.conflict
    });
  }
}

async function providerCall(retrievalText, arm, attemptNumber) {
  if (totalAttempts >= LOCAL_ATTEMPT_CAP) {
    const error = new Error('GLOBAL_EXPERIMENT_CALL_CAP_REACHED');
    error.nonRetryable = true;
    throw error;
  }

  if (arm === 'S') await paceSemantic();
  totalAttempts += 1;

  const url = new URL(OPENALEX_BASE);
  url.searchParams.set(arm === 'L' ? 'search' : 'search.semantic', retrievalText);
  url.searchParams.set('per-page', arm === 'L' ? '100' : '50');
  url.searchParams.set('api_key', API_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }

    const telemetry = extractOpenAlexTelemetry(response, payload);
    const evidence = costEvidence(response, payload);
    recordPricingObservation(arm, attemptNumber, startedAt, evidence, telemetry);

    if (!response.ok) {
      const error = new Error(`HTTP_${response.status}`);
      error.status = response.status;
      error.telemetry = telemetry;
      error.costEvidence = evidence;
      throw error;
    }

    return {
      status: response.status,
      startedAt,
      retrievedAt: new Date().toISOString(),
      telemetry,
      costEvidence: evidence,
      rawRecords: Array.isArray(payload?.results) ? payload.results : []
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArm(retrievalText, arm) {
  const attempts = [];
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    const attemptNumber = retry + 1;
    try {
      const result = await providerCall(retrievalText, arm, attemptNumber);
      attempts.push({
        attemptNumber,
        ok: true,
        status: result.status,
        startedAt: result.startedAt,
        retrievedAt: result.retrievedAt,
        telemetry: result.telemetry,
        costEvidence: result.costEvidence
      });
      return { status: 'success', attempts, result };
    } catch (error) {
      attempts.push({
        attemptNumber,
        ok: false,
        status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
        code: error?.name === 'AbortError' ? 'TIMEOUT' : String(error?.message || 'PROVIDER_ERROR'),
        telemetry: error?.telemetry || null,
        costEvidence: error?.costEvidence || null,
        at: new Date().toISOString()
      });

      if (error?.nonRetryable) throw error;
      if (!isRetryable(error)) {
        const fatal = new Error(`NON_RETRYABLE_PROVIDER_ERROR_${arm}_${attempts.at(-1).status ?? 'UNKNOWN'}`);
        fatal.nonRetryable = true;
        fatal.arm = arm;
        fatal.attempts = attempts;
        throw fatal;
      }
      if (retry === MAX_RETRIES) break;
      await sleep(750 * (retry + 1));
    }
  }
  return { status: 'retrieval-failure', attempts, result: null };
}

function aggregate(summary) {
  return {
    totalAttempts,
    chargedResponses,
    observedCostUsd: Number(observedCostUsd.toFixed(6)),
    cumulativeExperiment: {
      priorChargedCalls: PRIOR_CHARGED_CALLS,
      priorObservedCostUsd: Number(PRIOR_OBSERVED_COST_USD.toFixed(6)),
      currentRunAttemptsUpperBound: totalAttempts,
      currentRunChargedResponses: chargedResponses,
      cumulativeChargedResponses: PRIOR_CHARGED_CALLS + chargedResponses,
      cumulativeObservedCostUsd: Number((PRIOR_OBSERVED_COST_USD + observedCostUsd).toFixed(6)),
      globalCallCap: GLOBAL_CALL_CAP,
      reservedFutureCalls: RESERVED_FUTURE_CALLS,
      localAttemptCap: LOCAL_ATTEMPT_CAP
    },
    pricingAnomalies,
    successes: {
      L: summary.queries.filter((q) => q.L.status === 'success').length,
      S: summary.queries.filter((q) => q.S.status === 'success').length,
      H: summary.queries.filter((q) => q.H.status === 'success').length
    },
    retrievalFailures: {
      L: summary.queries.filter((q) => q.L.status !== 'success').map((q) => q.id),
      S: summary.queries.filter((q) => q.S.status !== 'success').map((q) => q.id)
    }
  };
}

async function writeSummary(summary, fatal = null) {
  summary.aggregate = aggregate(summary);
  summary.executionFinishedAt = new Date().toISOString();
  if (fatal) summary.fatal = fatal;
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

const queries = await loadQueries();
if (queries.length !== EXPECTED_QUERY_COUNT) throw new Error(`Expected ${EXPECTED_QUERY_COUNT} selected intents, parsed ${queries.length}`);

const inputManifest = {
  mode: MODE,
  sourcePath: SOURCE_PATH,
  selectedIds: queries.map((q) => q.id),
  expectedQueryCount: EXPECTED_QUERY_COUNT,
  queries: queries.map(({ id, domain, intent, retrievalText, sourceKind }) => ({ id, domain, intent, retrievalText, sourceKind })),
  frozenParameters: { lexicalDepth: 100, semanticDepth: 50, rrfK: 60, maxRetriesPerArm: 2 },
  budget: {
    priorChargedCalls: PRIOR_CHARGED_CALLS,
    priorObservedCostUsd: Number(PRIOR_OBSERVED_COST_USD.toFixed(6)),
    globalCallCap: GLOBAL_CALL_CAP,
    reservedFutureCalls: RESERVED_FUTURE_CALLS,
    localAttemptCap: LOCAL_ATTEMPT_CAP
  }
};

if (VALIDATE_ONLY) {
  console.log('P05_RETRIEVAL_INPUT_VALIDATED', JSON.stringify(inputManifest));
  process.exit(0);
}

if (!API_KEY) throw new Error('OPENALEX_API_KEY is required');
await fs.mkdir(OUT_DIR, { recursive: true });

const summary = {
  protocol: 'P0.5 Hybrid Semantic Retrieval',
  executionMode: MODE,
  sourceQueryFile: SOURCE_PATH,
  selectedIds: queries.map((q) => q.id),
  executionStartedAt: new Date().toISOString(),
  frozenParameters: inputManifest.frozenParameters,
  budget: inputManifest.budget,
  queries: [],
  aggregate: null
};

try {
  for (const query of queries) {
    const l = await fetchArm(query.retrievalText, 'L');
    if (pricingAnomalies.length) {
      await writeSummary(summary, { code: 'D013_PRICING_ANOMALY', queryId: query.id, afterArm: 'L' });
      throw new Error('D013_PRICING_ANOMALY');
    }

    const s = await fetchArm(query.retrievalText, 'S');
    if (pricingAnomalies.length) {
      await writeSummary(summary, { code: 'D013_PRICING_ANOMALY', queryId: query.id, afterArm: 'S' });
      throw new Error('D013_PRICING_ANOMALY');
    }

    const lPool = l.status === 'success' ? dedupeRanked(l.result.rawRecords) : [];
    const sPool = s.status === 'success' ? dedupeRanked(s.result.rawRecords) : [];
    const hPool = l.status === 'success' && s.status === 'success' ? buildHybrid(lPool, sPool) : null;

    const record = {
      id: query.id,
      domain: query.domain,
      intent: query.intent,
      retrievalText: query.retrievalText,
      sourceKind: query.sourceKind,
      slices: query.slices,
      execution: {
        L: { status: l.status, attempts: l.attempts, rawCount: l.result?.rawRecords?.length ?? null, uniqueNormalizedCount: l.status === 'success' ? lPool.length : null },
        S: { status: s.status, attempts: s.attempts, rawCount: s.result?.rawRecords?.length ?? null, uniqueNormalizedCount: s.status === 'success' ? sPool.length : null },
        H: { status: hPool ? 'success' : 'invalid-retrieval-failure', uniqueNormalizedCount: hPool?.length ?? null }
      },
      pools: { L: lPool, S: sPool, H: hPool },
      top10: {
        L: lPool.slice(0, 10).map(({ identity, providerRank, normalized }) => ({ identity, rank: providerRank, work: normalized })),
        S: sPool.slice(0, 10).map(({ identity, providerRank, normalized }) => ({ identity, rank: providerRank, work: normalized })),
        H: hPool ? hPool.slice(0, 10).map(({ identity, hRank, lRank, sRank, rrf, normalized }) => ({ identity, rank: hRank, lRank, sRank, rrf, work: normalized })) : null
      }
    };

    await fs.writeFile(path.join(OUT_DIR, `${query.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
    summary.queries.push({
      id: query.id,
      domain: query.domain,
      intent: query.intent,
      retrievalText: query.retrievalText,
      sourceKind: query.sourceKind,
      L: record.execution.L,
      S: record.execution.S,
      H: record.execution.H
    });
    await writeSummary(summary);
  }

  await writeSummary(summary);
  console.log(JSON.stringify(summary.aggregate, null, 2));
} catch (error) {
  if (!summary.fatal) {
    await writeSummary(summary, {
      code: String(error?.message || 'EXECUTION_FAILED'),
      arm: error?.arm || null,
      attempts: error?.attempts || null
    });
  }
  throw error;
}
