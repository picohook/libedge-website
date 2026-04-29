ALTER TABLE products ADD COLUMN card_background_asset_key TEXT;
ALTER TABLE products ADD COLUMN card_background_url TEXT;
ALTER TABLE products ADD COLUMN card_background_updated_at TEXT;
ALTER TABLE products ADD COLUMN card_background_overlay TEXT DEFAULT 'light';
ALTER TABLE products ADD COLUMN card_front_text_color TEXT;
ALTER TABLE products ADD COLUMN card_back_text_color TEXT;
