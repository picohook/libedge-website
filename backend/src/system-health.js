import { verify } from 'hono/jwt';

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
  } catch (error) {
    return {
      status: 'error',
      error: String(error?.message || error || 'Kontrol başarısız').slice(0, 160),
    };
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
    : { status: 'error', error: 'DB binding missing' };

  const objectStorage = env.FILES_BUCKET
    ? await safeCheck(async () => {
        await env.FILES_BUCKET.list({ limit: 1 });
        return {};
      })
    : { status: 'error', error: 'FILES_BUCKET binding missing' };

  const rateLimitStore = env.RATE_LIMIT_KV
    ? await safeCheck(async () => {
        await env.RATE_LIMIT_KV.get('__libedge_system_health_probe__');
        return {};
      })
    : { status: 'error', error: 'RATE_LIMIT_KV binding missing' };

  const privacyQueue = env.DB
    ? await safeCheck(async () => ({
        pending_r2_purge: await scalar(
          env.DB,
          'SELECT COUNT(*) AS count FROM privacy_r2_purge_queue WHERE purged_at IS NULL',
          'count',
        ),
      }))
    : { status: 'error', error: 'DB binding missing', pending_r2_purge: null };

  const adminActivity = env.DB
    ? await safeCheck(async () => ({
        actions_24h: await scalar(
          env.DB,
          "SELECT COUNT(*) AS count FROM admin_action_logs WHERE datetime(created_at) >= datetime('now', '-24 hours')",
          'count',
        ),
      }))
    : { status: 'error', error: 'DB binding missing', actions_24h: null };

  const checks = [database, objectStorage, rateLimitStore, privacyQueue, adminActivity];
  const overall = checks.every((item) => item.status === 'ok') ? 'healthy' : 'degraded';

  return json({
    status: overall,
    checked_at: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'unknown',
    worker_name: env.WORKER_NAME || 'unknown',
    components: {
      database,
      object_storage: objectStorage,
      rate_limit_store: rateLimitStore,
    },
    privacy: privacyQueue,
    activity: adminActivity,
  });
}
