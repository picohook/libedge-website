-- 0016_page_views.sql
-- Sayfa görüntülenme sayaçları

CREATE TABLE IF NOT EXISTS page_views (
  page_slug TEXT PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
