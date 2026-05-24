-- Step 06 v2 — Per-publisher cookie isolation mode.
-- 'scoped' (default): mevcut davranış. __cp_<scope>|<name> prefix + Domain=.selmiye.com.
--   Çoklu paralel session'da cookie çakışmasını prefix ile önler.
-- 'host': vetis-tarzı. Prefix yok, Set-Cookie Domain=session host (ör. r{sid}.selmiye.com).
--   Session host zaten unique olduğu için doğal izolasyon. Wiley gibi heavy client-state
--   yayıncılar için (raw cookie name'leri JS bekliyor).
--
-- Default 'scoped' → çalışan tüm publisher davranışı korunur.

ALTER TABLE products ADD COLUMN IF NOT EXISTS ra_cookie_mode TEXT NOT NULL DEFAULT 'scoped';
