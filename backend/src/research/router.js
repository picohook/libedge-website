import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { checkProtectedRateLimit } from '../auth/rate-limit.js';
import { checkOpenAlexSoftBudget, recordOpenAlexCost } from './budget.js';
import { deduplicateResearchWorks, mergeCrossrefEnrichment } from './deduplicate.js';
import { selectCrossrefEnrichmentCandidates } from './policy.js';
import { searchOpenAlex } from './providers/openalex.js';
import { fetchCrossrefByDoi, searchCrossref } from './providers/crossref.js';

const app = new Hono();
const DEFAULT_CACHE_TTL_SECONDS = 600;
const DEFAULT_USER_LIMIT = 20;
const DEFAULT_USER_WINDOW_SECONDS = 300;

function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function cacheKeyFor(query, perPage) {
  const hash = await sha256Hex(JSON.stringify({ v: 1, query: query.toLowerCase(), perPage }));
  return `research:cache:v1:${hash}`;
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
  return 'unavailable';
}

function budgetError() {
  const error = new Error('OPENALEX_BUDGET_EXHAUSTED');
  error.code = 'OPENALEX_BUDGET_EXHAUSTED';
  return error;
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
      } else {
        status = providerStatusFromError(item.reason);
      }
    });
  }

  if (sawSuccess && status !== 'ok') status = 'unavailable';
  return { results, status };
}

async function crossrefFallback(query, env, perPage, openAlexError) {
  try {
    const crossref = await searchCrossref(query, env, { perPage });
    return {
      response: {
        results: deduplicateResearchWorks(crossref.results),
        meta: {
          partial: true,
          cached: false,
          providers: {
            openalex: { status: providerStatusFromError(openAlexError) },
            crossref: { status: 'ok' }
          }
        }
      }
    };
  } catch (crossrefError) {
    return { error: crossrefError };
  }
}

app.get('/api/research/search', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const query = normalizeQuery(c.req.query('q'));
  if (query.length < 2 || query.length > 300) {
    return c.json({ error: 'Geçerli bir araştırma sorgusu gerekli', code: 'RESEARCH_QUERY_INVALID' }, 400);
  }

  const identifier = auth.user?.user_id || auth.user?.sub || auth.user?.email || 'authenticated';
  const limit = positiveInt(c.env.RESEARCH_USER_RATE_LIMIT, DEFAULT_USER_LIMIT, 100);
  const windowSeconds = positiveInt(c.env.RESEARCH_USER_RATE_WINDOW_SECONDS, DEFAULT_USER_WINDOW_SECONDS, 3600);
  const quota = await checkProtectedRateLimit(c, 'research-search', identifier, limit, windowSeconds);
  if (quota.isLimited) {
    return c.json({ error: 'Araştırma arama limiti aşıldı', code: 'RESEARCH_RATE_LIMITED' }, 429);
  }

  const perPage = positiveInt(c.req.query('per_page'), 10, 25);
  const cacheKey = await cacheKeyFor(query, perPage);
  const cached = await readCache(c.env, cacheKey);
  if (cached) {
    return c.json({
      ...cached,
      meta: { ...cached.meta, cached: true }
    });
  }

  const budget = await checkOpenAlexSoftBudget(c.env);
  let openAlex = null;
  let openAlexError = budget.allowed ? null : budgetError();

  if (budget.allowed) {
    try {
      openAlex = await searchOpenAlex(query, c.env, { perPage });
      await recordOpenAlexCost(c.env, openAlex.telemetry?.requestCostUsd);
    } catch (error) {
      openAlexError = error;
    }
  }

  if (!openAlex) {
    const fallback = await crossrefFallback(query, c.env, perPage, openAlexError);
    if (fallback.response) {
      await writeCache(c.env, cacheKey, fallback.response);
      return c.json(fallback.response);
    }

    return c.json({
      error: 'Akademik veri sağlayıcılarına şu anda ulaşılamıyor',
      code: 'RESEARCH_PROVIDERS_UNAVAILABLE',
      meta: {
        partial: false,
        cached: false,
        providers: {
          openalex: { status: providerStatusFromError(openAlexError) },
          crossref: { status: providerStatusFromError(fallback.error) }
        }
      }
    }, 503);
  }

  const baseResults = deduplicateResearchWorks(openAlex.results);
  const crossref = await enrichWithCrossref(baseResults, c.env);
  const partial = crossref.status === 'unavailable' || crossref.status === 'rate_limited';

  const payload = {
    results: crossref.results,
    meta: {
      partial,
      cached: false,
      providers: {
        openalex: { status: 'ok', telemetry: openAlex.telemetry },
        crossref: { status: crossref.status }
      }
    }
  };

  await writeCache(c.env, cacheKey, payload);
  return c.json(payload);
});

export function handleResearchRequest(request, env, ctx) {
  return app.fetch(request, env, ctx);
}

export { app as researchApp };