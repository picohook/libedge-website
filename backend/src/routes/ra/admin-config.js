/**
 * backend/src/routes/ra/admin-config.js
 *
 * Super-admin için RA yapılandırma endpoint'leri:
 *
 *   GET /api/ra/admin/products-ra
 *     → Ürünlerin RA alanlarını listeler (ra_enabled, ra_origin_host,
 *       ra_login_recipe_json, ra_host_allowlist_json).
 *
 *   PUT /api/ra/admin/products/:slug/ra-config
 *     body: { ra_enabled, ra_origin_host, ra_login_recipe_json, ra_host_allowlist_json }
 *     → Yukarıdaki alanları günceller. recipe ve allowlist JSON.parse edilerek
 *       kısa bir geçerlilik kontrolünden geçer.
 *
 *   GET /api/ra/admin/subscriptions-ra
 *     → access_type='proxy' abonelikleri + RA metadata
 *       (institution adı, ra_credential_scope, has_credential flag,
 *        ra_valid_until, access_url, access_notes_tr). Plaintext credential
 *       ASLA döndürülmez.
 *
 *   PUT /api/ra/admin/subscriptions/:id/ra-credential
 *     body: { username?, password?, scope?, valid_until?, clear? }
 *     → username + password'u JSON ({"username":...,"password":...}) formatında
 *       AES-GCM ile şifreler ve ra_credential_enc alanına yazar.
 *       clear=true ise mevcut credential silinir.
 *
 * Güvenlik:
 *   - Tüm endpoint'ler super_admin role'u gerektirir.
 *   - GET endpoint'leri ra_credential_enc ciphertext'ini bile döndürmez;
 *     sadece has_credential boolean'ı.
 *   - PUT /ra-credential plaintext'i request body'de alıp hemen şifreler;
 *     plaintext asla log'lanmaz.
 */

import { requireAuth } from '../../index.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';
import { encryptCredential } from '../../ra/crypto.js';

const ALLOWED_ACCESS_TYPES = [
  'direct',
  'ip',
  'proxy',
  'sso',
  'institution_link',
  'email_password_external',
  'mixed',
];

const MAX_RECIPE_BYTES = 16 * 1024; // 16 KB — recipe genelde ~1-2 KB
const MAX_ALLOWLIST_BYTES = 4 * 1024;
const MAX_USERNAME_LEN = 256;
const MAX_PASSWORD_LEN = 512;

/**
 * @param {import('hono').Hono} app
 */
