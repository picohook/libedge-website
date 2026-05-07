-- migrations/0028_enable_acs_waf_browser.sql
--
-- ACS Publications can pass the landing page with uTLS/h2, but search and
-- other document navigations may still receive a Cloudflare managed challenge.
-- Route ACS document GETs through ra-browser so the challenge can settle in a
-- real Chromium context and its cookies can be promoted back to the proxy jar.

UPDATE products
SET ra_waf_browser = 1
WHERE slug = 'acs';
