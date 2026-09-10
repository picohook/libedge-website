import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeOpenAlexWork, extractOpenAlexTelemetry } from '../backend/src/research/providers/openalex.js';

const OPENALEX_BASE = 'https://api.openalex.org/works';
const HOLDOUT_PATH = 'docs/experiments/p05-hybrid-semantic-holdout.md';
const OUT_DIR = 'docs/experiments/p05-hybrid-semantic-retrieval';
const SUMMARY_PATH = `${OUT_DIR}/summary.json`;
const API_KEY = process.env.OPENALEX_API_KEY;
const MAX_RETRIES = 2;
const MAX_FRESH_ATTEMPTS = 110; // 80 required fresh calls + at most 30 experiment-wide retry headroom; preserves 10 mandatory harm-slice base calls.
const EXPECTED_COST_USD = 0.001;
const RRF_K = 60;

if (!API_KEY) throw new Error('OPENALEX_API_KEY is required');

let totalAttempts = 0;
let chargedResponses = 0;
let observedCostUsd = 0;
let pricingAnomalies = [];
let lastSemanticStartedAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseHoldout(markdown) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\|\s*(ME|BM|SS|HU)\d{2}\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((v) => v.trim());
    if (cells.length < 4) continue;
    const [id, domain, intent, slicesRaw] = cells;
    const slices = slicesRaw === '—' ? [] : slicesRaw.split(',').map((v) => v.trim()).filter(Boolean);
    rows.push({ id, domain, intent, slices });
  }
  return rows;
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
    const identity = canonicalIdentity(record);
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    out.push({ identity, providerRank: index + 1, raw: record, normalized: normalizeOpenAlexWork(record) });
  });
  return out;
}

