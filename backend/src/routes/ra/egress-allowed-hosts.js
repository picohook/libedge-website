/**
 * backend/src/routes/ra/egress-allowed-hosts.js
 *
 * GET /api/ra/egress/allowed-hosts
 *
 * Egress agent'larının dinamik olarak çektiği host listesi.
 * ra_enabled=1 olan tüm ürünlerin ra_origin_host ve ra_host_allowlist_json
 * alanlarını birleştirip benzersiz hostname listesi döner.
 *
 * Auth: Authorization: Bearer <RA_SERVICE_KEY>
 *   RA_SERVICE_KEY → wrangler secret put RA_SERVICE_KEY (her env için ayrı)
 *
 * Egress agent bu endpoint'i startup'ta ve 5 dakikada bir çağırır;
 * ALLOWED_HOST_REGEX env var'ına artık gerek yoktur.
 */

/**
 * @param {import('hono').Hono} app
 */
export function registerRaEgressAllowedHosts(app) {
  app.get('/api/ra/egress/allowed-hosts', async (c) => {
    // ── Auth: Bearer token ──────────────────────────────────────────────────
    const serviceKey = c.env.RA_SERVICE_KEY;
    if (!serviceKey) {
      // RA_SERVICE_KEY tanımlanmamışsa endpoint devre dışı
      return c.json({ error: 'endpoint not configured' }, 503);
    }

    const authHeader = c.req.header('Authorization') || '';
    const provided = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!provided || provided !== serviceKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // ── institution_id zorunlu — başka kurumların host'ları sızdırılmaz ──────
    const institutionId = parseInt(c.req.query('institution_id') || '0', 10);
    if (!institutionId || institutionId <= 0) {
      return c.json({ error: 'institution_id required' }, 400);
    }

    // Tüm ra_enabled ürünlerin host'larını döndür. Abonelik kontrolü zaten
    // /api/ra/issue-token'da yapılıyor (kullanıcı abonesi olmadığı ürün için
    // token alamaz). Bu endpoint sadece ra-egress'in "fetch yapabileceği
    // host'lar" allowlist'ini doldurur — kullanıcı erişim gating'i değil.
    //
    // institution_id parametresi geriye dönük uyumluluk için tutuluyor ama
    // artık filtre olarak kullanılmıyor; super_admin admin_test akışı dahil
    // tüm aktif ürünlerin host'ları egress allowlist'ine girer.
    const rows = await c.env.DB.prepare(`
      SELECT p.ra_origin_host, p.ra_host_allowlist_json
      FROM   products p
      WHERE  p.ra_enabled = 1
        AND  p.ra_origin_host IS NOT NULL
        AND  TRIM(p.ra_origin_host) != ''
    `).all();

    const hostSet = new Set();

    for (const row of (rows.results || [])) {
      // Origin host (her zaman ekle)
      const origin = (row.ra_origin_host || '').toLowerCase().trim();
      if (origin) hostSet.add(origin);

      // Allowlist JSON array
      if (row.ra_host_allowlist_json) {
        try {
          const list = JSON.parse(row.ra_host_allowlist_json);
          if (Array.isArray(list)) {
            for (const h of list) {
              const host = (h || '').toString().toLowerCase().trim();
              if (host) hostSet.add(host);
            }
          }
        } catch {
          // Bozuk JSON → atla, diğer ürünlere devam et
        }
      }
    }

    const hosts = [...hostSet].sort();

    return c.json({
      hosts,
      count: hosts.length,
      generated_at: Math.floor(Date.now() / 1000),
    });
  });
}