export function registerRaAdminConfig(app) {
  // ─── GET /api/ra/admin/products-ra ────────────────────────────────────────
  app.get('/api/ra/admin/products-ra', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const rows = await c.env.DB.prepare(
      `SELECT
         slug, name, category, region,
         default_access_type,
         ra_enabled,
         ra_origin_host,
         ra_login_recipe_json,
         ra_host_allowlist_json,
         ra_requires_tunnel
       FROM products
       ORDER BY name COLLATE NOCASE`
    ).all();

    const products = (rows.results || []).map((r) => ({
      slug: r.slug,
      name: r.name || r.slug,
      category: r.category || null,
      region: r.region || null,
      default_access_type: r.default_access_type || null,
      ra_enabled: r.ra_enabled ? 1 : 0,
      ra_origin_host: r.ra_origin_host || null,
      ra_login_recipe_json: r.ra_login_recipe_json || null,
      ra_host_allowlist_json: r.ra_host_allowlist_json || null,
      ra_requires_tunnel: r.ra_requires_tunnel == null ? 1 : (r.ra_requires_tunnel ? 1 : 0),
    }));

    return c.json({ products });
  });

  // ─── PUT /api/ra/admin/products/:slug/ra-config ───────────────────────────
  app.put('/api/ra/admin/products/:slug/ra-config', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const slug = String(c.req.param('slug') || '').trim();
    if (!slug) return c.json({ error: 'slug gerekli' }, 400);

    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON body gerekli' }, 400);
    }
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'geçersiz body' }, 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT slug FROM products WHERE slug = ?`
    )
      .bind(slug)
      .first();
    if (!existing) return c.json({ error: 'Ürün bulunamadı' }, 404);

    const raEnabled = body.ra_enabled ? 1 : 0;
    const raOriginHost = normalizeHost(body.ra_origin_host);
    if (raOriginHost && !isValidHost(raOriginHost)) {
      return c.json({ error: 'ra_origin_host geçersiz bir hostname' }, 400);
    }

    let recipeJson = null;
    if (body.ra_login_recipe_json != null && body.ra_login_recipe_json !== '') {
      const raw = String(body.ra_login_recipe_json);
      if (raw.length > MAX_RECIPE_BYTES) {
        return c.json({ error: 'ra_login_recipe_json çok uzun' }, 400);
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return c.json({ error: 'recipe JSON objesi olmalı' }, 400);
        }
      } catch (err) {
        return c.json({ error: `recipe JSON parse hatası: ${err.message}` }, 400);
      }
      recipeJson = raw;
    }

    let allowlistJson = null;
    if (body.ra_host_allowlist_json != null && body.ra_host_allowlist_json !== '') {
      const raw = String(body.ra_host_allowlist_json);
      if (raw.length > MAX_ALLOWLIST_BYTES) {
        return c.json({ error: 'ra_host_allowlist_json çok uzun' }, 400);
      }
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return c.json({ error: 'host allowlist bir dizi olmalı' }, 400);
        }
        for (const h of parsed) {
          if (typeof h !== 'string' || !isValidHost(h)) {
            return c.json({ error: `allowlist geçersiz host içeriyor: ${h}` }, 400);
          }
        }
      } catch (err) {
        return c.json({ error: `allowlist JSON parse hatası: ${err.message}` }, 400);
      }
      allowlistJson = raw;
    }

    // ra_requires_tunnel: gönderilmediyse (undefined) mevcut değeri koru,
    // gönderildiyse 0/1'e normalize et.
    const hasRequiresTunnel = Object.prototype.hasOwnProperty.call(
      body,
      'ra_requires_tunnel'
    );
    if (hasRequiresTunnel) {
      const raRequiresTunnel = body.ra_requires_tunnel ? 1 : 0;
      await c.env.DB.prepare(
        `UPDATE products
            SET ra_enabled             = ?,
                ra_origin_host         = ?,
                ra_login_recipe_json   = ?,
                ra_host_allowlist_json = ?,
                ra_requires_tunnel     = ?
          WHERE slug = ?`
      )
        .bind(
          raEnabled,
          raOriginHost,
          recipeJson,
          allowlistJson,
          raRequiresTunnel,
          slug
        )
        .run();
    } else {
      await c.env.DB.prepare(
        `UPDATE products
            SET ra_enabled             = ?,
                ra_origin_host         = ?,
                ra_login_recipe_json   = ?,
                ra_host_allowlist_json = ?
          WHERE slug = ?`
      )
        .bind(raEnabled, raOriginHost, recipeJson, allowlistJson, slug)
        .run();
    }

    return c.json({ success: true, slug });
  });

  // ─── GET /api/ra/admin/subscriptions-ra ───────────────────────────────────
  app.get('/api/ra/admin/subscriptions-ra', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const rows = await c.env.DB.prepare(
      `SELECT
         s.id,
         s.institution_id,
         i.name          AS institution_name,
         s.product_slug,
         p.name          AS product_name,
         s.access_type,
         s.access_url,
         s.ra_credential_scope,
         s.ra_valid_until,
         CASE WHEN s.ra_credential_enc IS NOT NULL AND s.ra_credential_enc != ''
              THEN 1 ELSE 0 END AS has_credential,
         s.status,
         s.created_at
       FROM institution_subscriptions s
       LEFT JOIN institutions i ON i.id = s.institution_id
       LEFT JOIN products p     ON p.slug = s.product_slug
       WHERE s.access_type = 'proxy'
          OR (s.ra_credential_enc IS NOT NULL AND s.ra_credential_enc != '')
       ORDER BY i.name COLLATE NOCASE, p.name COLLATE NOCASE`
    ).all();

    const subscriptions = (rows.results || []).map((r) => ({
      id: Number(r.id),
      institution_id: Number(r.institution_id),
      institution_name: r.institution_name || null,
      product_slug: r.product_slug,
      product_name: r.product_name || r.product_slug,
      access_type: r.access_type || null,
      access_url: r.access_url || null,
      ra_credential_scope: r.ra_credential_scope || null,
      ra_valid_until: r.ra_valid_until ? Number(r.ra_valid_until) : null,
      has_credential: !!r.has_credential,
      status: r.status || null,
      created_at: r.created_at ? Number(r.created_at) : null,
    }));

    return c.json({ subscriptions });
  });

  // ─── PUT /api/ra/admin/subscriptions/:id/ra-credential ────────────────────
  app.put('/api/ra/admin/subscriptions/:id/ra-credential', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: 'id geçersiz' }, 400);
    }

    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON body gerekli' }, 400);
    }
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'geçersiz body' }, 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT id FROM institution_subscriptions WHERE id = ?`
    )
      .bind(id)
      .first();
    if (!existing) return c.json({ error: 'Abonelik bulunamadı' }, 404);

    // scope update (her zaman uygulanır eğer verilmişse)
    const updateParts = [];
    const updateBindings = [];

    if (body.access_type != null) {
      const t = String(body.access_type);
      if (!ALLOWED_ACCESS_TYPES.includes(t)) {
        return c.json({ error: 'access_type geçersiz' }, 400);
      }
      updateParts.push('access_type = ?');
      updateBindings.push(t);
    }

    if (body.scope !== undefined) {
      if (body.scope === null || body.scope === '') {
        updateParts.push('ra_credential_scope = NULL');
      } else {
        const scope = String(body.scope).trim();
        if (scope !== 'shared' && scope !== 'per_user') {
          return c.json({ error: "scope 'shared' veya 'per_user' olmalı" }, 400);
        }
        updateParts.push('ra_credential_scope = ?');
        updateBindings.push(scope);
      }
    }

    if (body.valid_until !== undefined) {
      if (body.valid_until === null || body.valid_until === '') {
        updateParts.push('ra_valid_until = NULL');
      } else {
        const vu = Number(body.valid_until);
        if (!Number.isFinite(vu) || vu <= 0) {
          return c.json({ error: 'valid_until geçersiz (unix saniye)' }, 400);
        }
        updateParts.push('ra_valid_until = ?');
        updateBindings.push(Math.trunc(vu));
      }
    }

    if (body.clear === true) {
      updateParts.push('ra_credential_enc = NULL');
    } else if (body.username != null || body.password != null) {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) {
        return c.json({ error: 'username ve password gerekli' }, 400);
      }
      if (username.length > MAX_USERNAME_LEN) {
        return c.json({ error: 'username çok uzun' }, 400);
      }
      if (password.length > MAX_PASSWORD_LEN) {
        return c.json({ error: 'password çok uzun' }, 400);
      }
      if (!c.env.RA_CREDS_MASTER_KEY) {
        return c.json({ error: 'RA_CREDS_MASTER_KEY tanımlı değil' }, 500);
      }

      // username ve password'u tek bir JSON içinde saklıyoruz — recipe executor
      // parse edip hem form field adlarını hem de değerleri kullanabilsin.
      const plaintext = JSON.stringify({ username, password });
      let encrypted;
      try {
        encrypted = await encryptCredential(plaintext, c.env.RA_CREDS_MASTER_KEY);
      } catch (err) {
        console.error('encryptCredential failed', err);
        return c.json({ error: 'Credential şifreleme hatası' }, 500);
      }
      updateParts.push('ra_credential_enc = ?');
      updateBindings.push(encrypted);
    }

    if (!updateParts.length) {
      return c.json({ success: true, noop: true });
    }

    await c.env.DB.prepare(
      `UPDATE institution_subscriptions
          SET ${updateParts.join(', ')}
        WHERE id = ?`
    )
      .bind(...updateBindings, id)
      .run();

    return c.json({ success: true, id });
  });
}

function normalizeHost(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // https:// prefix'i kırpalım — sadece hostname kaydediyoruz.
  const withoutScheme = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return withoutScheme || null;
}

function isValidHost(host) {
  if (typeof host !== 'string') return false;
  if (host.length > 253) return false;
  // Basit hostname validation: label.label.tld
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
}
