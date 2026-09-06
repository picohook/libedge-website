-- Add new AI product cards to the product catalog.
-- Safe to rerun: existing manually edited fields are only overwritten for these three slugs.

INSERT INTO products (
  slug, name, category, region,
  default_access_type, default_access_url,
  logo_url, logo_updated_at,
  card_background_url, card_background_updated_at,
  short_description_tr, short_description_en,
  subjects_json, is_libedge_catalog, card_visible, display_order, is_featured
) VALUES
  (
    'evidencemd', 'EvidenceMD', 'Sağlık ve Yapay Zeka', 'Türkiye, Orta Doğu',
    'direct', 'https://evidencemd.ai/',
    'assets/images/evidencemd_logo.png', CURRENT_TIMESTAMP,
    'assets/images/medical.webp', CURRENT_TIMESTAMP,
    'Klinik muhakeme, karar desteği ve kanıt sentezi için sağlık odaklı yapay zeka platformu.',
    'A health-focused AI platform for clinical reasoning, decision support, and evidence synthesis.',
    '["saglik","yapay-zeka"]', 1, 1, 32, 0
  ),
  (
    'grammarly', 'Grammarly', 'Yapay Zeka', 'Türkiye, Orta Doğu',
    'direct', 'https://www.grammarly.com/',
    'assets/images/grammarly_logo.svg', CURRENT_TIMESTAMP,
    'assets/images/transl.webp', CURRENT_TIMESTAMP,
    'Yazım, ton, açıklık ve üretkenlik için yapay zeka destekli iletişim asistanı.',
    'An AI-powered communication assistant for writing, tone, clarity, and productivity.',
    '["yapay-zeka"]', 1, 1, 34, 0
  ),
  (
    'superhuman-suite', 'Superhuman Suite', 'Yapay Zeka', 'Türkiye, Orta Doğu',
    'direct', 'https://superhuman.com/',
    'assets/images/superhuman_logo.png', CURRENT_TIMESTAMP,
    'assets/images/library.webp', CURRENT_TIMESTAMP,
    'E-posta, doküman ve günlük iş akışlarında yapay zeka destekli üretkenlik paketi.',
    'An AI productivity suite for email, documents, and everyday workflows.',
    '["yapay-zeka"]', 1, 1, 36, 0
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
  short_description_tr = excluded.short_description_tr,
  short_description_en = excluded.short_description_en,
  subjects_json = excluded.subjects_json,
  is_libedge_catalog = excluded.is_libedge_catalog,
  card_visible = excluded.card_visible,
  display_order = excluded.display_order;
