-- migrations/0018_ra_schema_complete.sql
--
-- Remote Access şema tamamlama — 0015'te eksik kalan kolonlar.
--
-- 0015 migration'ı yalnızca ra_enabled + ra_origin_host ekledi.
-- Bu migration production'da eksik olan tüm kolonları tamamlar.
-- Staging'de ensureRemoteAccessSchema() runtime guard ile de ekleniyor;
-- bu migration production fresh deploy için gerekli.
--
-- SQLite ALTER TABLE ADD COLUMN IF NOT EXISTS desteklemez.
-- Eğer staging'de bu kolonlar zaten varsa (runtime guard veya manuel ekleme),
-- wrangler bu migrationu SADECE BİR KEZ çalıştırır (migrations state tablosu).
-- Staging'de tekrar uygulamaya çalışırsan "duplicate column" hatası alırsın —
-- bu durumda: wrangler d1 execute libedge-db --env staging --command
--   "INSERT OR IGNORE INTO d1_migrations (name,applied_at) VALUES ('0018_ra_schema_complete.sql',datetime('now'))"
-- ile migration'ı uygulanmış olarak işaretle.

-- ── products: eksik RA kolonları ────────────────────────────────────────────
ALTER TABLE products ADD COLUMN ra_delivery_mode TEXT NOT NULL DEFAULT 'path_proxy';
ALTER TABLE products ADD COLUMN ra_login_recipe_json TEXT;
ALTER TABLE products ADD COLUMN ra_host_allowlist_json TEXT;
ALTER TABLE products ADD COLUMN ra_requires_tunnel INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN ra_origin_landing_path TEXT;

-- ── institution_subscriptions: eksik RA kolonları ────────────────────────────
ALTER TABLE institution_subscriptions ADD COLUMN ra_credential_scope TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN ra_credential_enc TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN ra_recipe_override_json TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN ra_valid_until INTEGER;

-- ── institution_ra_settings: 0015'te eksik kalan egress/tunnel kolonları ────
-- 0015 bu tabloyu ra_enabled + ra_origin_host + ra_allowed_ips ile yarattı.
-- issue-token.js 'enabled' ve 'egress_endpoint' kolonlarını bekliyor.
ALTER TABLE institution_ra_settings ADD COLUMN egress_endpoint TEXT;
ALTER TABLE institution_ra_settings ADD COLUMN egress_secret_enc TEXT;
ALTER TABLE institution_ra_settings ADD COLUMN tunnel_token_hash TEXT;
ALTER TABLE institution_ra_settings ADD COLUMN tunnel_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE institution_ra_settings ADD COLUMN tunnel_last_seen INTEGER;
ALTER TABLE institution_ra_settings ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0;

-- ── ra_user_credentials: yeni tablo (faz 2, şimdilik boş) ───────────────────
CREATE TABLE IF NOT EXISTS ra_user_credentials (
  user_id INTEGER NOT NULL,
  product_slug TEXT NOT NULL,
  credential_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_slug)
);

-- ── İndexler ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inst_subs_access_type
  ON institution_subscriptions(institution_id, access_type);

CREATE INDEX IF NOT EXISTS idx_products_ra_enabled
  ON products(ra_enabled) WHERE ra_enabled = 1;

-- ── jove-research RA ayarları (boşsa set et) ─────────────────────────────────
UPDATE products
   SET ra_enabled             = 1,
       ra_delivery_mode       = 'session_host_proxy',
       ra_origin_host         = 'www.jove.com',
       ra_origin_landing_path = '/research',
       ra_host_allowlist_json = '["www.jove.com","jove.com"]',
       ra_requires_tunnel     = 1
 WHERE slug = 'jove-research';
