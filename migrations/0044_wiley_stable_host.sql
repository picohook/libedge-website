-- Step 06 v3 — Wiley'i stable_host_proxy moda al.
-- Random per-session hostname (r{sid}.selmiye.com) browser cache'i öldürüyordu;
-- her yeni session asset'leri sıfırdan fetch ediyordu. Vetis tüm Wiley
-- kullanıcılarını aynı stable hash hostta tutuyor → browser cache HIT.
--
-- stableProxyHostLabel('wiley', 'onlinelibrary.wiley.com') =
--   d4f83843ac4a1360712d83031df4be4598063902.selmiye.com
--
-- Tüm kurumlar / kullanıcılar globalde aynı hostu paylaşır. Her browser
-- cookie'leri yine kendi izole (cross-user cookie leak yok).
-- Browser asset HTTP cache URL bazlı paylaşılır → vetis tarzı 137/172 HIT.

UPDATE products SET ra_delivery_mode = 'stable_host_proxy' WHERE slug = 'wiley';
