ALTER TABLE products ADD COLUMN logo_asset_key TEXT;
ALTER TABLE products ADD COLUMN logo_url TEXT;
ALTER TABLE products ADD COLUMN logo_updated_at TEXT;
ALTER TABLE products ADD COLUMN brand_color TEXT;
ALTER TABLE products ADD COLUMN short_description_tr TEXT;
ALTER TABLE products ADD COLUMN short_description_en TEXT;
ALTER TABLE products ADD COLUMN subjects_json TEXT;
ALTER TABLE products ADD COLUMN card_visible INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN display_order INTEGER DEFAULT 999;
ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_card_order
  ON products(card_visible, display_order, name);
