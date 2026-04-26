/**
 * backend/src/ra/schema.js
 *
 * Remote Access modülü için defansif şema guard'ı. LibEdge'in
 * ensureInstitutionSubscriptionAccessColumns / ensureProductsTableAndSeed
 * pattern'ini takip eder — migration dosyası state tablosuna işlenmediğinde
 * (yerel dev, fresh staging) kolonları/tabloları runtime'da garanti eder.
 *
 * LibEdge gerçek şemasına göre id tipleri:
 *   institutions.id                      INTEGER
 *   users.id                             INTEGER
 *   institution_subscriptions.product_slug  TEXT  (products.slug'a FK mantığı)
 *   products.slug                        TEXT PK (products.id YOK)
 *
 * Production'da maliyeti yok çünkü her kolon/tablo için tek bir
 * PRAGMA table_info / sqlite_master lookup sonra büyük ihtimal noop döner.
 * İlk request'te bir kere çağır, sonra in-memory flag ile skip et.
 */

let schemaEnsured = false;

/**
 * @param {D1Database} db
 */
export async function ensureRemoteAccessSchema(db) {
  if (schemaEnsured) return;

  // products ek kolonları
  // ra_requires_tunnel: IP-gated publisher'lar (ScienceDirect, Wiley kurumsal)
  // için 1 (default). Pangram gibi per-user session-cookie auth kullanan,
  // herkese açık ama credential'la giriş gereken publisher'lar için 0.
  await ensureColumns(db, 'products', [
    { name: 'ra_enabled', def: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'ra_delivery_mode', def: "TEXT NOT NULL DEFAULT 'path_proxy'" },
    { name: 'ra_origin_host', def: 'TEXT' },
    { name: 'ra_login_recipe_json', def: 'TEXT' },
    { name: 'ra_host_allowlist_json', def: 'TEXT' },
    { name: 'ra_requires_tunnel', def: 'INTEGER NOT NULL DEFAULT 1' },
    // ra_origin_landing_path: session cookie set edildikten sonra kullanıcının
    // yönlendirileceği ilk path. Boş/null ise '/' kullanılır.
    // Örn: jove-research → '/research', pangram → '/login'
    { name: 'ra_origin_landing_path', def: 'TEXT' },
  ]);

  // institution_subscriptions ek kolonları
  await ensureColumns(db, 'institution_subscriptions', [
    { name: 'ra_credential_scope', def: 'TEXT' },
    { name: 'ra_credential_enc', def: 'TEXT' },
    { name: 'ra_recipe_override_json', def: 'TEXT' },
    { name: 'ra_valid_until', def: 'INTEGER' },
  ]);

  // institution_ra_settings — CREATE TABLE IF NOT EXISTS (tablo zaten varsa noop)
  // 0015 migration'da farklı yapıyla yaratılmış olabilir; eksik kolonları
  // ensureColumns ile defansif ekle.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS institution_ra_settings (
        institution_id INTEGER PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
        egress_endpoint TEXT,
        egress_secret_enc TEXT,
        tunnel_token_hash TEXT,
        tunnel_status TEXT NOT NULL DEFAULT 'unknown',
        tunnel_last_seen INTEGER,
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();

  // 0015'in eski yapısında (ra_enabled + id + ra_origin_host + ra_allowed_ips)
  // bu kolonlar eksik olabilir — defansif ekle.
  await ensureColumns(db, 'institution_ra_settings', [
    { name: 'egress_endpoint',   def: 'TEXT' },
    { name: 'egress_secret_enc', def: 'TEXT' },
    { name: 'tunnel_token_hash', def: 'TEXT' },
    { name: 'tunnel_status',     def: "TEXT NOT NULL DEFAULT 'unknown'" },
    { name: 'tunnel_last_seen',  def: 'INTEGER' },
    { name: 'enabled',           def: 'INTEGER NOT NULL DEFAULT 0' },
  ]);

  // ra_user_credentials — user_id INTEGER, product_slug TEXT
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ra_user_credentials (
        user_id INTEGER NOT NULL,
        product_slug TEXT NOT NULL,
        credential_enc TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, product_slug)
      )`
    )
    .run();

  // ra_access_logs + indexler (user_id INTEGER, institution_id INTEGER, product_slug TEXT)
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ra_access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        institution_id INTEGER,
        product_slug TEXT,
        target_host TEXT,
        target_path TEXT,
        status INTEGER,
        bytes_out INTEGER,
        upstream_latency_ms INTEGER,
        ip_hash TEXT,
        ts INTEGER NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_ra_logs_user_ts ON ra_access_logs(user_id, ts DESC)`
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_ra_logs_inst_ts ON ra_access_logs(institution_id, ts DESC)`
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_ra_logs_product_ts ON ra_access_logs(product_slug, ts DESC)`
    )
    .run();

  // Ek indexler (opsiyonel ama sorguları hızlandırır)
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_inst_subs_access_type ON institution_subscriptions(institution_id, access_type)`
    )
    .run();

  // Bilinen ürünler için güvenli RA varsayımları.
  // Yalnızca bariz şekilde yapılandırılmamış kayıtları backfill ederiz;
  // admin'in elle verdiği değerleri ezmeyiz.
  // Eski delivery enum değerleri standartlaştırılır:
  // proxy/direct_login artık path_proxy davranışıyla temsil edilir.
  await db.prepare(
    `UPDATE products
        SET ra_delivery_mode = 'path_proxy'
      WHERE LOWER(TRIM(COALESCE(ra_delivery_mode, ''))) IN ('proxy', 'direct_login')`
  ).run();

  // jove-research RA varsayımları — yalnızca boş/yapılandırılmamış alanları doldurur,
  // admin'in elle verdiği değerleri ezmez.
  await db.prepare(
    `UPDATE products
        SET ra_enabled      = 1,
            ra_origin_host  = COALESCE(NULLIF(TRIM(ra_origin_host), ''), 'www.jove.com'),
            ra_delivery_mode = CASE
              WHEN ra_delivery_mode IS NULL OR TRIM(ra_delivery_mode) = ''
              THEN 'session_host_proxy'
              ELSE ra_delivery_mode
            END,
            ra_origin_landing_path = COALESCE(NULLIF(TRIM(ra_origin_landing_path), ''), '/research'),
            ra_host_allowlist_json = COALESCE(
              NULLIF(ra_host_allowlist_json, ''),
              '["www.jove.com","jove.com"]'
            ),
            ra_requires_tunnel = 1
      WHERE slug = 'jove-research'`
  ).run();

  schemaEnsured = true;
}

/**
 * Tabloda kolon yoksa ALTER TABLE ADD COLUMN çalıştırır.
 * SQLite 3.35+ DROP COLUMN destekler ama biz ADD-only kullanıyoruz.
 *
 * @param {D1Database} db
 * @param {string} table
 * @param {{ name: string, def: string }[]} cols
 */
async function ensureColumns(db, table, cols) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set((info.results || []).map((r) => r.name));
  for (const { name, def } of cols) {
    if (!existing.has(name)) {
      try {
        await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`).run();
      } catch (err) {
        // Race koşulunda iki request aynı anda ekleyebilir — "duplicate column"
        // hatası güvenle yutulur.
        const msg = String((err && err.message) || err);
        if (!/duplicate column/i.test(msg)) throw err;
      }
    }
  }
}
