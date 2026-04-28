/**
 * backend/src/routes/ra/admin-oidc.js
 *
 * Kurum OIDC proxy yapılandırması — super-admin endpoint'leri.
 *
 *   GET  /api/ra/admin/institution-oidc/:institution_id
 *     → { institution_id, oidc_hash, oidc_url, has_oidc }
 *       oidc_url: "{hash}.selmiye.com" discovery URL'i; SciFinder'a girilecek adres.
 *
 *   POST /api/ra/admin/institution-oidc/:institution_id/generate
 *     → Kuruma ait deterministic oidc_hash üretir ve D1'e yazar.
 *        Hash = SHA-256(institution_id) hex, ilk 40 karakter.
 *        İdempotent: aynı kuruma tekrar çağrılırsa aynı hash döner.
 *     → { institution_id, oidc_hash, oidc_url }
 *
 * Kullanım — SciFinder kurulum akışı:
 *   1. Admin panelinden "OIDC Hash Oluştur" butonuna tıkla.
 *   2. API POST /generate çağrılır, hash kaydedilir.
 *   3. Admin paneli `{hash}.selmiye.com` URL'ini gösterir.
 *   4. Kurum IT ekibine: "SciFinder > Settings > Discovery Service URL" alanına
 *      bu URL'i gir talimatı verilir.
 *   5. Artık SciFinder OIDC auth akışı bu Worker üzerinden kurumun egress IP'siyle
 *      sso.cas.org'a gider → IP-based auto-auth → proxy oturumu sürer.
 *
 * Güvenlik:
 *   - Yalnız super_admin erişebilir.
 *   - Hash deterministik (SHA-256 of institution_id) → tahmin edilemez ama
 *     üretilmesi tekrar tekrar tutarlı → generate idempotent.
 *   - oidc_hash, URL'de görünür; şifreli değil. Güvenlik bunu gizlemekten değil,
 *     egress HMAC imzası + institution IP kontrolünden gelir.
 */

import { requireAuth } from '../../index.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';

const OIDC_BASE_DOMAIN = 'selmiye.com'; // {hash}.selmiye.com

/**
 * @param {import('hono').Hono} app
 */
export function registerRaAdminOidc(app) {
  // ─── GET /api/ra/admin/institution-oidc/:institution_id ───────────────────
  app.get('/api/ra/admin/institution-oidc/:institution_id', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const institutionId = Number(c.req.param('institution_id'));
    if (!Number.isFinite(institutionId) || institutionId <= 0) {
      return c.json({ error: 'institution_id geçersiz' }, 400);
    }

    const row = await c.env.DB.prepare(
      `SELECT oidc_hash FROM institution_ra_settings WHERE institution_id = ?`
    )
      .bind(institutionId)
      .first();

    const hash = row?.oidc_hash || null;

    return c.json({
      institution_id: institutionId,
      oidc_hash: hash,
      oidc_url: hash ? `https://${hash}.${OIDC_BASE_DOMAIN}` : null,
      has_oidc: !!hash,
    });
  });

  // ─── POST /api/ra/admin/institution-oidc/:institution_id/generate ─────────
  app.post('/api/ra/admin/institution-oidc/:institution_id/generate', async (c) => {
    await ensureRemoteAccessSchema(c.env.DB);

    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const institutionId = Number(c.req.param('institution_id'));
    if (!Number.isFinite(institutionId) || institutionId <= 0) {
      return c.json({ error: 'institution_id geçersiz' }, 400);
    }

    // Zaten hash var mı? → idempotent: aynı hash'i dön
    const existing = await c.env.DB.prepare(
      `SELECT institution_id, oidc_hash FROM institution_ra_settings WHERE institution_id = ?`
    )
      .bind(institutionId)
      .first();

    if (existing?.oidc_hash) {
      const hash = existing.oidc_hash;
      return c.json({
        institution_id: institutionId,
        oidc_hash: hash,
        oidc_url: `https://${hash}.${OIDC_BASE_DOMAIN}`,
        generated: false, // zaten mevcuttu
      });
    }

    // Yeni hash üret: SHA-256(institution_id string) → hex → ilk 40 karakter
    const hash = await deriveOidcHash(String(institutionId));

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      // Kayıt var ama oidc_hash boş → UPDATE
      await c.env.DB.prepare(
        `UPDATE institution_ra_settings
            SET oidc_hash  = ?,
                updated_at = ?
          WHERE institution_id = ?`
      )
        .bind(hash, now, institutionId)
        .run();
    } else {
      // Kayıt hiç yok → INSERT (en az değerlerle; tunnel'ı olmayan kurumlar için)
      await c.env.DB.prepare(
        `INSERT INTO institution_ra_settings
           (institution_id, oidc_hash, tunnel_status, enabled, created_at, updated_at)
         VALUES (?, ?, 'unknown', 0, ?, ?)`
      )
        .bind(institutionId, hash, now, now)
        .run();
    }

    return c.json({
      institution_id: institutionId,
      oidc_hash: hash,
      oidc_url: `https://${hash}.${OIDC_BASE_DOMAIN}`,
      generated: true,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash üretimi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SHA-256(input) → ilk 40 hex karakter.
 * Web Crypto API — Cloudflare Workers'da her ortamda mevcut.
 *
 * @param {string} input
 * @returns {Promise<string>} 40-char lowercase hex
 */
async function deriveOidcHash(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 40);
}
