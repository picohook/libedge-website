-- Add new AI product cards to the product catalog.
-- Safe to rerun: existing manually edited fields are only overwritten for these three slugs.

INSERT INTO products (
  slug, name, category, region,
  default_access_type, default_access_url,
  logo_url, logo_updated_at,
  card_background_url, card_background_updated_at,
  subjects_json, card_visible, display_order, is_featured
) VALUES
  (
    'evidencemd', 'EvidenceMD', 'Sağlık ve Yapay Zeka', 'Türkiye, Orta Doğu',
    'direct', 'https://evidencemd.ai/',
    'assets/images/evidencemd_logo.png', CURRENT_TIMESTAMP,
    'assets/images/medical.webp', CURRENT_TIMESTAMP,
    '["saglik","yapay-zeka"]', 1, 32, 0
  ),
  (
    'grammarly', 'Grammarly', 'Yapay Zeka', 'Türkiye, Orta Doğu',
    'direct', 'https://www.grammarly.com/',
    'assets/images/grammarly_logo.svg', CURRENT_TIMESTAMP,
    'assets/images/transl.webp', CURRENT_TIMESTAMP,
    '["yapay-zeka"]', 1, 34, 0
  ),
  (
    'superhuman-suite', 'Superhuman Suite', 'Yapay Zeka', 'Türkiye, Orta Doğu',
    'direct', 'https://superhuman.com/',
    'assets/images/superhuman_logo.png', CURRENT_TIMESTAMP,
    'assets/images/library.webp', CURRENT_TIMESTAMP,
    '["yapay-zeka"]', 1, 36, 0
  )
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  region = excluded.region,
  default_access_type = excluded.default_access_type,
  default_access_url = excluded.default_access_url,
  logo_url = excluded.logo_url,
  logo_updated_at = COALESCE(products.logo_updated_at, excluded.logo_updated_at),
  card_background_url = excluded.card_background_url,
  card_background_updated_at = COALESCE(products.card_background_updated_at, excluded.card_background_updated_at),
  subjects_json = excluded.subjects_json,
  card_visible = excluded.card_visible,
  display_order = excluded.display_order;