function compareNullableRank(a, b) {
  const aa = Number.isInteger(a) ? a : Number.POSITIVE_INFINITY;
  const bb = Number.isInteger(b) ? b : Number.POSITIVE_INFINITY;
  return aa - bb;
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
    if (existing) {
      existing.sRank = item.providerRank;
    } else {
      byId.set(item.identity, {
        identity: item.identity,
        lRank: null,
        sRank: item.providerRank,
        raw: item.raw,
        normalized: item.normalized
      });
    }
  }

  const items = [...byId.values()].map((item) => {
    const l = item.lRank == null ? 0 : 1 / (RRF_K + item.lRank);
    const s = item.sRank == null ? 0 : 1 / (RRF_K + item.sRank);
    return { ...item, rrf: l + s };
  });

  items.sort((a, b) => {
    if (b.rrf !== a.rrf) return b.rrf - a.rrf;
    const aMin = Math.min(a.lRank ?? Infinity, a.sRank ?? Infinity);
    const bMin = Math.min(b.lRank ?? Infinity, b.sRank ?? Infinity);
    if (aMin !== bMin) return aMin - bMin;
    const lCmp = compareNullableRank(a.lRank, b.lRank);
    if (lCmp !== 0) return lCmp;
    const sCmp = compareNullableRank(a.sRank, b.sRank);
    if (sCmp !== 0) return sCmp;
    return a.identity.localeCompare(b.identity, 'en');
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
  const now = Date.now();
  const elapsed = now - lastSemanticStartedAt;
  if (lastSemanticStartedAt && elapsed < 1100) await sleep(1100 - elapsed);
  lastSemanticStartedAt = Date.now();
}

async function providerCall(intent, arm, attemptNumber) {
  if (totalAttempts >= MAX_FRESH_ATTEMPTS) {
    const error = new Error('FRESH_ATTEMPT_CAP_REACHED');
    error.nonRetryable = true;
    throw error;
  }

  if (arm === 'S') await paceSemantic();
  totalAttempts += 1;

  const url = new URL(OPENALEX_BASE);
  url.searchParams.set(arm === 'L' ? 'search' : 'search.semantic', intent);
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
    if (telemetry.requestCostUsd != null) {
      chargedResponses += 1;
      observedCostUsd += telemetry.requestCostUsd;
      if (Math.abs(telemetry.requestCostUsd - EXPECTED_COST_USD) > 1e-9) {
        pricingAnomalies.push({ arm, attemptNumber, observed: telemetry.requestCostUsd, startedAt });
      }
    }

    if (!response.ok) {
      const error = new Error(`HTTP_${response.status}`);
      error.status = response.status;
      error.telemetry = telemetry;
      error.startedAt = startedAt;
      throw error;
    }

    return {
      ok: true,
      status: response.status,
      startedAt,
      retrievedAt: new Date().toISOString(),
      telemetry,
      rawRecords: Array.isArray(payload?.results) ? payload.results : []
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArm(intent, arm) {
  const attempts = [];
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    const attemptNumber = retry + 1;
    try {
      const result = await providerCall(intent, arm, attemptNumber);
      attempts.push({
        attemptNumber,
        ok: true,
        status: result.status,
        startedAt: result.startedAt,
        retrievedAt: result.retrievedAt,
        telemetry: result.telemetry
      });
      return { status: 'success', attempts, result };
    } catch (error) {
      attempts.push({
        attemptNumber,
        ok: false,
        status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
        code: error?.name === 'AbortError' ? 'TIMEOUT' : String(error?.message || 'PROVIDER_ERROR'),
        telemetry: error?.telemetry || null,
        at: new Date().toISOString()
      });
      if (error?.nonRetryable || !isRetryable(error) || retry === MAX_RETRIES) break;
      await sleep(750 * (retry + 1));
    }
  }
  return { status: 'retrieval-failure', attempts, result: null };
}

const holdoutMd = await fs.readFile(HOLDOUT_PATH, 'utf8');
const queries = parseHoldout(holdoutMd);
if (queries.length !== 40) throw new Error(`Expected 40 frozen intents, parsed ${queries.length}`);

await fs.mkdir(OUT_DIR, { recursive: true });

const summary = {
  protocol: 'P0.5 Hybrid Semantic Retrieval',
  sourceHoldout: HOLDOUT_PATH,
  executionStartedAt: new Date().toISOString(),
  frozenParameters: { lexicalDepth: 100, semanticDepth: 50, rrfK: 60, maxRetriesPerArm: 2 },
  queries: [],
  aggregate: null
};

for (const query of queries) {
  const l = await fetchArm(query.intent, 'L');
  const s = await fetchArm(query.intent, 'S');

  const lPool = l.status === 'success' ? dedupeRanked(l.result.rawRecords) : [];
  const sPool = s.status === 'success' ? dedupeRanked(s.result.rawRecords) : [];
  const hPool = l.status === 'success' && s.status === 'success' ? buildHybrid(lPool, sPool) : null;

  const record = {
    id: query.id,
    domain: query.domain,
    intent: query.intent,
    slices: query.slices,
    execution: {
      L: { status: l.status, attempts: l.attempts, rawCount: l.result?.rawRecords?.length ?? null, uniqueNormalizedCount: l.status === 'success' ? lPool.length : null },
      S: { status: s.status, attempts: s.attempts, rawCount: s.result?.rawRecords?.length ?? null, uniqueNormalizedCount: s.status === 'success' ? sPool.length : null },
      H: { status: hPool ? 'success' : 'invalid-retrieval-failure', uniqueNormalizedCount: hPool?.length ?? null }
    },
    pools: {
      L: lPool,
      S: sPool,
      H: hPool
    },
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
    slices: query.slices,
    L: record.execution.L,
    S: record.execution.S,
    H: record.execution.H
  });
}

summary.executionFinishedAt = new Date().toISOString();
summary.aggregate = {
  totalAttempts,
  chargedResponses,
  observedCostUsd: Number(observedCostUsd.toFixed(6)),
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

await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary.aggregate, null, 2));

if (pricingAnomalies.length > 0) {
  console.error('D-013 pricing anomaly detected; results preserved, governance review required before continuing.');
  process.exitCode = 2;
}
