-- 0025_ra_stable_host_prep.sql
-- stable_host_proxy + cookie-namespace altyapısı için hazırlık
--
-- 1. SciFinder: sso.cas.org'u proxyable host listesine ekle
--    (session proxy /__ra-host/sso-cas-org/ üzerinden OIDC akışını yönetir)
--
-- 2. ra_debug_events: staging ortamında publisher cookie namespacing
--    debug kayıtları için (writeRaDebugEvent fn, sadece ENVIRONMENT=staging'de çalışır)

-- SciFinder host allowlist
UPDATE products
SET ra_host_allowlist_json = '["sso.cas.org"]'
WHERE slug = 'cas-scifinder-discovery-platform'
  AND (ra_host_allowlist_json IS NULL OR ra_host_allowlist_json = '');

-- Debug events tablosu (sadece staging'de yazılır, prod'da boş kalır)
CREATE TABLE IF NOT EXISTS ra_debug_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      INTEGER NOT NULL,
  product_slug    TEXT,
  institution_id  INTEGER,
  target_host     TEXT,
  target_path     TEXT,
  request_path    TEXT,
  request_url     TEXT,
  upstream_status INTEGER,
  cf_mitigated    TEXT,
  cf_ray          TEXT,
  request_cookie_names  TEXT,
  upstream_cookie_names TEXT,
  set_cookie_names      TEXT,
  request_ch_names      TEXT,
  upstream_ch_names     TEXT,
  referer         TEXT,
  upstream_referer TEXT,
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_ra_debug_events_created
  ON ra_debug_events (created_at DESC);
