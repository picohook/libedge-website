-- 0039_sciencedirect_els_cdn_allowlist.sql
-- ra-egress consumes the dynamic allowlist as exact hosts, so keep the
-- ScienceDirect cover-image CDN host explicit in addition to *.els-cdn.com.

UPDATE products
SET ra_host_allowlist_json = CASE
  WHEN ra_host_allowlist_json IS NULL OR TRIM(ra_host_allowlist_json) = '' THEN
    '["www.sciencedirect.com","sciencedirect.com","ars.els-cdn.com","*.els-cdn.com"]'
  WHEN INSTR(ra_host_allowlist_json, '"ars.els-cdn.com"') > 0 THEN
    ra_host_allowlist_json
  WHEN INSTR(ra_host_allowlist_json, '"*.els-cdn.com"') > 0 THEN
    REPLACE(ra_host_allowlist_json, '"*.els-cdn.com"', '"ars.els-cdn.com","*.els-cdn.com"')
  ELSE
    REPLACE(ra_host_allowlist_json, ']', ',"ars.els-cdn.com"]')
END
WHERE slug = 'sciencedirect';
