-- migrations/0025_ra_oidc_hash.sql
--
-- institution_ra_settings tablosuna OIDC proxy için hash kolonu ekler.
--
-- oidc_hash: SHA-256(institution_id) hex, ilk 40 karakter.
--   → {oidc_hash}.selmiye.com subdomain'i bu kuruma ait OIDC thin proxy'yi barındırır.
--   → SciFinder'da "Discovery Service URL" olarak bu adres girilir.
--   → NULL: kurumun OIDC proxy'si yok (varsayılan).
--
-- Backend oluşturma (örnek):
--   const hash = await crypto.subtle.digest('SHA-256', encoder.encode(institution_id));
--   const oidc_hash = Array.from(new Uint8Array(hash))
--     .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);

ALTER TABLE institution_ra_settings
  ADD COLUMN oidc_hash TEXT;

-- Unique index: her kurumun farklı hash'i olsun; NULL değerler exempt
CREATE UNIQUE INDEX IF NOT EXISTS idx_irs_oidc_hash
  ON institution_ra_settings (oidc_hash)
  WHERE oidc_hash IS NOT NULL;
