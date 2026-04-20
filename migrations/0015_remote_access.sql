-- migrations/0015_remote_access.sql
-- Remote Access modülü için şema eklemeleri.
--
-- Prensip: Mevcut `products` ve `institution_subscriptions` tablolarını
-- extend eder; yeni kaynak/abonelik tablosu eklemez. `access_type='proxy'`
-- değerli institution_subscriptions kayıtları RA'nın handle edeceği settir.
--
-- LibEdge gerçek şeması (0001_initial_schema + 0014):
--   institutions.id                     INTEGER PRIMARY KEY AUTOINCREMENT
--   users.id                            INTEGER PRIMARY KEY AUTOINCREMENT
--   users.institution_id                INTEGER REFERENCES institutions(id)
--   institution_subscriptions.id        INTEGER PRIMARY KEY AUTOINCREMENT
--   institution_subscriptions.institution_id INTEGER
--   institution_subscriptions.product_slug    TEXT   ← product_id DEĞİL
--   products.slug                       TEXT PRIMARY KEY  ← products.id YOK
--
-- Idempotent değildir (SQLite ALTER TABLE ADD COLUMN IF NOT EXISTS yok);
-- backend/src/index.js içindeki ensureRemoteAccessSchema(db) helper runtime
-- defansif ekleme yapar. Migration state tablosu zaten tekrar çalıştırmayı
-- engelliyor.

-- ───────────────────────────────────────────────────────────────────────────
-- products: publisher bazlı RA default ayarları
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN ra_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN ra_origin_host TEXT;
ALTER TABLE products ADD COLUMN ra_login_recipe_json TEXT;
ALTER TABLE products ADD COLUMN ra_host_allowlist_json TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- institution_subscriptions: kurum × ürün seviyesinde RA credential & override
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE institution_subscriptions ADD COLUMN ra_credential_scope TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN ra_credential_enc TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN ra_recipe_override_json TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN ra_valid_until INTEGER;

-- ───────────────────────────────────────────────────────────────────────────
-- institution_ra_settings: kurumun egress tüneli ve RA-genel ayarları
-- institution_id INTEGER (LibEdge'in gerçek id tipiyle uyumlu)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institution_ra_settings (
  institution_id INTEGER PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  egress_endpoint TEXT,
  egress_secret_enc TEXT,
  tunnel_token_hash TEXT,
  tunnel_status TEXT NOT NULL DEFAULT 'unknown',
  tunnel_last_seen INTEGER,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ───────────────────────────────────────────────────────────────────────────
-- ra_user_credentials: kullanıcı-bazlı publisher credential (faz 2)
-- user_id INTEGER, product_slug TEXT (products.slug'a referans)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ra_user_credentials (
  user_id INTEGER NOT NULL,
  product_slug TEXT NOT NULL,
  credential_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_slug)
);

-- ───────────────────────────────────────────────────────────────────────────
-- ra_access_logs: audit, rate-limit, abuse detection
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ra_access_logs (
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
);

CREATE INDEX IF NOT EXISTS idx_ra_logs_user_ts    ON ra_access_logs(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ra_logs_inst_ts    ON ra_access_logs(institution_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ra_logs_product_ts ON ra_access_logs(product_slug, ts DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- Ek indexler (opsiyonel ama issue-token ve portal sorgularını hızlandırır)
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inst_subs_access_type ON institution_subscriptions(institution_id, access_type);
CREATE INDEX IF NOT EXISTS idx_products_ra_enabled   ON products(ra_enabled) WHERE ra_enabled = 1;
