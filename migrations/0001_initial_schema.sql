-- =====================================================================
-- 0001_initial_schema.sql
-- Tam şema — taze bir D1 veritabanını production-ready hale getirir.
-- Bu dosya mevcut production şemasının yetkili kaynağıdır.
-- =====================================================================

-- Kurumlar
CREATE TABLE IF NOT EXISTS institutions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE,
  domain      TEXT,
  category    TEXT DEFAULT 'University',
  airtable_id TEXT,
  status      TEXT DEFAULT 'Active',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT,
  institution    TEXT,
  institution_id INTEGER REFERENCES institutions(id),
  role           TEXT DEFAULT 'user',
  avatar_url     TEXT,
  last_login     DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kullanıcı abonelikleri
CREATE TABLE IF NOT EXISTS subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  product_slug TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'trial',
  start_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date     DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Kurum abonelikleri
CREATE TABLE IF NOT EXISTS institution_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL,
  product_slug TEXT NOT NULL,
  status       TEXT DEFAULT 'active',
  start_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_date     DATETIME,
  created_by   INTEGER,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

-- Kurum klasörleri
CREATE TABLE IF NOT EXISTS institution_folders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id   TEXT NOT NULL,
  folder_name      TEXT NOT NULL,
  parent_folder_id INTEGER,
  is_public        INTEGER DEFAULT 0,
  created_by       INTEGER,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (institution_id, folder_name, parent_folder_id)
);

-- Kurum dosyaları
CREATE TABLE IF NOT EXISTS institution_files (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  file_url       TEXT NOT NULL,
  file_type      TEXT,
  file_size      INTEGER,
  category       TEXT,
  folder_id      INTEGER,
  is_public      INTEGER DEFAULT 0,
  is_active      INTEGER DEFAULT 1,
  uploaded_by    INTEGER,
  uploaded_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Duyurular
CREATE TABLE IF NOT EXISTS announcements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,
  full_content TEXT NOT NULL,
  category     TEXT DEFAULT 'general',
  priority     TEXT DEFAULT 'medium',
  is_published INTEGER DEFAULT 1,
  created_by   INTEGER,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_product
  ON subscriptions(product_slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_airtable_id
  ON institutions(airtable_id);
