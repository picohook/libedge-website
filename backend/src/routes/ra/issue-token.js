/**
 * backend/src/routes/ra/issue-token.js
 *
 * POST /api/ra/issue-token
 *
 * Main Worker endpoint'i. Kullanıcı portal'da "Erişime Git" butonuna
 * tıklayınca buraya AJAX atar; yanıtta proxy Worker'a yönlendirecek
 * kısa ömürlü (5 dk) JWT'li URL döner.
 *
 * LibEdge'in mevcut backend/src/index.js'indeki helper kontratları:
 *
 *   async function requireAuth(c)
 *     → { user, token }  // auth.user = JWT payload (user_id, institution_id, role, ...)
 *     → { response }     // zaten 401 cevabı; doğrudan return et
 *
 *   async function parseAndValidate(c, rules)
 *     → body (object)    // başarılıysa parse edilmiş gövde
 *     → Response         // başarısızsa 400 JSON (caller `instanceof Response` ile yakalar)
 *
 * Bu helper'ların kullanılabilmesi için iki seçenek var:
 *   A) Tercih edilen — backend/src/index.js'in üstlerinde fonksiyon tanımlarına
 *      `export` anahtar kelimesi ekleyin:
 *          export async function requireAuth(c) { ... }
 *          export async function parseAndValidate(c, rules) { ... }
 *      Sonra aşağıdaki `from '../../index.js'` import'u çalışır.
 *   B) Helper'ları ayrı bir dosyaya (backend/src/_helpers.js) taşıyın ve
 *      hem index.js hem buradan import edin.
 */

import { requireAuth, parseAndValidate } from '../../index.js';
import { signProxyToken, newJti } from '../../ra/jwt.js';
import { encodeHost } from '../../ra/host.js';
import { ensureRemoteAccessSchema } from '../../ra/schema.js';

/**
 * @param {import('hono').Hono} app
 */
