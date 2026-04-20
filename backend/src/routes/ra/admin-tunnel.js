/**
 * backend/src/routes/ra/admin-tunnel.js
 *
 * Super-admin kurum tüneli yapılandırma endpoint'leri.
 *
 *   GET  /api/ra/admin/institution-egress/:institution_id
 *     → { egress_endpoint, enabled, tunnel_status, tunnel_last_seen,
 *         has_secret } (secret düz metin asla döndürülmez)
 *
 *   PUT  /api/ra/admin/institution-egress/:institution_id
 *     body: { egress_endpoint, egress_secret?, enabled }
 *     → egress_secret verildiyse AES-GCM ile şifreleyip kaydeder;
 *       verilmediyse mevcut ciphertext korunur.
 *
 *   POST /api/ra/admin/institution-egress/:institution_id/test
 *     → {egress_endpoint}/health'i fetch eder, status + latency döner;
 *       başarılı ise tunnel_status='ok', tunnel_last_seen=now.
 *
 * Erişim: yalnız super_admin (LibEdge'in kendi requireAuth + rol kontrolü).
 */

import { requireAuth, parseAndValidate } from '../../index.js';
import { encryptCredential } from '../../ra/crypto.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';

/**
 * @param {import('hono').Hono} app
 */
export function registerRaAdminTunnel(app) {
  // ─── GET ─────────────────────────────────────────────────────────────────
  app.get('/api/ra/admin/institution-egress/:institution_id', async (c) => {
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
      `SELECT egress_endpoint, enabled, tunnel_status, tunnel_last_seen,
              egress_secret_enc
         FROM institution_ra_settings
        WHERE institution_id = ?`
    )
      .bind(institutionId)
      .first();

    if (!row) {
      return c.json({
        institution_id: institutionId,
        egress_endpoint: null,
        enabled: 0,
        tunnel_status: 'unconfigured',
        tunnel_last_seen: null,
        has_secret: false,
      });
    }

    return c.json({
      institution_id: institutionId,
      egress_endpoint: row.egress_endpoint,
      enabled: row.enabled ? 1 : 0,
      tunnel_status: row.tunnel_status || 'unknown',
      tunnel_last_seen: row.tunnel_last_seen,
      has_secret: !!row.egress_secret_enc,
    });
  });

  // ─── PUT ─────────────────────────────────────────────────────────────────
  app.put('/api/ra/admin/institution-egress/:institution_id', async (c) => {
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

    const body = await parseAndValidate(c, {
      egress_endpoint: { type: 'string', maxLength: 512 },
      egress_secret: { type: 'string', maxLength: 512 },
      enabled: { type: 'number', integer: true, min: 0, max: 1 },
    });
    if (body instanceof Response) return body;

    // Hafif URL doğrulaması — https şart
    if (body.egress_endpoint) {
      try {
        const u = new URL(body.egress_endpoint);
        if (u.protocol !== 'https:') {
          return c.json({ error: 'egress_endpoint https olmalı' }, 400);
        }
      } catch {
        return c.json({ error: 'egress_endpoint geçersiz URL' }, 400);
      }
    }

    // Secret verildiyse master key ile şifrele
    let secretEnc = null;
    let secretProvided = false;
    if (body.egress_secret) {
      if (!c.env.RA_CREDS_MASTER_KEY) {
        return c.json({ error: 'RA_CREDS_MASTER_KEY tanımlı değil' }, 500);
      }
      try {
        secretEnc = await encryptCredential(
          body.egress_secret,
          c.env.RA_CREDS_MASTER_KEY
        );
        secretProvided = true;
      } catch (err) {
        console.error('encryptCredential failed', err);
        return c.json({ error: 'Secret şifreleme hatası' }, 500);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const existing = await c.env.DB.prepare(
      `SELECT 1 FROM institution_ra_settings WHERE institution_id = ?`
    )
      .bind(institutionId)
      .first();

    if (existing) {
      // UPDATE — secret verilmediyse egress_secret_enc'i dokunma
      if (secretProvided) {
        await c.env.DB.prepare(
          `UPDATE institution_ra_settings
              SET egress_endpoint   = COALESCE(?, egress_endpoint),
                  egress_secret_enc = ?,
                  enabled           = ?,
                  updated_at        = ?
            WHERE institution_id    = ?`
        )
          .bind(
            body.egress_endpoint ?? null,
            secretEnc,
            body.enabled ?? 0,
            now,
            institutionId
          )
          .run();
      } else {
        await c.env.DB.prepare(
          `UPDATE institution_ra_settings
              SET egress_endpoint = COALESCE(?, egress_endpoint),
                  enabled         = ?,
                  updated_at      = ?
            WHERE institution_id  = ?`
        )
          .bind(
            body.egress_endpoint ?? null,
            body.enabled ?? 0,
            now,
            institutionId
          )
          .run();
      }
    } else {
      // INSERT — ilk kayıt
      await c.env.DB.prepare(
        `INSERT INTO institution_ra_settings
           (institution_id, egress_endpoint, egress_secret_enc,
            tunnel_status, enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'unknown', ?, ?, ?)`
      )
        .bind(
          institutionId,
          body.egress_endpoint ?? null,
          secretEnc,
          body.enabled ?? 0,
          now,
          now
        )
        .run();
    }

    return c.json({ ok: true, institution_id: institutionId, updated_at: now });
  });

  // ─── POST .../test ───────────────────────────────────────────────────────
  app.post('/api/ra/admin/institution-egress/:institution_id/test', async (c) => {
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
      `SELECT egress_endpoint FROM institution_ra_settings WHERE institution_id = ?`
    )
      .bind(institutionId)
      .first();

    if (!row || !row.egress_endpoint) {
      return c.json({ ok: false, error: 'egress_endpoint tanımlı değil' }, 400);
    }

    const healthUrl = `${row.egress_endpoint.replace(/\/$/, '')}/health`;
    const start = Date.now();
    let status = 0;
    let bodyText = '';
    let errorMsg = null;

    try {
      const resp = await fetch(healthUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      status = resp.status;
      bodyText = (await resp.text()).slice(0, 256);
    } catch (err) {
      errorMsg = String(err && err.message ? err.message : err);
    }
    const latencyMs = Date.now() - start;

    const ok = status === 200 && !errorMsg;
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(
      `UPDATE institution_ra_settings
          SET tunnel_status    = ?,
              tunnel_last_seen = CASE WHEN ? = 1 THEN ? ELSE tunnel_last_seen END,
              updated_at       = ?
        WHERE institution_id   = ?`
    )
      .bind(ok ? 'ok' : 'error', ok ? 1 : 0, now, now, institutionId)
      .run();

    return c.json({
      ok,
      status,
      latency_ms: latencyMs,
      body: bodyText,
      error: errorMsg,
      tested_url: healthUrl,
    });
  });
}
