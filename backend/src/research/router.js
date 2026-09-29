import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { checkProtectedRateLimit } from '../auth/rate-limit.js';
import { discoverResearch, positiveInt } from './discover.js';
import { recordResearchMetric } from './telemetry.js';

const app = new Hono();
const DEFAULT_USER_LIMIT = 20;
const DEFAULT_USER_WINDOW_SECONDS = 300;

async function hasResearchEntitlement(db, user) {
  if (!user?.user_id) return false;
  if (user.role === 'super_admin') return true;

  const individual = await db.prepare(`
    SELECT 1 FROM subscriptions
    WHERE user_id = ? AND product_slug = 'research' AND status = 'active'
      AND (start_date IS NULL OR date(start_date) <= date('now'))
      AND (end_date IS NULL OR date(end_date) >= date('now'))
    LIMIT 1
  `).bind(user.user_id).first();
  if (individual) return true;

  const institutionId = user.institution_id;
  if (!institutionId) return false;
  const seat = await db.prepare(`
    SELECT 1
    FROM institution_subscription_seats seat
    JOIN institution_subscriptions sub ON sub.id = seat.institution_subscription_id
    WHERE seat.user_id = ? AND sub.institution_id = ? AND sub.product_slug = 'research'
      AND sub.status = 'active'
      AND (sub.start_date IS NULL OR date(sub.start_date) <= date('now'))
      AND (sub.end_date IS NULL OR date(sub.end_date) >= date('now'))
    LIMIT 1
  `).bind(user.user_id, institutionId).first();
  return Boolean(seat);
}

function researchPrivacyGatePassed(env = {}) {
  return String(env.RESEARCH_PROVIDER_PRIVACY_GATE_STATUS || '').trim().toUpperCase() === 'PASS'
    && String(env.RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS || '').trim().toUpperCase() === 'PASS';
}

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

  if (!researchPrivacyGatePassed(c.env)) {
    return c.json({ error: 'Research erişimi bu ortamda etkin değil', code: 'RESEARCH_PRIVACY_GATE_REQUIRED' }, 503);
  }
  if (!await hasResearchEntitlement(c.env.DB, auth.user)) {
    return c.json({ error: 'Research aboneliği veya kurum koltuğu gerekli', code: 'RESEARCH_ENTITLEMENT_REQUIRED' }, 403);
  }

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

export { app as researchApp, hasResearchEntitlement, researchPrivacyGatePassed };
export { Discover, isSemanticAvailabilityFailure, researchCacheKeyFor } from './discover.js';