export function registerRaIssueToken(app) {
  app.post('/api/ra/issue-token', async (c) => {
    // Şema garanti (ilk çağrıda ALTER/CREATE, sonrasında in-memory skip)
    await ensureRemoteAccessSchema(c.env.DB);

    // LibEdge auth
    const authResult = await requireAuth(c);
    if (authResult.response) return authResult.response;

    // GEÇİCİ - TEST İÇİN institution_id hardcoded
    const institutionId = 1;
    const userId = authResult.user.id || authResult.user.user_id || 2;

    // Body doğrulama
    const body = await parseAndValidate(c, {
      subscription_id: { type: 'number', integer: true, min: 1 },
      product_slug: { type: 'string', maxLength: 128 },
    });
    if (body instanceof Response) return body;
    
    if (!body.subscription_id && !body.product_slug) {
      return c.json(
        { error: 'subscription_id veya product_slug verilmelidir' },
        400
      );
    }

    // institution_subscriptions + products JOIN
    const sub = await lookupSubscription(c.env.DB, {
      institutionId,
      subscriptionId: body.subscription_id,
      productSlug: body.product_slug,
    });

    if (!sub) {
      return c.json({ error: 'Abonelik bulunamadı' }, 403);
    }

    // access_type = 'proxy' olmalı; aksi hâlde RA bu aboneliği handle etmez
    if (sub.access_type !== 'proxy') {
      return c.json(
        {
          error: 'Bu abonelik uzaktan erişim proxy üzerinden değil, ' +
                 'doğrudan publisher linki ile açılır.',
          access_type: sub.access_type,
        },
        409
      );
    }

    // Süre kontrolü:
    //   ra_valid_until → INTEGER unix timestamp (RA-specific override)
    //   end_date       → date string (ISO veya 'YYYY-MM-DD'), LibEdge genel alanı
    const now = Math.floor(Date.now() / 1000);
    if (sub.ra_valid_until && Number(sub.ra_valid_until) < now) {
      return c.json({ error: 'Abonelik süresi dolmuş' }, 410);
    }
    if (sub.end_date) {
      const endTs = Math.floor(new Date(sub.end_date).getTime() / 1000);
      if (Number.isFinite(endTs) && endTs < now) {
        return c.json({ error: 'Abonelik süresi dolmuş' }, 410);
      }
    }

    // products.ra_enabled = 1 olmalı
    if (!sub.ra_enabled) {
      return c.json({ error: 'Bu ürün için uzaktan erişim aktif değil' }, 409);
    }

    // ra_origin_host zorunlu — hyphen-encode
    if (!sub.ra_origin_host) {
      return c.json({ error: 'Publisher origin host tanımlı değil' }, 500);
    }
    const tgt = encodeHost(sub.ra_origin_host);

    // Tünel zorunluluğu — IP-gated publisher için gerekli
    // Heuristik: recipe'te upstream_login varsa credential-auth yeterli,
    // yoksa IP egress şart → institution_ra_settings.enabled = 1 olmalı.
    const recipeJson =
      sub.ra_recipe_override_json || sub.ra_login_recipe_json || null;
    const hasLoginRecipe = recipeJson ? hasUpstreamLogin(recipeJson) : false;

    if (!hasLoginRecipe) {
      const settings = await c.env.DB.prepare(
        `SELECT enabled, tunnel_status
           FROM institution_ra_settings
          WHERE institution_id = ?`
      )
        .bind(institutionId)
        .first();
      if (!settings || !settings.enabled) {
        return c.json(
          { error: 'Kurum için uzaktan erişim tüneli yapılandırılmamış' },
          409
        );
      }
    }

    // Kısa ömürlü proxy JWT (HS256)
    const jti = newJti();
    const token = await signProxyToken(
      {
        iss: 'ra-main',
        aud: 'ra-proxy',
        sub: userId,              // INTEGER user id
        iid: institutionId,       // INTEGER institution id
        sid: sub.id,              // INTEGER subscription id
        pid: sub.product_slug,    // TEXT product slug
        tgt,                      // encoded publisher host
        exp: now + 300,           // 5 dk
        jti,
      },
      c.env.RA_PROXY_TOKEN_SECRET
    );

    // jti rezervasyonu (replay koruması) — proxy aynı KV'yi okur
    await c.env.RATE_LIMIT_KV.put(`ra:jti:${jti}`, '1', {
      expirationTtl: 600,
    });

    // Proxy domain'i env'den; yoksa prod default.
    // POC: tek subdomain + query-param encoding (wildcard cert gerekmez).
    //   https://proxy-staging.selmiye.com/?tgt=www-jove-com#t=eyJ...
    const proxyHost = c.env.RA_PROXY_HOST || 'proxy.selmiye.com';
    const redirectUrl = `https://${proxyHost}/?tgt=${encodeURIComponent(tgt)}#t=${token}`;

    return c.json({ redirect_url: redirectUrl, expires_at: now + 300 });
  });
}

/**
 * institution_subscriptions + products JOIN (products.slug = isub.product_slug)
 */
async function lookupSubscription(db, { institutionId, subscriptionId, productSlug }) {
  const base = `
    SELECT
      isub.id,
      isub.product_slug,
      isub.end_date,
      isub.ra_credential_scope,
      isub.ra_credential_enc,
      isub.ra_recipe_override_json,
      isub.ra_valid_until,
      COALESCE(
        NULLIF(TRIM(isub.access_type), ''),
        p.default_access_type
      )                            AS access_type,
      COALESCE(p.ra_enabled, 0)    AS ra_enabled,
      p.ra_origin_host,
      p.ra_login_recipe_json
    FROM institution_subscriptions isub
    JOIN products p ON p.slug = isub.product_slug
    WHERE isub.institution_id = ?
  `;
  if (subscriptionId) {
    return await db
      .prepare(`${base} AND isub.id = ? LIMIT 1`)
      .bind(institutionId, subscriptionId)
      .first();
  }
  return await db
    .prepare(`${base} AND isub.product_slug = ? LIMIT 1`)
    .bind(institutionId, productSlug)
    .first();
}

/**
 * Recipe JSON'ında `upstream_login.enabled === true` var mı?
 */
function hasUpstreamLogin(recipeJson) {
  try {
    const r = JSON.parse(recipeJson);
    return !!(r && r.upstream_login && r.upstream_login.enabled);
  } catch {
    return false;
  }
}
