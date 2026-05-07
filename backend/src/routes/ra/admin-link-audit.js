/**
 * backend/src/routes/ra/admin-link-audit.js
 *
 * Super-admin read API for rendered-page RA link audit findings.
 */

import { requireAuth } from '../../index.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';

const MAX_LIMIT = 300;
const DEFAULT_LIMIT = 120;

/**
 * @param {import('hono').Hono} app
 */
export function registerRaAdminLinkAudit(app) {
  app.get('/api/ra/admin/link-audit', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const productSlug = parseOptionalString(c.req.query('product_slug'), 128);
    const classification = parseOptionalString(c.req.query('classification'), 40);
    const limit = clampInt(parseOptionalInt(c.req.query('limit')), 1, MAX_LIMIT, DEFAULT_LIMIT);

    const conditions = [];
    const bindings = [];
    if (productSlug) {
      conditions.push('f.product_slug = ?');
      bindings.push(productSlug);
    }
    if (classification) {
      conditions.push('f.classification = ?');
      bindings.push(classification);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await c.env.DB.prepare(
      `SELECT
         f.key_hash,
         f.product_slug,
         p.name AS product_name,
         f.institution_id,
         i.name AS institution_name,
         f.user_id,
         u.email AS user_email,
         f.source_host,
         f.source_path,
         f.source_url,
         f.found_host,
         f.found_url,
         f.element,
         f.attr,
         f.classification,
         f.reason,
         f.sample_text,
         f.count,
         f.first_seen,
         f.last_seen
       FROM ra_link_audit_findings f
       LEFT JOIN products p ON p.slug = f.product_slug
       LEFT JOIN institutions i ON i.id = f.institution_id
       LEFT JOIN users u ON u.id = f.user_id
       ${where}
       ORDER BY f.last_seen DESC, f.count DESC
       LIMIT ?`
    )
      .bind(...bindings, limit)
      .all();

    const findings = (rows.results || []).map((r) => ({
      key_hash: r.key_hash,
      product_slug: r.product_slug || null,
      product_name: r.product_name || null,
      institution_id: r.institution_id != null ? Number(r.institution_id) : null,
      institution_name: r.institution_name || null,
      user_id: r.user_id != null ? Number(r.user_id) : null,
      user_email: r.user_email || null,
      source_host: r.source_host || null,
      source_path: r.source_path || null,
      source_url: r.source_url || null,
      found_host: r.found_host || null,
      found_url: r.found_url || null,
      element: r.element || null,
      attr: r.attr || null,
      classification: r.classification || null,
      reason: r.reason || null,
      sample_text: r.sample_text || null,
      count: Number(r.count || 0),
      first_seen: Number(r.first_seen || 0),
      last_seen: Number(r.last_seen || 0),
    }));

    const summaryRows = await c.env.DB.prepare(
      `SELECT classification, COUNT(*) AS unique_count, SUM(count) AS hit_count
         FROM ra_link_audit_findings
        ${productSlug ? 'WHERE product_slug = ?' : ''}
        GROUP BY classification`
    )
      .bind(...(productSlug ? [productSlug] : []))
      .all();

    const summary = {};
    for (const r of summaryRows.results || []) {
      summary[r.classification || 'unknown'] = {
        unique_count: Number(r.unique_count || 0),
        hit_count: Number(r.hit_count || 0),
      };
    }

    return c.json({ findings, summary, limit });
  });

  app.delete('/api/ra/admin/link-audit', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const productSlug = parseOptionalString(c.req.query('product_slug'), 128);
    if (productSlug) {
      await c.env.DB.prepare('DELETE FROM ra_link_audit_findings WHERE product_slug = ?')
        .bind(productSlug)
        .run();
    } else {
      await c.env.DB.prepare('DELETE FROM ra_link_audit_findings').run();
    }
    return c.json({ ok: true });
  });
}

function parseOptionalInt(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalString(raw, maxLength) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function clampInt(value, min, max, fallback) {
  if (value == null) return fallback;
  const v = Math.trunc(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}
