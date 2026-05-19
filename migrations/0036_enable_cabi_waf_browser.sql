-- Enable ra_waf_browser for CAB Abstracts.
-- cabidigitallibrary.org uses Cloudflare bot management that blocks the Go HTTP
-- client even from an institutional IP. Playwright/Chromium (ra-browser) passes
-- the CF fingerprint check. Same fix as Emerald (applied at launch) and ACS (0028).
UPDATE products SET ra_waf_browser = 1 WHERE slug = 'cab-abstracts';
