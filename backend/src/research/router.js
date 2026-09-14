import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { checkProtectedRateLimit } from '../auth/rate-limit.js';
import { discoverResearch, positiveInt } from './discover.js';
import { recordResearchMetric } from './telemetry.js';

const app = new Hono();
const DEFAULT_USER_LIMIT = 20;
const DEFAULT_USER_WINDOW_SECONDS = 300;

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function buildResearchObservationLog(status, startedMs, completedMs = Date.now()) {
  const numericStatus = Number(status);
  const statusClass = Number.isFinite(numericStatus) && numericStatus >= 100 && numericStatus <= 599
    ? `${Math.floor(numericStatus / 100)}xx`
    : 'other';

  return {
    event: 'research_request_observed',
    timestamp_bucket: Math.floor(Number(completedMs) / 60_000),
    path_class: 'research_search',
    status_class: statusClass,
    duration_ms: Math.max(0, Number(completedMs) - Number(startedMs)),
  };
}

app.use('/api/research/search', async (c, next) => {
  const startedMs = Date.now();

  try {
    await next();
  } finally {
    if (c.env.ENVIRONMENT === 'production') {
      console.log(buildResearchObservationLog(c.res.status, startedMs));
    }
  }
});

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

  await recordResearchMetric(c.env, 'research_requests');
  const perPage = positiveInt(c.req.query('per_page'), 10, 25);
  const result = await discoverResearch(query, c.env, { perPage });
  return c.json(result.body, result.status);
});

export function handleResearchRequest(request, env, ctx) {
  return app.fetch(request, env, ctx);
}

export { app as researchApp };
export { Discover, isSemanticAvailabilityFailure, researchCacheKeyFor } from './discover.js';
