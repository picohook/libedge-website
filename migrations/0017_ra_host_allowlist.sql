-- 0017_ra_host_allowlist.sql
-- Sadece kolon yoksa ekle (idempotent)
ALTER TABLE products ADD COLUMN IF NOT EXISTS ra_host_allowlist_json TEXT;
