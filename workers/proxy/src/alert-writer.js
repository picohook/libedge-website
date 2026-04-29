/**
 * workers/proxy/src/alert-writer.js
 *
 * Upstream 401/403 hatalarını ra_alerts tablosuna yazar.
 * KV throttle ile aynı product+status kombinasyonu için 15 dakikada bir kayıt açılır;
 * alarm fırtınasını önler. ctx.waitUntil() ile çağrılmalıdır — yanıtı bloklamaz.
 */

const THROTTLE_TTL_SEC = 15 * 60; // 15 dakika

/**
 * @param {object} env  Cloudflare Worker env bindings (DB + RA_UPSTREAM_SESSIONS)
 * @param {{ product_slug: string, institution_id: number, target_host: string, status: number }} info
 */
export async function writeUpstreamAlert(env, { product_slug, institution_id, target_host, status }) {
  if (!env.RA_UPSTREAM_SESSIONS || !env.DB) return;

  const throttleKey = `alert-throttle:${product_slug || 'unknown'}:${status}`;
  try {
    const hit = await env.RA_UPSTREAM_SESSIONS.get(throttleKey);
    if (hit) return; // aynı pencerede zaten yazıldı

    await env.RA_UPSTREAM_SESSIONS.put(throttleKey, '1', { expirationTtl: THROTTLE_TTL_SEC });

    await env.DB
      .prepare(
        `INSERT INTO ra_alerts (product_slug, institution_id, target_host, upstream_status, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        product_slug || null,
        institution_id || null,
        target_host || null,
        status,
        Math.floor(Date.now() / 1000)
      )
      .run();
  } catch (err) {
    // Alert yazımı başarısız olursa proxy akışını bozmuyoruz
    console.warn('writeUpstreamAlert failed', err);
  }
}
