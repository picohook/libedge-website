-- 0015_remote_access.sql
-- Remote Access modülü için şema eklemeleri

-- 1. Products tablosuna RA ile ilgili kolonları ekle
ALTER TABLE products ADD COLUMN IF NOT EXISTS ra_enabled BOOLEAN DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ra_origin_host TEXT;

-- 2. Institution_subscriptions tablosuna access_type ekle
ALTER TABLE institution_subscriptions ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'direct';

-- 3. RA özel ayarları için yeni tablo
CREATE TABLE IF NOT EXISTS institution_ra_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL UNIQUE,
    ra_enabled BOOLEAN DEFAULT 0,
    ra_origin_host TEXT,
    ra_allowed_ips TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

-- 4. RA erişim logları tablosu
CREATE TABLE IF NOT EXISTS ra_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER,
    session_id TEXT,
    target_host TEXT,
    target_path TEXT,
    access_type TEXT,
    status_code INTEGER,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- 5. Index'ler
CREATE INDEX IF NOT EXISTS idx_ra_settings_institution ON institution_ra_settings(institution_id);
CREATE INDEX IF NOT EXISTS idx_ra_logs_institution ON ra_access_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_ra_logs_session ON ra_access_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_ra_logs_created ON ra_access_logs(created_at);
