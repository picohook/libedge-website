-- =====================================================================
-- 0009_announcement_extra_columns.sql
-- Announcements tablosuna runtime ensure* ile eklenen kolonları
-- migration olarak tanımlar. Fresh install ve yeni ortamlar için.
--
-- NOT: Bu migration zaten kolonlar varsa hata verir (D1 ALTER TABLE
-- IF NOT EXISTS desteklemez). Eğer ensure* fonksiyonları kolonları
-- önceden oluşturmuşsa aşağıdaki komutu çalıştırarak migration'ı
-- uygulanmış olarak işaretle:
--   wrangler d1 execute DB --command \
--     "INSERT OR IGNORE INTO d1_migrations(name) VALUES('0009_announcement_extra_columns.sql')"
-- =====================================================================

ALTER TABLE announcements ADD COLUMN cover_image_url      TEXT;
ALTER TABLE announcements ADD COLUMN title_en              TEXT;
ALTER TABLE announcements ADD COLUMN summary_en            TEXT;
ALTER TABLE announcements ADD COLUMN full_content_en       TEXT;
ALTER TABLE announcements ADD COLUMN ai_image_prompt       TEXT;
ALTER TABLE announcements ADD COLUMN scheduled_publish_at  TEXT;
