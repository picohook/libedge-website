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
import { buildProxyLandingPath } from '../../ra/proxy-url.js';

const SESSION_TTL_SEC = 3600; // session_host_proxy oturumu süresi
const ALLOWED_DELIVERY_MODES = new Set(['session_host_proxy', 'path_proxy']);

/** 7 karakterlik base36 rastgele ID (cryptographically random) */
function generateSessionId() {
  const arr = new Uint8Array(5);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 7);
}

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

    // Body doğrulama — subscription_id (INTEGER) YA DA product_slug (TEXT).
    // admin_test=true: admin/super_admin'in abonelik gerektirmeden bir ürünü test
    // etmesi için (ör. ekleme sırasında kendi kurumuna abonelik açmaya gerek
    // kalmadan smoke test). Sadece product_slug ile beraber kullanılır.
    const body = await parseAndValidate(c, {
      subscription_id: { type: 'number', integer: true, min: 1 },
      product_slug: { type: 'string', maxLength: 128 },
      admin_test: { type: 'boolean' },
    });
    if (body instanceof Response) return body;

    const adminTest = body.admin_test === true;

    if (adminTest) {
      const role = String(auth.user.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'super_admin') {
        return c.json({ error: 'Test erişimi yalnızca admin/super_admin için' }, 403);
      }
      if (!body.product_slug) {
        return c.json({ error: 'admin_test → product_slug zorunlu' }, 400);
      }
    } else if (!body.subscription_id && !body.product_slug) {
      return c.json(
        { error: 'subscription_id veya product_slug verilmelidir' },
        400
      );
    }

    // adminTest=true ise abonelik aramazız, sadece products tablosundan publisher
    // konfigürasyonunu alırız. Diğer kontroller (ra_enabled, ra_origin_host,
    // tunnel) gerçek RA flow'la aynı kalır — admin'in kurumunda tunnel kapalı
    // ise hala 409 üretiriz (bu zaten teyit etmek istediğimiz şey).
    const sub = adminTest
      ? await lookupProductForTest(c.env.DB, body.product_slug)
      : await lookupSubscription(c.env.DB, {
          institutionId,
          subscriptionId: body.subscription_id,
          productSlug: body.product_slug,
        });

    if (!sub) {
      return c.json(
        { error: adminTest ? 'Ürün bulunamadı' : 'Abonelik bulunamadı' },
        adminTest ? 404 : 403
      );
    }

    // ra_enabled birincil RA sinyali; legacy access_type 'proxy' veya 'ip' de
    // kabul edilir. adminTest mode'unda sub'da access_type/end_date alanları
    // yoktur — sadece ra_enabled ve ra_origin_host kontrolü anlamlıdır.
    if (!adminTest) {
      const isRaSubscription =
        !!sub.ra_enabled ||
        sub.access_type === 'proxy' ||
        sub.access_type === 'ip';

      if (!isRaSubscription) {
        return c.json(
          {
            error: 'Bu abonelik uzaktan erişim proxy üzerinden değil, ' +
                   'doğrudan publisher linki ile açılır.',
            access_type: sub.access_type,
          },
          409
        );
      }
    }

    // Süre kontrolü: ra_valid_until (unix ts override) veya end_date (YYYY-MM-DD string).
    // adminTest mode'unda abonelik yok, süre kontrolü atlanır.
    const now = Math.floor(Date.now() / 1000);
    if (!adminTest) {
      const raExp = sub.ra_valid_until ? Number(sub.ra_valid_until) : null;
      const endExp = sub.end_date ? Math.floor(new Date(sub.end_date).getTime() / 1000) : null;
      const exp = raExp ?? endExp ?? null;
      if (exp && exp < now) {
        return c.json({ error: 'Abonelik süresi dolmuş' }, 410);
      }
    }

    // products.ra_enabled = 1 olmalı (isRaSubscription kontrolü zaten bunu kapsıyor ama açık bırakıyoruz)
    if (!sub.ra_enabled) {
      return c.json({ error: 'Bu ürün için uzaktan erişim aktif değil' }, 409);
    }

    // ra_origin_host zorunlu
    if (!sub.ra_origin_host) {
      return c.json({ error: 'Publisher origin host tanımlı değil' }, 500);
    }

    // Tünel zorunluluğu — credential-only publisher'lar hariç egress şart
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

    // Delivery mode: path_proxy (default) veya session_host_proxy.
    // Legacy DB değerleri ('proxy', 'direct_login') path_proxy olarak yürür.
    const deliveryMode = normalizeDeliveryMode(sub.ra_delivery_mode);
    if (!ALLOWED_DELIVERY_MODES.has(deliveryMode)) {
      return c.json({ error: `ra_delivery_mode geçersiz: ${deliveryMode}` }, 500);
    }

    // Kısa ömürlü proxy JWT (HS256). adminTest mode'unda sub.id yok — 0
    // sentinel'i ile imzala (proxy Worker token'ı kullanır ama sid'i abonelik
    // tablosuyla eşleştirmeye çalışmaz).
    const jti = newJti();
    const token = await signProxyToken(
      {
        iss: 'ra-main',
        aud: 'ra-proxy',
        sub: userId,
        iid: institutionId,
        sid: adminTest ? 0 : sub.id,
        pid: sub.product_slug,
        tgt: deliveryMode === 'session_host_proxy'
          ? sub.ra_origin_host          // düz hostname, encode edilmez
          : encodeHost(sub.ra_origin_host), // path_proxy: hyphen-encoded
        mod: deliveryMode,              // proxy Worker modu seçmek için
        exp: now + 300,
        jti,
      },
      c.env.RA_PROXY_TOKEN_SECRET
    );

    // jti proxy Worker tarafından ilk kullanımda 'used' olarak yazılır.
    // Burada yazmıyoruz — proxy tek yazar, aksi hâlde '1' değeri "kullanıldı" sanılır.

    // Landing path: ürün bazında ilk açılacak sayfa (örn. JoVE Research → /research)
    // Boş/null ise '/' kullanılır. Başında slash olduğundan emin ol.
    const landingPath = buildProxyLandingPath(sub.ra_origin_landing_path);

    let redirectUrl;
    if (deliveryMode === 'session_host_proxy') {
      // Session-host: r{sid}.{baseHost} formatında unique subdomain
      const baseHost = c.env.RA_PROXY_BASE_HOST || 'selmiye.com';
      const sid = generateSessionId();  // 7 char base36
      // KV'ya session kaydı yaz (token doğrulanmadan ÖNCE — proxy Worker doğrular)
      await c.env.RA_UPSTREAM_SESSIONS.put(
        `rhost:r${sid}`,
        JSON.stringify({
          origin_host:     sub.ra_origin_host,
          institution_id:  institutionId,
          user_id:         userId,
          product_slug:    sub.product_slug,
          subscription_id: adminTest ? 0 : sub.id, // admin_test: sentinel 0 (JWT sid ile tutarlı)
          created_at:      now,
          expires_at:      now + SESSION_TTL_SEC,
        }),
        { expirationTtl: SESSION_TTL_SEC }
      );
      // /research?t=JWT → proxy token doğrular → 302 /research → JoVE /research
      redirectUrl = `https://r${sid}.${baseHost}${landingPath}?t=${token}`;
    } else {
      // path_proxy: selmiye.com/{encoded-host}{landingPath}?t={token}
      const baseHost = c.env.RA_PROXY_HOST || c.env.RA_PROXY_BASE_HOST || 'selmiye.com';
      const encodedLabel = encodeHost(sub.ra_origin_host);
      redirectUrl = `https://${baseHost}/${encodedLabel}${landingPath}?t=${token}`;
    }

    // ─── Compliance log (non-blocking) ───────────────────────────────────────
    // Token başarıyla verildiğinde "erişim oturumu başladı" kaydı yaz.
    // status/bytes/latency proxy katmanında ölçülebilir; şimdilik NULL bırakılır.
    // ip_hash: Cloudflare'in CF-Connecting-IP başlığı main Worker'a geliyor,
    // proxy Worker'a gelmiyor — burada hash'leyebiliriz.
    const rawIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';
    let ipHash = null;
    if (rawIp) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawIp.split(',')[0].trim()));
        ipHash = Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch { /* ip hashing opsiyonel */ }
    }

    const accessLogWrite = c.env.DB.prepare(
      `INSERT INTO ra_access_logs
         (user_id, institution_id, product_slug, target_host, target_path, ip_hash, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        userId,
        institutionId,
        sub.product_slug,
        sub.ra_origin_host,
        landingPath || '/',
        ipHash,
        now
      )
      .run()
      .catch((err) => console.error('[RA] access log write failed', err));

    try {
      c.executionCtx.waitUntil(accessLogWrite);
    } catch {
      // Hono unit tests do not provide an ExecutionContext.
    }

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
      p.ra_login_recipe_json,
      COALESCE(p.ra_delivery_mode, 'path_proxy') AS ra_delivery_mode,
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
 * adminTest mode için ürün konfigürasyonunu products tablosundan tek başına
 * çeker — institution_subscriptions ile JOIN'siz. Geri dönen şekil
 * lookupSubscription ile uyumludur (id=null, end_date=null gibi abonelik-özel
 * alanlar yoktur, kalan tüm RA alanları aynıdır).
 */
async function lookupProductForTest(db, productSlug) {
  return await db
    .prepare(`
      SELECT
        NULL                                       AS id,
        p.slug                                     AS product_slug,
        NULL                                       AS end_date,
        NULL                                       AS ra_credential_scope,
        NULL                                       AS ra_credential_enc,
        NULL                                       AS ra_recipe_override_json,
        NULL                                       AS ra_valid_until,
        NULL                                       AS access_type,
        COALESCE(p.ra_enabled, 0)                  AS ra_enabled,
        p.ra_origin_host,
        p.ra_login_recipe_json,
        COALESCE(p.ra_delivery_mode, 'path_proxy') AS ra_delivery_mode,
        p.ra_origin_landing_path
      FROM products p
      WHERE p.slug = ?
      LIMIT 1
    `)
    .bind(productSlug)
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

function normalizeDeliveryMode(raw) {
  const mode = String(raw || '').trim().toLowerCase();
  if (!mode) return 'path_proxy';
  if (mode === 'proxy' || mode === 'direct_login') return 'path_proxy';
  return mode;
}
