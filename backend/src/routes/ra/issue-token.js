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
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;

    const userId = auth.user.user_id;            // INTEGER
    const institutionId = auth.user.institution_id; // INTEGER or null
    if (!institutionId) {
      return c.json({ error: 'Kullanıcı bir kuruma bağlı değil' }, 403);
    }

    // Body doğrulama — subscription_id (INTEGER) YA DA product_slug (TEXT)
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

    // Süre kontrolü: ra_valid_until (unix ts override) veya end_date (YYYY-MM-DD string)
    const now = Math.floor(Date.now() / 1000);
    const raExp = sub.ra_valid_until ? Number(sub.ra_valid_until) : null;
    const endExp = sub.end_date ? Math.floor(new Date(sub.end_date).getTime() / 1000) : null;
    const exp = raExp ?? endExp ?? null;
    if (exp && exp < now) {
      return c.json({ error: 'Abonelik süresi dolmuş' }, 410);
    }

    // products.ra_enabled = 1 olmalı
    if (!sub.ra_enabled) {
      return c.json({ error: 'Bu ürün için uzaktan erişim aktif değil' }, 409);
    }

    const deliveryMode = normalizeDeliveryMode(sub.ra_delivery_mode);

    // ra_origin_host zorunlu — hyphen-encode
    if (!sub.ra_origin_host) {
      return c.json({ error: 'Publisher origin host tanımlı değil' }, 500);
    }
    const landingPath = normalizeLandingPath(sub.ra_origin_landing_path);

    if (deliveryMode === 'direct_login') {
      const redirectUrl = `https://${sub.ra_origin_host}${landingPath}`;
      return c.json({ redirect_url: redirectUrl, expires_at: now + 300 });
    }

    const tgt = encodeHost(sub.ra_origin_host);

    // Tünel zorunluluğu — IP-gated publisher için gerekli
    // Heuristik: recipe'te upstream_login varsa credential-auth yeterli,
    // yoksa IP egress şart → institution_ra_settings.enabled = 1 olmalı.
    const recipeJson =
      sub.ra_recipe_override_json || sub.ra_login_recipe_json || null;
    const hasLoginRecipe = recipeJson ? hasUpstreamLogin(recipeJson) : false;
    const requiresTunnel = sub.ra_requires_tunnel == null
      ? 1
      : (sub.ra_requires_tunnel ? 1 : 0);

    if (!hasLoginRecipe && requiresTunnel) {
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
        lp: landingPath,          // ilk açılış path'i ('/' veya '/login' vb.)
        rt: requiresTunnel,       // 1 => egress tunnel, 0 => direct/public fetch
        exp: now + 300,           // 5 dk
        jti,
      },
      c.env.RA_PROXY_TOKEN_SECRET
    );

    // Proxy domain'i env'den; yoksa prod default
    // Path-based format: https://{proxyHost}/{tgt}/?t={token}
    const proxyHost = c.env.RA_PROXY_HOST || 'proxy.selmiye.com';
    const redirectUrl = `https://${proxyHost}/${tgt}/?t=${token}`;

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
      p.ra_delivery_mode,
      p.ra_origin_host,
      p.ra_login_recipe_json,
      COALESCE(p.ra_requires_tunnel, 1) AS ra_requires_tunnel,
      p.ra_origin_landing_path
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

function normalizeLandingPath(raw) {
  if (!raw) return '/';
  const trimmed = String(raw).trim();
  if (!trimmed) return '/';
  if (/^[a-z]+:\/\//i.test(trimmed)) return '/';
  if (trimmed.includes('..')) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeDeliveryMode(raw) {
  const mode = String(raw || '').trim().toLowerCase();
  return mode || 'proxy';
}
