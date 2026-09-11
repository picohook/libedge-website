import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { checkProtectedRateLimit } from '../auth/rate-limit.js';
import { checkOpenAlexSoftBudget, recordOpenAlexCost } from './budget.js';
import { deduplicateResearchWorks, mergeCrossrefEnrichment } from './deduplicate.js';
import { selectCrossrefEnrichmentCandidates } from './policy.js';
import { searchOpenAlex } from './providers/openalex.js';
import { fetchCrossrefByDoi, searchCrossref } from './providers/crossref.js';
import { acquireSemanticPacing } from './semantic-pacer.js';
import { recordResearchMetric, recordResearchMetrics, semanticTelemetryEntries } from './telemetry.js';

const app = new Hono();
const DEFAULT_CACHE_TTL_SECONDS = 600;
const DEFAULT_USER_LIMIT = 20;
const DEFAULT_USER_WINDOW_SECONDS = 300;
const CACHE_SOURCES = new Set(['semantic', 'lexical', 'crossref']);

function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function cacheKeyFor(query, perPage, retrievalSource) {
  if (!CACHE_SOURCES.has(retrievalSource)) throw new Error('RESEARCH_CACHE_SOURCE_INVALID');
  const hash = await sha256Hex(JSON.stringify({ v: 2, retrievalSource, query: query.toLowerCase(), perPage }));
  return `research:cache:v2:${hash}`;
}

async function readCache(env, key) {
  if (!env.RATE_LIMIT_KV) return null;
  try {
    const value = await env.RATE_LIMIT_KV.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn('research cache read failed', error);
    return null;
  }
}

