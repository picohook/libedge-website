-- Research entitlement model: reuse existing subscription catalog, add institution seat limits.
ALTER TABLE institution_subscriptions ADD COLUMN seat_limit INTEGER;

CREATE TABLE IF NOT EXISTS institution_subscription_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_subscription_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  assigned_by INTEGER,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_subscription_id, user_id),
  FOREIGN KEY (institution_subscription_id) REFERENCES institution_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_institution_subscription_seats_subscription
  ON institution_subscription_seats(institution_subscription_id);
CREATE INDEX IF NOT EXISTS idx_institution_subscription_seats_user
  ON institution_subscription_seats(user_id);

INSERT INTO products (
  slug, name, category, region, default_access_type, default_access_url,
  short_description_tr, short_description_en, subjects_json,
  is_libedge_catalog, card_visible, display_order, is_featured
) VALUES (
  'research', 'Research', 'Yapay Zeka', 'LibEdge',
  'internal', '/research.html',
  'Akademik kaynak keşfi ve kanıta dayalı araştırma asistanı.',
  'Academic evidence discovery and research assistant.',
  '["yapay-zeka","akademik-arastirma"]',
  1, 1, 38, 0
)
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  region = excluded.region,
  default_access_type = excluded.default_access_type,
  default_access_url = excluded.default_access_url,
  short_description_tr = excluded.short_description_tr,
  short_description_en = excluded.short_description_en,
  subjects_json = excluded.subjects_json,
  is_libedge_catalog = excluded.is_libedge_catalog,
  card_visible = excluded.card_visible,
  display_order = excluded.display_order;
