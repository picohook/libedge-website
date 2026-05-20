-- Nature Verify runs on verify.nature.com while the page calls /verify/status
-- from the proxied session host. Keep the host allowlisted for same-origin
-- proxy routing and text/runtime rewrites.
UPDATE products
SET ra_host_allowlist_json = CASE
  WHEN ra_host_allowlist_json IS NULL OR TRIM(ra_host_allowlist_json) = '' THEN
    '["www.nature.com","nature.com","verify.nature.com","idp.nature.com"]'
  WHEN INSTR(ra_host_allowlist_json, '"verify.nature.com"') > 0 THEN
    ra_host_allowlist_json
  WHEN INSTR(ra_host_allowlist_json, '"idp.nature.com"') > 0 THEN
    REPLACE(ra_host_allowlist_json, '"idp.nature.com"', '"verify.nature.com","idp.nature.com"')
  ELSE
    REPLACE(ra_host_allowlist_json, ']', ',"verify.nature.com"]')
END
WHERE slug = 'nature';
