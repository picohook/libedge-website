-- Store explicit KVKK / privacy notice consent captured during registration.
ALTER TABLE users ADD COLUMN kvkk_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN kvkk_consent_at DATETIME;
ALTER TABLE users ADD COLUMN kvkk_consent_version TEXT;
ALTER TABLE users ADD COLUMN kvkk_consent_ip TEXT;
ALTER TABLE users ADD COLUMN kvkk_consent_user_agent TEXT;
