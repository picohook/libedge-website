-- migrations/0029_ra_link_audit.sql
--
-- Aggregated findings from admin-test RA sessions. The proxy records only
-- external URLs observed in rendered publisher pages so admins can spot
-- missing allowlist entries and rewrite failures without keeping raw traffic.

CREATE TABLE IF NOT EXISTS ra_link_audit_findings (
  key_hash TEXT PRIMARY KEY,
  product_slug TEXT,
  institution_id INTEGER,
  user_id INTEGER,
  session_id TEXT,
  source_host TEXT,
  source_path TEXT,
  source_url TEXT,
  found_host TEXT,
  found_url TEXT,
  element TEXT,
  attr TEXT,
  classification TEXT NOT NULL,
  reason TEXT,
  sample_text TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ra_link_audit_product_seen
  ON ra_link_audit_findings(product_slug, last_seen DESC);
