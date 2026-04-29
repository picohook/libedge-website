/**
 * backend/src/routes/ra/admin-alerts.js
 *
 * Super-admin için upstream hata bildirimleri endpoint'leri:
 *
 *   GET  /api/ra/admin/alerts
 *     → { alerts: [...], unread_count }
 *     Son 7 günün aktif (dismissed=0) alertlarını döner.
 *
 *   POST /api/ra/admin/alerts/:id/dismiss
 *     Tek bir alert'i kapat.
 *
 *   POST /api/ra/admin/alerts/dismiss-all
 *     Tüm aktif alertları kapat.
 */

import { requireAuth } from '../../index.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';

const ALERT_WINDOW_SEC = 7 * 24 * 60 * 60; // 7 gün

/**
 * @param {import('hono').Hono} app
 */
export function registerRaAdminAlerts(app) {
  // ─── GET /api/ra/admin/alerts ──────────────────────────────────────────────
  app.get('/api/ra/admin/alerts', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const since = Math.floor(Date.now() / 1000) - ALERT_WINDOW_SEC;

    const rows = await c.env.DB.prepare(
      `SELECT
         a.id,
         a.product_slug,
         a.institution_id,
         i.name AS institution_name,
         a.target_host,
         a.upstream_status,
         a.dismissed,
         a.notified_at,
         a.created_at
       FROM ra_alerts a
       LEFT JOIN institutions i ON i.id = a.institution_id
       WHERE a.dismissed = 0 AND a.created_at >= ?
       ORDER BY a.created_at DESC
       LIMIT 200`
    )
      .bind(since)
      .all();

    const alerts = (rows.results || []).map((r) => ({
      id: Number(r.id),
      product_slug: r.product_slug || null,
      institution_id: r.institution_id != null ? Number(r.institution_id) : null,
      institution_name: r.institution_name || null,
      target_host: r.target_host || null,
      upstream_status: Number(r.upstream_status),
      dismissed: !!r.dismissed,
      notified_at: r.notified_at ? Number(r.notified_at) : null,
      created_at: Number(r.created_at),
    }));

    return c.json({ alerts, unread_count: alerts.length });
  });

  // ─── POST /api/ra/admin/alerts/:id/dismiss ─────────────────────────────────
  app.post('/api/ra/admin/alerts/:id/dismiss', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: 'Geçersiz ID' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE ra_alerts SET dismissed = 1 WHERE id = ?`
    )
      .bind(id)
      .run();

    return c.json({ ok: true });
  });

  // ─── POST /api/ra/admin/alerts/dismiss-all ─────────────────────────────────
  app.post('/api/ra/admin/alerts/dismiss-all', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    await c.env.DB.prepare(
      `UPDATE ra_alerts SET dismissed = 1 WHERE dismissed = 0`
    ).run();

    return c.json({ ok: true });
  });
}
