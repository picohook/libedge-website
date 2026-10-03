import { checkOpenAlexSoftBudget, recordOpenAlexCost } from './budget.js';
import { deduplicateResearchWorks, mergeCrossrefEnrichment, mergeUnpaywallEnrichment } from './deduplicate.js';
import { canonicalParentDoiForSupplementaryWork, canonicalResearchWorks, isSupplementaryMaterialWork, selectCrossrefEnrichmentCandidates } from './policy.js';
import { searchOpenAlex } from './providers/openalex.js';
import { crossrefNormalizedToResearchWork, fetchCrossrefByDoi, searchCrossref } from './providers/crossref.js';
import { fetchUnpaywallByDoi } from './providers/unpaywall.js';
import { acquireSemanticPacing } from './semantic-pacer.js';
import { recordResearchMetric, recordResearchMetrics, semanticTelemetryEntries } from './telemetry.js';
import { researchRetrievalControls } from './retrieval-runtime-controls.js';
import { filterEnglishEligibleWorks, filterRelevantWorks, lexicalRelevanceScore } from './relevance.js';

const DEFAULT_CACHE_TTL_SECONDS = 600;
const CACHE_SOURCES = new Set(['semantic', 'lexical', 'crossref']);

export function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
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

export async function researchCacheKeyFor(query, perPage, retrievalSource, candidateDepth = perPage) {
  if (!CACHE_SOURCES.has(retrievalSource)) throw new Error('RESEARCH_CACHE_SOURCE_INVALID');
  const hash = await sha256Hex(JSON.stringify({ v: 5, retrievalSource, query: query.toLowerCase(), perPage, candidateDepth }));
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

export async function recoverCanonicalParentWorks(works, env, { fetchByDoi = fetchCrossrefByDoi } = {}) {
  const source = Array.isArray(works) ? works : [];
  const canonical = canonicalResearchWorks(source);
  const existingDois = new Set(canonical.map((work) => String(work?.doi || '').trim().toLowerCase()).filter(Boolean));
  const parentDois = [...new Set(source
    .filter(isSupplementaryMaterialWork)
    .map(canonicalParentDoiForSupplementaryWork)
    .filter((doi) => doi && !existingDois.has(doi)))];

  if (!parentDois.length) return canonical;

  const recovered = [];
  for (let offset = 0; offset < parentDois.length; offset += 3) {
    const batch = parentDois.slice(offset, offset + 3);
    const settled = await Promise.allSettled(batch.map((doi) => fetchByDoi(doi, env)));
    for (const item of settled) {
      if (item.status !== 'fulfilled' || !item.value) continue;
      const work = crossrefNormalizedToResearchWork(item.value);
      if (work && !isSupplementaryMaterialWork(work)) recovered.push(work);
    }
  }
  return deduplicateResearchWorks([...canonical, ...recovered]);
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

const UNPAYWALL_CACHE_TTL_SECONDS = 86400 * 7;

async function unpaywallCacheKey(doi) {
  return `research:unpaywall:v1:${await sha256Hex(String(doi).toLowerCase())}`;
}

async function fetchCachedUnpaywall(doi, env) {
  const key = await unpaywallCacheKey(doi);
  const cached = await readCache(env, key);
  if (cached) return cached.found ? cached.value : null;
  const value = await fetchUnpaywallByDoi(doi, env);
  if (env.RATE_LIMIT_KV) {
    try {
      await env.RATE_LIMIT_KV.put(key, JSON.stringify({ found: Boolean(value), value }), { expirationTtl: UNPAYWALL_CACHE_TTL_SECONDS });
    } catch (error) {
      console.warn('research Unpaywall cache write failed', error);
    }
  }
  return value;
}

export async function enrichWithUnpaywall(works, env) {
  const results = [...(Array.isArray(works) ? works : [])];
  if (!String(env.UNPAYWALL_CONTACT_EMAIL || '').trim()) return { results, status: 'skipped' };
  const candidates = results.filter((work) => work?.doi);
  if (!candidates.length) return { results, status: 'skipped' };
  const byDoi = new Map(results.map((work, index) => [work?.doi, index]).filter(([doi]) => doi));
  let status = 'ok';
  // Unpaywall only contributes OA-location metadata; it must not serialize optional
  // lookups behind multiple provider-timeout windows on the critical Discover path.
  const settled = await Promise.allSettled(candidates.map((work) => fetchCachedUnpaywall(work.doi, env)));
  settled.forEach((item, index) => {
    const candidate = candidates[index];
    if (item.status === 'fulfilled') {
      if (!item.value) return;
      const resultIndex = byDoi.get(candidate.doi);
      if (resultIndex != null) results[resultIndex] = mergeUnpaywallEnrichment(results[resultIndex], item.value);
    } else {
      status = providerStatusFromError(item.reason);
    }
  });
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
    const response = { results: await recoverCanonicalParentWorks(crossref.results, env), meta: { partial: true, cached: false, retrievalSource: 'crossref', providers: { openalex: openAlexMeta, crossref: { status: 'ok' } } } };
    await writeCache(env, crossrefCacheKey, response);
    return { response };
  } catch (crossrefError) {
    return { error: crossrefError };
  }
}

function selectAssistantCandidates(query, candidatePool, perPage) {
  const relevant = filterRelevantWorks(query, candidatePool);
  const languageEligible = filterEnglishEligibleWorks(candidatePool);
  const authorizedRelevant = filterRelevantWorks(query, languageEligible);
  const originalIndex = new Map(candidatePool.map((work, index) => [work, index]));
  const selected = [...authorizedRelevant]
    .sort((a, b) => {
      const scoreDelta = lexicalRelevanceScore(query, b) - lexicalRelevanceScore(query, a);
      if (scoreDelta !== 0) return scoreDelta;
      const abstractDelta = Number(Boolean(b?.abstract)) - Number(Boolean(a?.abstract));
      if (abstractDelta !== 0) return abstractDelta;
      return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    })
    .slice(0, perPage);
  return {
    selected,
    diagnostics: {
      retrievedCount: candidatePool.length,
      relevantCount: relevant.length,
      languageEligibleCount: languageEligible.length,
      authorizedRelevantCount: authorizedRelevant.length
    }
  };
}

async function buildOpenAlexPayload(openAlex, env, mode, semanticError = null, perPage = 10, { query = '', assistantSelection = false, candidateDepth = perPage } = {}) {
  const candidatePool = await recoverCanonicalParentWorks(openAlex.results, env);
  const selection = assistantSelection
    ? selectAssistantCandidates(query, candidatePool, perPage)
    : { selected: candidatePool.slice(0, perPage), diagnostics: null };
  const baseResults = selection.selected;
  const crossref = await enrichWithCrossref(baseResults, env);
  const unpaywall = await enrichWithUnpaywall(crossref.results, env);
  const partial = crossref.status === 'unavailable' || crossref.status === 'rate_limited';
  return {
    results: unpaywall.results,
    candidatePool,
    meta: {
      partial,
      cached: false,
      retrievalSource: semanticError ? 'lexical_fallback' : mode,
      candidateDepth,
      candidatePoolSize: candidatePool.length,
      ...(selection.diagnostics ? { selectionDiagnostics: selection.diagnostics } : {}),
      providers: { openalex: openAlexSuccessMeta(mode, openAlex.telemetry, semanticError), crossref: { status: crossref.status }, unpaywall: { status: unpaywall.status } }
    }
  };
}

function response(body, status = 200) {
  return { body, status };
}

export async function discoverResearch(query, env, { perPage = 10, useRuntimeControls = false } = {}) {
  const runtime = useRuntimeControls ? await researchRetrievalControls(env) : null;
  const effectivePerPage = runtime?.source === 'runtime' ? runtime.final_result_target : perPage;
  const semanticPrimary = runtime ? runtime.mode === 'semantic' : enabled(env.RESEARCH_SEMANTIC_PRIMARY_ENABLED);
  const semanticDepth = positiveInt(env.RESEARCH_SEMANTIC_CANDIDATE_DEPTH, 50, 50);
  const lexicalDepth = runtime?.lexical_candidate_depth || positiveInt(env.RESEARCH_LEXICAL_CANDIDATE_DEPTH, effectivePerPage, 50);
  perPage = effectivePerPage;
  const semanticCacheKey = await researchCacheKeyFor(query, perPage, 'semantic', semanticDepth);
  const lexicalCacheKey = await researchCacheKeyFor(query, perPage, 'lexical', lexicalDepth);
  const crossrefCacheKey = await researchCacheKeyFor(query, perPage, 'crossref');

  if (!semanticPrimary) {
    const cached = await readCache(env, lexicalCacheKey);
    if (cached) return response({ ...cached, meta: { ...cached.meta, cached: true } });
  } else {
    const cached = await readCache(env, semanticCacheKey);
    if (cached) return response({ ...cached, meta: { ...cached.meta, cached: true } });
  }

  const budget = await checkOpenAlexSoftBudget(env);
  if (!budget.allowed) {
    const openAlexError = budgetError();
    const fallback = await crossrefFallback(query, env, perPage, openAlexProviderMeta(openAlexError), crossrefCacheKey);
    if (fallback.response) return response(fallback.response);
    return response({ error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor', code: 'RESEARCH_PROVIDERS_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexProviderMeta(openAlexError), crossref: { status: providerStatusFromError(fallback.error) } } } }, 503);
  }

  if (!semanticPrimary) {
    try {
      const openAlex = await searchOpenAlex(query, env, { perPage: lexicalDepth, mode: 'lexical' });
      await recordOpenAlexCost(env, openAlex.telemetry?.requestCostUsd);
      const payload = await buildOpenAlexPayload(openAlex, env, 'lexical', null, perPage, { query, assistantSelection: useRuntimeControls, candidateDepth: lexicalDepth });
      await writeCache(env, lexicalCacheKey, payload);
      return response(payload);
    } catch (openAlexError) {
      const fallback = await crossrefFallback(query, env, perPage, openAlexProviderMeta(openAlexError), crossrefCacheKey);
      if (fallback.response) return response(fallback.response);
      return response({ error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor', code: 'RESEARCH_PROVIDERS_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexProviderMeta(openAlexError), crossref: { status: providerStatusFromError(fallback.error) } } } }, 503);
    }
  }

  let semanticError = null;
  let semanticPacingWaitMs = 0;
  let semanticProviderStartedAt = null;
  try {
    const pacing = await acquireSemanticPacing(env);
    semanticPacingWaitMs = Number(pacing.waitMs) || 0;
    semanticProviderStartedAt = Date.now();
    const semantic = await searchOpenAlex(query, env, { perPage: semanticDepth, mode: 'semantic' });
    const latencyMs = Date.now() - semanticProviderStartedAt;
    const telemetryEntries = [
      ['semantic_attempts', 1],
      ['semantic_pacing_wait_ms_total', semanticPacingWaitMs],
      ['semantic_provider_latency_ms_total', latencyMs],
      ['semantic_successes', 1],
      ...(semantic.results.length === 0 ? [['semantic_valid_empty', 1]] : []),
      ...semanticTelemetryEntries(semantic.telemetry)
    ];
    await recordResearchMetrics(env, telemetryEntries);
    await recordOpenAlexCost(env, semantic.telemetry?.requestCostUsd);
    const payload = await buildOpenAlexPayload(semantic, env, 'semantic', null, perPage, { query, assistantSelection: useRuntimeControls, candidateDepth: semanticDepth });
    await writeCache(env, semanticCacheKey, payload);
    return response(payload);
  } catch (error) {
    semanticError = error;
    const entries = [['semantic_attempts', 1], ['semantic_pacing_wait_ms_total', semanticPacingWaitMs]];
    if (semanticProviderStartedAt != null) entries.push(['semantic_provider_latency_ms_total', Date.now() - semanticProviderStartedAt]);
    const failureMetric = semanticFailureMetric(error);
    if (failureMetric) entries.push([failureMetric, 1]);
    await recordResearchMetrics(env, entries);
    if (!isSemanticAvailabilityFailure(error)) {
      return response({ error: 'Anlamsal akademik arama şu anda işlenemiyor', code: 'RESEARCH_SEMANTIC_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexProviderMeta(error) } } }, 503);
    }
  }

  const cachedLexical = await readCache(env, lexicalCacheKey);
  if (cachedLexical) {
    const cachedTelemetry = cachedLexical.meta?.providers?.openalex?.telemetry || null;
    await recordResearchMetrics(env, [['lexical_fallback_attempts', 1], ['lexical_fallback_successes', 1]]);
    return response({ ...cachedLexical, meta: { ...cachedLexical.meta, cached: true, retrievalSource: 'lexical_fallback', providers: { ...cachedLexical.meta?.providers, openalex: openAlexSuccessMeta('lexical', cachedTelemetry, semanticError, true) } } });
  }

  let lexicalError = null;
  try {
    const lexical = await searchOpenAlex(query, env, { perPage: lexicalDepth, mode: 'lexical' });
    await recordOpenAlexCost(env, lexical.telemetry?.requestCostUsd);
    await recordResearchMetrics(env, [['lexical_fallback_attempts', 1], ['lexical_fallback_successes', 1]]);
    const payload = await buildOpenAlexPayload(lexical, env, 'lexical', semanticError, perPage, { query, assistantSelection: useRuntimeControls, candidateDepth: lexicalDepth });
    await writeCache(env, lexicalCacheKey, payload);
    return response(payload);
  } catch (error) {
    lexicalError = error;
    await recordResearchMetric(env, 'lexical_fallback_attempts');
  }

  const openAlexMeta = openAlexDualFailureMeta(semanticError, lexicalError);
  const fallback = await crossrefFallback(query, env, perPage, openAlexMeta, crossrefCacheKey);
  if (fallback.response) return response(fallback.response);
  return response({ error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor', code: 'RESEARCH_PROVIDERS_UNAVAILABLE', meta: { partial: false, cached: false, providers: { openalex: openAlexMeta, crossref: { status: providerStatusFromError(fallback.error) } } } }, 503);
}

export async function Discover(query, { env, perPage = 10 } = {}) {
  const result = await discoverResearch(query, env, { perPage, useRuntimeControls: true });
  if (result.status !== 200) {
    const error = new Error(result.body?.code || 'RESEARCH_DISCOVERY_FAILED');
    error.code = result.body?.code || 'RESEARCH_DISCOVERY_FAILED';
    error.status = result.status;
    error.payload = result.body;
    throw error;
  }
  const works = result.body.results;
  const selectionDiagnostics = result.body?.meta?.selectionDiagnostics || null;
  const cost = Number(result.body?.meta?.providers?.openalex?.telemetry?.requestCostUsd);
  Object.defineProperties(works, {
    'diagnostic_discovery_cost_usd': {
      value: Number.isFinite(cost) && cost >= 0 && !result.body?.meta?.cached ? cost : 0,
      enumerable: false
    },
    'diagnostic_retrieval_mode': {
      value: String(result.body?.meta?.retrievalSource || 'unknown'),
      enumerable: false
    },
    'diagnostic_candidate_depth': {
      value: Number(result.body?.meta?.candidateDepth) || works.length,
      enumerable: false
    },
    'diagnostic_retrieved_count': {
      value: Number(selectionDiagnostics?.retrievedCount) || Number(result.body?.meta?.candidatePoolSize) || works.length,
      enumerable: false
    },
    'diagnostic_relevant_count': {
      value: Number(selectionDiagnostics?.relevantCount) || 0,
      enumerable: false
    },
    'diagnostic_language_eligible_count': {
      value: Number(selectionDiagnostics?.languageEligibleCount) || 0,
      enumerable: false
    },
    'diagnostic_authorized_relevant_count': {
      value: Number(selectionDiagnostics?.authorizedRelevantCount) || works.length,
      enumerable: false
    }
  });
  return works;
}
