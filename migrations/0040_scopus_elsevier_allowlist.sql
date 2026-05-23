-- Scopus runs on Elsevier infrastructure and redirects/loads assets across
-- several Elsevier hosts. Set a valid JSON allowlist explicitly; older staging
-- rows may contain a non-JSON bracketed list from manual edits.

UPDATE products
SET ra_host_allowlist_json =
  '["www.scopus.com","scopus.com","www2.scopus.com","components.scopus.com","rum.scopus.com","ct.prod.getft.io","id.elsevier.com","www.elsevier.com","linkinghub.elsevier.com","www.sciencedirect.com","sciencedirect.com","sciverse-shindig.elsevier.com","ars.els-cdn.com","*.els-cdn.com"]'
WHERE slug = 'scopus';
