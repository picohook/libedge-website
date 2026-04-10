-- =====================================================================
-- 0002_form_submissions.sql
-- Form gönderimlerini takip etmek için tablo
-- =====================================================================

CREATE TABLE IF NOT EXISTS form_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type    TEXT NOT NULL,                      -- trial | suggest | contact
  name         TEXT,
  email        TEXT,
  institution  TEXT,
  product      TEXT,                               -- trial için ürün adı
  subject      TEXT,                               -- contact için konu
  message      TEXT,
  user_id      INTEGER,                            -- giriş yapmış kullanıcıysa
  on_behalf    INTEGER DEFAULT 0,                  -- kurum adına mı gönderildi
  status       TEXT DEFAULT 'pending',             -- pending | reviewing | responded | completed
  admin_note   TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_status
  ON form_submissions(status);

CREATE INDEX IF NOT EXISTS idx_form_submissions_type
  ON form_submissions(form_type);