async function writeCache(env, key, value) {
  if (!env.RATE_LIMIT_KV) return;
  const ttl = positiveInt(env.RESEARCH_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS, 3600);
  try {
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (error) {
    console.warn('research cache write failed', error);
  }
}

function providerStatusFromError(error) {
  if (error?.code?.includes('BUDGET')) return 'budget_exhausted';
  if (error?.code?.includes('RATE_LIMITED')) return 'rate_limited';
  if (error?.code?.includes('MALFORMED')) return 'malformed';
  if (error?.code?.includes('PACING')) return 'pacing_unavailable';
  return 'unavailable';
}

function openAlexProviderMeta(error) {
  return { status: providerStatusFromError(error), ...(error?.telemetry ? { telemetry: error.telemetry } : {}) };
}

function openAlexSuccessMeta(mode, telemetry, semanticError = null, cached = false) {
  if (mode === 'semantic') return { status: 'ok', mode: 'semantic', telemetry, ...(cached ? { cached: true } : {}) };
  if (semanticError) {
    return {
      status: 'ok', mode: 'lexical', fallback: true, telemetry,
      stages: {
        semantic: openAlexProviderMeta(semanticError),
        lexical: { status: 'ok', ...(telemetry ? { telemetry } : {}), ...(cached ? { cached: true } : {}) }
      }
    };
  }
  return { status: 'ok', mode: 'lexical', telemetry, ...(cached ? { cached: true } : {}) };
}

function openAlexDualFailureMeta(semanticError, lexicalError) {
  return { status: 'unavailable', stages: { semantic: openAlexProviderMeta(semanticError), lexical: openAlexProviderMeta(lexicalError) } };
}

function budgetError() {
  const error = new Error('OPENALEX_BUDGET_EXHAUSTED');
  error.code = 'OPENALEX_BUDGET_EXHAUSTED';
  return error;
}

export function isSemanticAvailabilityFailure(error) {
  if (!error) return false;
  if (error.code === 'OPENALEX_SEMANTIC_PACING_UNAVAILABLE') return true;
  if (error.code === 'OPENALEX_MALFORMED') return true;
  if (error.code === 'OPENALEX_RATE_LIMITED') return true;
  if (error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true;
  if (error.code === 'OPENALEX_UNAVAILABLE') {
    const status = Number(error.status);
    return status >= 500 || status === 404 || status === 410 || status === 501;
  }
  return false;
}

function semanticFailureMetric(error) {
  if (error?.code === 'OPENALEX_MALFORMED') return 'semantic_malformed';
  if (error?.code === 'OPENALEX_RATE_LIMITED') return 'semantic_429';
  if (error?.code === 'OPENALEX_SEMANTIC_PACING_UNAVAILABLE') return 'semantic_pacing_unavailable';
  if (error?.name === 'AbortError' || error instanceof TypeError) return 'semantic_timeout_network';
  if (Number(error?.status) >= 500) return 'semantic_5xx';
  return null;
}

async function enrichWithCrossref(works, env) {
  const max = positiveInt(env.RESEARCH_CROSSREF_MAX_ENRICHMENTS, 10, 20);
  const candidates = selectCrossrefEnrichmentCandidates(works, { max });
  if (!candidates.length) return { results: works, status: 'skipped' };
  const byDoi = new Map(works.filter((work) => work.doi).map((work, index) => [work.doi, index]));
  const results = [...works];
  let status = 'ok';
  let sawSuccess = false;
  for (let offset = 0; offset < candidates.length; offset += 3) {
    const batch = candidates.slice(offset, offset + 3);
    const settled = await Promise.allSettled(batch.map((work) => fetchCrossrefByDoi(work.doi, env)));
    settled.forEach((item, index) => {
      const candidate = batch[index];
      if (item.status === 'fulfilled') {
        sawSuccess = true;
        if (!item.value) return;
        const resultIndex = byDoi.get(candidate.doi);
        if (resultIndex != null) results[resultIndex] = mergeCrossrefEnrichment(results[resultIndex], item.value);
      } else status = providerStatusFromError(item.reason);
    });
  }
  if (sawSuccess && status !== 'ok') status = 'unavailable';
  return { results, status };
}

async function crossrefFallback(query, env, perPage, openAlexMeta, crossrefCacheKey) {
  const cached = await readCache(env, crossrefCacheKey);
  if (cached) {
    return { response: { ...cached, meta: { ...cached.meta, partial: true, cached: true, providers: { ...cached.meta?.providers, openalex: openAlexMeta, crossref: { status: 'ok', cached: true } } } } };
  }
  try {
    const crossref = await searchCrossref(query, env, { perPage });
    await recordResearchMetric(env, 'crossref_search_fallbacks');
    const response = { results: deduplicateResearchWorks(crossref.results), meta: { partial: true, cached: false, retrievalSource: 'crossref', providers: { openalex: openAlexMeta, crossref: { status: 'ok' } } } };
    await writeCache(env, crossrefCacheKey, response);
    return { response };
  } catch (crossrefError) {
    return { error: crossrefError };
  }
}

async function buildOpenAlexPayload(openAlex, env, mode, semanticError = null, perPage = 10) {
  const baseResults = deduplicateResearchWorks(openAlex.results).slice(0, perPage);
  const crossref = await enrichWithCrossref(baseResults, env);
  const partial = crossref.status === 'unavailable' || crossref.status === 'rate_limited';
  return { results: crossref.results, meta: { partial, cached: false, retrievalSource: mode, providers: { openalex: openAlexSuccessMeta(mode, openAlex.telemetry, semanticError), crossref: { status: crossref.status } } } };
}

app.get('/api/research/search', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const query = normalizeQuery(c.req.query('q'));
  if (query.length < 2 || query.length > 300) return c.json({ error: 'Geçerli bir araştırma sorgusu gerekli', code: 'RESEARCH_QUERY_INVALID' }, 400);

  const identifier = auth.user?.user_id || auth.user?.sub || auth.user?.email || 'authenticated';
  const limit = positiveInt(c.env.RESEARCH_USER_RATE_LIMIT, DEFAULT_USER_LIMIT, 100);
  const windowSeconds = positiveInt(c.env.RESEARCH_USER_RATE_WINDOW_SECONDS, DEFAULT_USER_WINDOW_SECONDS, 3600);
  const quota = await checkProtectedRateLimit(c, 'research-search', identifier, limit, windowSeconds);
  if (quota.isLimited) return c.json({ error: 'Araştırma arama limiti aşıldı', code: 'RESEARCH_RATE_LIMITED' }, 429);

  await recordResearchMetric(c.env, 'research_requests');
  const perPage = positiveInt(c.req.query('per_page'), 10, 25);
  const semanticPrimary = enabled(c.env.RESEARCH_SEMANTIC_PRIMARY_ENABLED);
  const semanticCacheKey = await cacheKeyFor(query, perPage, 'semantic');
  const lexicalCacheKey = await cacheKeyFor(query, perPage, 'lexical');
  const crossrefCacheKey = await cacheKeyFor(query, perPage, 'crossref');

  if (!semanticPrimary) {
    const cached = await readCache(c.env, lexicalCacheKey);
    if (cached) return c.json({ ...cached, meta: { ...cached.meta, cached: true } });
  } else {
    const cached = await readCache(c.env, semanticCacheKey);
    if (cached) return c.json({ ...cached, meta: { ...cached.meta, cached: true } });
  }

  const budget = await checkOpenAlexSoftBudget(c.env);
  if (!budget.allowed) {
    const openAlexError = budgetError();
    const fallback = await crossrefFallback(query, c.env, perPage, openAlexProviderMeta(openAlexError), crossrefCacheKey);
    if (fallback.response) return c.json(fallback.response);
    return c.json({ error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor', code: 'RESEARCH_PROVIDERS_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexProviderMeta(openAlexError), crossref: { status: providerStatusFromError(fallback.error) } } } }, 503);
  }

  if (!semanticPrimary) {
    try {
      const openAlex = await searchOpenAlex(query, c.env, { perPage, mode: 'lexical' });
      await recordOpenAlexCost(c.env, openAlex.telemetry?.requestCostUsd);
      const payload = await buildOpenAlexPayload(openAlex, c.env, 'lexical', null, perPage);
      await writeCache(c.env, lexicalCacheKey, payload);
      return c.json(payload);
    } catch (openAlexError) {
      const fallback = await crossrefFallback(query, c.env, perPage, openAlexProviderMeta(openAlexError), crossrefCacheKey);
      if (fallback.response) return c.json(fallback.response);
      return c.json({ error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor', code: 'RESEARCH_PROVIDERS_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexProviderMeta(openAlexError), crossref: { status: providerStatusFromError(fallback.error) } } } }, 503);
    }
  }

  let semanticError = null;
  let semanticPacingWaitMs = 0;
  let semanticProviderStartedAt = null;
  try {
    const pacing = await acquireSemanticPacing(c.env);
    semanticPacingWaitMs = Number(pacing.waitMs) || 0;
    const semanticDepth = positiveInt(c.env.RESEARCH_SEMANTIC_CANDIDATE_DEPTH, 50, 50);
    semanticProviderStartedAt = Date.now();
    const semantic = await searchOpenAlex(query, c.env, { perPage: semanticDepth, mode: 'semantic' });
    const latencyMs = Date.now() - semanticProviderStartedAt;
    const telemetryEntries = [
      ['semantic_attempts', 1],
      ['semantic_pacing_wait_ms_total', semanticPacingWaitMs],
      ['semantic_provider_latency_ms_total', latencyMs],
      ['semantic_successes', 1],
      ...(semantic.results.length === 0 ? [['semantic_valid_empty', 1]] : []),
      ...semanticTelemetryEntries(semantic.telemetry)
    ];
    await recordResearchMetrics(c.env, telemetryEntries);
    await recordOpenAlexCost(c.env, semantic.telemetry?.requestCostUsd);
    const payload = await buildOpenAlexPayload(semantic, c.env, 'semantic', null, perPage);
    await writeCache(c.env, semanticCacheKey, payload);
    return c.json(payload);
  } catch (error) {
    semanticError = error;
    const entries = [['semantic_attempts', 1], ['semantic_pacing_wait_ms_total', semanticPacingWaitMs]];
    if (semanticProviderStartedAt != null) entries.push(['semantic_provider_latency_ms_total', Date.now() - semanticProviderStartedAt]);
    const failureMetric = semanticFailureMetric(error);
    if (failureMetric) entries.push([failureMetric, 1]);
    await recordResearchMetrics(c.env, entries);
    if (!isSemanticAvailabilityFailure(error)) {
      return c.json({ error: 'Anlamsal akademik arama şu anda işlenemiyor', code: 'RESEARCH_SEMANTIC_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexProviderMeta(error) } } }, 503);
    }
  }

  const cachedLexical = await readCache(c.env, lexicalCacheKey);
  if (cachedLexical) {
    const cachedTelemetry = cachedLexical.meta?.providers?.openalex?.telemetry || null;
    await recordResearchMetrics(c.env, [['lexical_fallback_attempts', 1], ['lexical_fallback_successes', 1]]);
    return c.json({ ...cachedLexical, meta: { ...cachedLexical.meta, cached: true, retrievalSource: 'lexical', providers: { ...cachedLexical.meta?.providers, openalex: openAlexSuccessMeta('lexical', cachedTelemetry, semanticError, true) } } });
  }

  let lexicalError = null;
  try {
    const lexical = await searchOpenAlex(query, c.env, { perPage, mode: 'lexical' });
    await recordOpenAlexCost(c.env, lexical.telemetry?.requestCostUsd);
    await recordResearchMetrics(c.env, [['lexical_fallback_attempts', 1], ['lexical_fallback_successes', 1]]);
    const payload = await buildOpenAlexPayload(lexical, c.env, 'lexical', semanticError, perPage);
    await writeCache(c.env, lexicalCacheKey, payload);
    return c.json(payload);
  } catch (error) {
    lexicalError = error;
    await recordResearchMetric(c.env, 'lexical_fallback_attempts');
  }

  const openAlexMeta = openAlexDualFailureMeta(semanticError, lexicalError);
  const fallback = await crossrefFallback(query, c.env, perPage, openAlexMeta, crossrefCacheKey);
  if (fallback.response) return c.json(fallback.response);
  return c.json({ error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor', code: 'RESEARCH_PROVIDERS_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexMeta, crossref: { status: providerStatusFromError(fallback.error) } } } }, 503);
});

export function handleResearchRequest(request, env, ctx) {
  return app.fetch(request, env, ctx);
}

export { app as researchApp, cacheKeyFor as researchCacheKeyFor };
