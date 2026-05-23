ALTER TABLE products ADD COLUMN IF NOT EXISTS is_libedge_catalog INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS product_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  institution_id INTEGER,
  product_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_slug),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_institution
  ON product_recommendations(institution_id, product_slug);
