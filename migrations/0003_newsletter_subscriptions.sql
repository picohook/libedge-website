-- =====================================================================
-- 0003_newsletter_subscriptions.sql
-- Newsletter subscription state for guests and authenticated users.
-- Safe for fresh installs and existing databases.
-- =====================================================================

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'active',
  source          TEXT NOT NULL DEFAULT 'guest',
  subscribed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_status
  ON newsletter_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_newsletter_user_status
  ON newsletter_subscriptions(user_id, status);
