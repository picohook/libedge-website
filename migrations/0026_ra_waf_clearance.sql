-- migrations/0026_ra_waf_clearance.sql
--
-- WAF clearance cookie storage for the RA proxy.
--
-- Problem: publisher WAFs (Cloudflare) issue cf_clearance cookies after a
-- browser-side challenge. The proxy egress IP solves the challenge on behalf
-- of the institution; the resulting cf_clearance value is valid for that IP.
-- When a new user session begins, their browser does not yet hold this
-- clearance cookie, so the first document request triggers a new challenge
-- loop — the egress IP gets the new clearance, but the browser-visible proxy
-- page is still stuck in a redirect loop until the cookie propagates.
--
-- Solution: store the most recent valid clearance value per
-- (product_slug, scope_host). The proxy worker injects this stored clearance
-- into the upstream Cookie header when the browser cookie header does not
-- contain a cf_clearance for that scope_host.
--
-- One row per (product_slug, scope_host). Updated via the proxy admin route
-- POST /__ra-admin/waf-clearance (RA_ADMIN_SECRET protected).

CREATE TABLE IF NOT EXISTS ra_waf_clearance (
  product_slug  TEXT    NOT NULL,
  scope_host    TEXT    NOT NULL,
  clearance     TEXT    NOT NULL,
  updated_at    INTEGER NOT NULL,
  updated_by    TEXT,
  PRIMARY KEY (product_slug, scope_host)
);

CREATE INDEX IF NOT EXISTS idx_ra_waf_clearance_updated
  ON ra_waf_clearance (updated_at DESC);
