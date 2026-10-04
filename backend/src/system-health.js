// Read-only super-admin infrastructure health summary. Never return secret, token, PII, or raw provider errors.
import { verify } from 'hono/jwt';
import { readResearchTelemetrySnapshot } from './research/telemetry.js';
import { SUPPORT_CHECK_PAUSE_KEY } from './assistant/support-check-runtime-pause.js';
import { supportCheckInvocationKey, supportCheckInvocationLimit } from './assistant/support-check-invocation-budget.js';

const SUPPORT_CHECK_INFRASTRUCTURE_STATE_KEY = 'assistant:supportcheck:infrastructure-state';
const SUPPORT_CHECK_INFRASTRUCTURE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

async function requireSuperAdmin(request, env) {
  const token = getCookie(request, 'authToken');
  if (!token || !env.JWT_SECRET) return { response: json({ error: 'Oturum bulunamadı' }, 401) };
  try {
    const user = await verify(token, env.JWT_SECRET, 'HS256');
    if (user?.role !== 'super_admin') {
      return { response: json({ error: 'Bu işlem yalnız super admin içindir' }, 403) };
    }
    return { user };
  } catch {
    return { response: json({ error: 'Geçersiz veya süresi dolmuş oturum' }, 401) };
  }
}

async function safeCheck(fn) {
  try {
    return { status: 'ok', ...(await fn()) };
  } catch {
    return { status: 'error' };
  }
}

async function scalar(db, sql, field) {
  const row = await db.prepare(sql).first();
  return Number(row?.[field] || 0);
}

export async function handleSystemHealthRequest(request, env) {
  const auth = await requireSuperAdmin(request, env);
  if (auth.response) return auth.response;

  const database = env.DB
    ? await safeCheck(async () => {
        await env.DB.prepare('SELECT 1 AS ok').first();
        return {};
      })
    : { status: 'error' };

  const databaseSchema = env.DB
    ? await safeCheck(async () => {
        const columns = await env.DB.prepare("PRAGMA table_info(institution_subscriptions)").all();
        const columnNames = new Set((columns?.results || []).map((row) => String(row.name || '')));
        const seatsTable = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='institution_subscription_seats'"
        ).first();
        const telemetryTable = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='research_telemetry_counters'"
        ).first();
        const missing = [];
        if (!columnNames.has('seat_limit')) missing.push('institution_subscriptions.seat_limit');
        if (Number(seatsTable?.count || 0) < 1) missing.push('institution_subscription_seats');
        if (Number(telemetryTable?.count || 0) < 1) missing.push('research_telemetry_counters');
        const schemaCurrent = missing.length === 0;
        return { status: schemaCurrent ? 'ok' : 'error', schema_current: schemaCurrent, missing };
      })
    : { status: 'error', schema_current: false, missing: ['database_binding'] };

  const objectStorage = env.FILES_BUCKET
    ? await safeCheck(async () => {
        await env.FILES_BUCKET.list({ limit: 1 });
        return {};
      })
    : { status: 'error' };

  const rateLimitStore = env.RATE_LIMIT_KV
    ? await safeCheck(async () => {
        await env.RATE_LIMIT_KV.get('__libedge_system_health_probe__');
        return {};
      })
    : { status: 'error' };

  const researchTelemetry = env.RATE_LIMIT_KV
    ? await safeCheck(async () => ({
        snapshot: await readResearchTelemetrySnapshot(env),
      }))
    : { status: 'error', snapshot: null };

  const supportCheck = env.RATE_LIMIT_KV
    ? await safeCheck(async () => {
        const [pauseRaw, invocationRaw, infrastructureRaw] = await Promise.all([
          env.RATE_LIMIT_KV.get(SUPPORT_CHECK_PAUSE_KEY),
          env.RATE_LIMIT_KV.get(supportCheckInvocationKey()),
          env.RATE_LIMIT_KV.get(SUPPORT_CHECK_INFRASTRUCTURE_STATE_KEY),
        ]);
        const pauseValue = String(pauseRaw || '').trim().toLowerCase();
        const paused = !['false', '0', 'resume'].includes(pauseValue);
        const used = Number(invocationRaw || 0);
        const limitState = await supportCheckInvocationLimit(env);
        let infrastructure = { state: 'unknown', published_at: null, stale: true, instance_type: null, instance_count: null };
        if (infrastructureRaw) {
          try {
            const parsed = JSON.parse(infrastructureRaw);
            const publishedAtMs = Date.parse(parsed?.published_at || '');
            const ageMs = Date.now() - publishedAtMs;
            const fresh = Number.isFinite(publishedAtMs) && ageMs >= -5 * 60 * 1000 && ageMs <= SUPPORT_CHECK_INFRASTRUCTURE_MAX_AGE_MS;
            const observedState = ['available', 'unavailable'].includes(parsed?.state) ? parsed.state : 'unknown';
            infrastructure = {
              state: fresh ? observedState : 'unknown',
              published_at: Number.isFinite(publishedAtMs) ? new Date(publishedAtMs).toISOString() : null,
              stale: !fresh,
              instance_type: fresh && typeof parsed?.instance_type === 'string' ? parsed.instance_type : null,
              instance_count: fresh && [1, 2].includes(Number(parsed?.instance_count)) ? Number(parsed.instance_count) : null,
            };
          } catch {
            // Malformed operational state fails closed to Unknown without exposing raw KV content.
          }
        }
        return {
          enabled: env.RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED === 'true',
          privacy_gate: env.RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS === 'PASS' ? 'PASS' : 'UNVERIFIED',
          paused,
          pause_reason: paused ? (pauseValue ? 'OPERATIONALLY_PAUSED' : 'PAUSE_STATE_UNSET') : null,
          daily_invocations_used: Number.isFinite(used) && used >= 0 ? used : null,
          daily_invocation_limit: limitState.limit,
          daily_invocation_limit_source: limitState.source,
          daily_invocation_limit_reason: limitState.reason || null,
          infrastructure,
        };
      })
    : { status: 'error' };

  const privacyQueue = env.DB
    ? await safeCheck(async () => ({
        pending_r2_purge: await scalar(
          env.DB,
          'SELECT COUNT(*) AS count FROM privacy_r2_purge_queue WHERE purged_at IS NULL',
          'count',
        ),
      }))
    : { status: 'error', pending_r2_purge: null };

  const adminActivity = env.DB
    ? await safeCheck(async () => ({
        actions_24h: await scalar(
          env.DB,
          "SELECT COUNT(*) AS count FROM admin_action_logs WHERE datetime(created_at) >= datetime('now', '-24 hours')",
          'count',
        ),
      }))
    : { status: 'error', actions_24h: null };

  const checks = [database, databaseSchema, objectStorage, rateLimitStore, researchTelemetry, supportCheck, privacyQueue, adminActivity];
  const overall = checks.every((item) => item.status === 'ok') ? 'healthy' : 'degraded';

  return json({
    status: overall,
    checked_at: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'unknown',
    worker_name: env.WORKER_NAME || 'unknown',
    components: {
      database,
      database_schema: databaseSchema,
      object_storage: objectStorage,
      rate_limit_store: rateLimitStore,
    },
    privacy: privacyQueue,
    activity: adminActivity,
    research_telemetry: researchTelemetry,
    support_check: supportCheck,
  });
}
