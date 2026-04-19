ALTER TABLE institution_subscriptions ADD COLUMN access_type TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN access_url TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN requires_institution_email INTEGER DEFAULT 0;
ALTER TABLE institution_subscriptions ADD COLUMN requires_vpn INTEGER DEFAULT 0;
ALTER TABLE institution_subscriptions ADD COLUMN access_notes_tr TEXT;
ALTER TABLE institution_subscriptions ADD COLUMN access_notes_en TEXT;
