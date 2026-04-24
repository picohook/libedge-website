/**
 * backend/src/routes/ra/admin-overview.js
 *
 * Super-admin için salt-okunur RA raporlama endpoint'leri:
 *
 *   GET /api/ra/admin/institutions
 *     → [{ id, name, domain, user_count, tunnel_status, tunnel_last_seen,
 *          egress_endpoint, enabled, has_secret }]
 *     Bütün kurumları listeler + institution_ra_settings join'i.
 *     Admin RA panelinde "Kurum Tünelleri" sekmesinin veri kaynağı.
 *
 *   GET /api/ra/admin/logs?institution_id=&product_slug=&user_id=&limit=&offset=
 *     → { logs: [...], total, limit, offset }
 *     ra_access_logs tablosundan filtrelenmiş son erişimler.
 *     Admin RA panelinde "Erişim Logları" sekmesinin veri kaynağı.
 *
 * Hiçbiri egress secret'i (ciphertext veya plaintext) döndürmez.
 */

import { requireAuth } from '../../index.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';

const MAX_LOG_LIMIT = 500;
const DEFAULT_LOG_LIMIT = 100;

/**
 * @param {import('hono').Hono} app
 */
export function registerRaAdminOverview(app) {
  // ─── GET /api/ra/admin/institutions ───────────────────────────────────────
  app.get('/api/ra/admin/institutions', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const rows = await c.env.DB.prepare(
      `SELECT
         i.id,
         i.name,
         i.domain,
         (SELECT COUNT(*) FROM users u
           WHERE (u.institution_id = i.id OR u.institution = i.name)
             AND u.role != 'super_admin') AS user_count,
         s.egress_endpoint,
         s.enabled           AS ra_enabled,
         s.tunnel_status,
         s.tunnel_last_seen,
         CASE WHEN s.egress_secret_enc IS NOT NULL AND s.egress_secret_enc != ''
              THEN 1 ELSE 0 END AS has_secret,
         s.updated_at        AS ra_updated_at
       FROM institutions i
       LEFT JOIN institution_ra_settings s ON s.institution_id = i.id
       ORDER BY i.name COLLATE NOCASE`
    ).all();

    const institutions = (rows.results || []).map((r) => ({
      id: Number(r.id),
      name: r.name,
      domain: r.domain,
      user_count: Number(r.user_count || 0),
      egress_endpoint: r.egress_endpoint || null,
      enabled: r.ra_enabled ? 1 : 0,
      tunnel_status: r.tunnel_status || 'unconfigured',
      tunnel_last_seen: r.tunnel_last_seen ? Number(r.tunnel_last_seen) : null,
      has_secret: !!r.has_secret,
      ra_updated_at: r.ra_updated_at ? Number(r.ra_updated_at) : null,
    }));

    return c.json({ institutions });
  });

  // ─── GET /api/ra/admin/logs ───────────────────────────────────────────────
  app.get('/api/ra/admin/logs', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const institutionId = parseOptionalInt(c.req.query('institution_id'));
    const userId = parseOptionalInt(c.req.query('user_id'));
    const productSlug = parseOptionalString(c.req.query('product_slug'));
    const limit = clampInt(
      parseOptionalInt(c.req.query('limit')),
      1,
      MAX_LOG_LIMIT,
      DEFAULT_LOG_LIMIT
    );
    const offset = clampInt(parseOptionalInt(c.req.query('offset')), 0, 1e9, 0);

    const conditions = [];
    const bindings = [];
    if (institutionId != null) {
      conditions.push('l.institution_id = ?');
      bindings.push(institutionId);
    }
    if (userId != null) {
      conditions.push('l.user_id = ?');
      bindings.push(userId);
    }
    if (productSlug) {
      conditions.push('l.product_slug = ?');
      bindings.push(productSlug);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM ra_access_logs l ${whereClause}`
    )
      .bind(...bindings)
      .first();
    const total = Number((totalRow && totalRow.total) || 0);

    const rows = await c.env.DB.prepare(
      `SELECT
         l.id,
         l.user_id,
         u.email        AS user_email,
         u.full_name    AS user_name,
         l.institution_id,
         i.name         AS institution_name,
         l.product_slug,
         l.target_host,
         l.target_path,
         l.status,
         l.bytes_out,
         l.upstream_latency_ms,
         l.ts
       FROM ra_access_logs l
       LEFT JOIN users u        ON u.id = l.user_id
       LEFT JOIN institutions i ON i.id = l.institution_id
       ${whereClause}
       ORDER BY l.ts DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...bindings, limit, offset)
      .all();

    const logs = (rows.results || []).map((r) => ({
      id: Number(r.id),
      user_id: r.user_id != null ? Number(r.user_id) : null,
      user_email: r.user_email || null,
      user_name: r.user_name || null,
      institution_id: r.institution_id != null ? Number(r.institution_id) : null,
      institution_name: r.institution_name || null,
      product_slug: r.product_slug || null,
      target_host: r.target_host || null,
      target_path: r.target_path || null,
      status: r.status != null ? Number(r.status) : null,
      bytes_out: r.bytes_out != null ? Number(r.bytes_out) : null,
      upstream_latency_ms:
        r.upstream_latency_ms != null ? Number(r.upstream_latency_ms) : null,
      ts: Number(r.ts),
    }));

    return c.json({ logs, total, limit, offset });
  });
}

function parseOptionalInt(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalString(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  return trimmed;
}

function clampInt(value, min, max, fallback) {
  if (value == null) return fallback;
  const v = Math.trunc(value);
  if (!Number.isFinite(v)) return fallback;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
