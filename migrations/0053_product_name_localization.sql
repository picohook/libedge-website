-- #347: extend the existing bilingual product-content pattern to product names.
ALTER TABLE products ADD COLUMN name_en TEXT;
