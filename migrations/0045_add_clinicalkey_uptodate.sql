-- 0045 — ClinicalKey ve UpToDate ürünleri.
--
-- Kurum aboneliği YOK; vetis erişimi olan kurumda mevcut. Test sınırlı olabilir;
-- ra_host_allowlist_json gerekli host'lar test sırasında genişletilebilir.
-- ra_waf_browser=0 default; CF Bot Management challenge tespit edilirse 1'e
-- çekilebilir (ScienceDirect/Wiley gibi).
--
-- ClinicalKey (Elsevier): Elsevier auth host'larını da allowlist'e dahil ettik
--   (ScienceDirect benzeri Elsevier IDP akışı muhtemelen var).
-- UpToDate (Wolters Kluwer): tek-host odaklı, content search landing path.

INSERT INTO products (
  slug, name, category, region,
  default_access_type, default_access_url,
  access_tags_json,
  card_visible,
  ra_enabled, ra_delivery_mode, ra_origin_host, ra_origin_landing_path,
  ra_requires_tunnel, ra_host_allowlist_json
) VALUES
('clinicalkey', 'ClinicalKey (Elsevier)', 'Sağlık', 'Türkiye',
  'ip', 'https://www.clinicalkey.com/',
  '[]',
  1,
  1, 'session_host_proxy', 'www.clinicalkey.com', '/',
  1, '["www.clinicalkey.com","clinicalkey.com","id.elsevier.com","www.elsevier.com","sciverse-shindig.elsevier.com","els-cdn.com","*.els-cdn.com"]'),
('uptodate', 'UpToDate (Wolters Kluwer)', 'Sağlık', 'Türkiye',
  'ip', 'https://www.uptodate.com/contents/search',
  '[]',
  1,
  1, 'session_host_proxy', 'www.uptodate.com', '/contents/search',
  1, '["www.uptodate.com","uptodate.com"]')
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  region = COALESCE(NULLIF(products.region, ''), excluded.region),
  default_access_type = excluded.default_access_type,
  default_access_url = excluded.default_access_url,
  access_tags_json = excluded.access_tags_json,
  card_visible = COALESCE(products.card_visible, excluded.card_visible),
  ra_enabled = excluded.ra_enabled,
  ra_delivery_mode = excluded.ra_delivery_mode,
  ra_origin_host = excluded.ra_origin_host,
  ra_origin_landing_path = excluded.ra_origin_landing_path,
  ra_requires_tunnel = excluded.ra_requires_tunnel,
  ra_host_allowlist_json = excluded.ra_host_allowlist_json;
