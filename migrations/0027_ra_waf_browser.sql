-- migrations/0027_ra_waf_browser.sql
--
-- Adds ra_waf_browser flag to products table.
-- When set to 1, the Proxy Worker routes GET requests for this product
-- through the ra-browser (Playwright/Chromium) container instead of the
-- Go HTTP client in ra-egress. Needed for CF Managed Challenge publishers
-- (Emerald, OUP, Wiley, CAB Abstracts) whose WAF fingerprints real Chrome.

ALTER TABLE products ADD COLUMN ra_waf_browser INTEGER NOT NULL DEFAULT 0;

-- Seed: enable browser mode for known CF Managed Challenge publishers.
-- Apply after migration when ra-browser container is deployed at the institution.
--
-- UPDATE products SET ra_waf_browser = 1
-- WHERE slug IN ('emerald-premier', 'oxford-university-press', 'wiley', 'cab-abstracts');
