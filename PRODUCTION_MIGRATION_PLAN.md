# Production Migration Plan - 2026-05-09

Purpose: bring `libedge-db-production` safely from the current production schema level to the staging-tested schema level without applying anything blindly.

## Completion Status (2026-05-19)

**COMPLETED.** All 16 pending migrations (`0020`–`0035`) applied to `libedge-db-production` on 2026-05-19. Migration `0036_enable_cabi_waf_browser.sql` applied to both staging and production on 2026-05-19 (sets `ra_waf_browser=1` for `cab-abstracts`). Main API Worker (`libedge-api-prod`) deployed to production.

Pre-apply fix: Migration `0018_ra_schema_complete.sql` had partially failed on production in a prior session. The three columns it should have added (`ra_delivery_mode`, `ra_requires_tunnel`, `ra_origin_landing_path`) were missing from the `products` table because earlier runtime guards had already added other columns in `0018`, causing SQLite to error mid-migration. These three columns were added manually via `ALTER TABLE products ADD COLUMN` before running `migrations apply`. The subsequent `migrations apply` completed cleanly with no conflicts.

Notable outcomes:
- `0024_seed_ekual_products.sql`: 26 EKUAL products inserted/updated.
- 9 new tables created: `admin_action_logs`, `ra_debug_events`, `ra_waf_clearance`, `ra_link_audit_findings`, `individual_tools`, `affiliate_clicks`, `user_profile_links`, `refresh_tokens`, `product_requests`, `ai_usage_logs`.
- Production Proxy Worker (`libedge-ra-proxy-prod`) deploy **deferred** — wildcard route conflict with staging, and `libedge.com` domain migration not yet done.

---

Status at time of writing (archived):

- Staging D1 (`libedge-db`): last verified with no pending migrations before `0035_product_requests_ai_usage_logs.sql` was added.
- Production D1 (`libedge-db-production`): had migrations `0020` through `0035` pending (now applied).
- Production preflight schema queries could not be completed in this session because Wrangler remote D1 calls started returning Cloudflare auth token errors (`Failed to fetch auth token`).

## Guardrails

1. Do not run production `migrations apply` until the preflight section is complete.
2. Treat `ALTER TABLE ... ADD COLUMN` migrations as non-idempotent. If a column already exists from runtime guards/manual fixes, the migration can stop partway through.
3. Prefer schema before Worker deploy for features that require tables/columns. The current staging Worker has a login fallback, but production should still receive `0033_refresh_tokens.sql` before relying on DB-backed refresh token replay protection.
4. D1 schema rollback is not like Worker rollback. If a migration adds schema/data, rollback usually means a new forward migration or manual repair.

## Pending Migrations

| Migration | Effect | Risk | Preflight |
|---|---|---|---|
| `0020_product_presentation.sql` | Adds product logo/card visibility/description/order columns; adds `idx_products_card_order`. | Medium: many `ALTER TABLE ADD COLUMN`; fails if columns already exist. | `PRAGMA table_info(products);` and `PRAGMA index_list(products);` |
| `0021_product_card_design.sql` | Adds product card background/color columns. | Medium: `ALTER TABLE ADD COLUMN`. | `PRAGMA table_info(products);` |
| `0022_admin_action_logs.sql` | Creates `admin_action_logs` and index. | Low: `CREATE TABLE IF NOT EXISTS`. | Check `sqlite_master` for table/index. |
| `0023_product_access_tags.sql` | Adds `products.access_tags_json`. | Medium: `ALTER TABLE ADD COLUMN`. | `PRAGMA table_info(products);` |
| `0024_seed_ekual_products.sql` | Inserts/updates EKUAL product catalog and RA config fields. | High: data-changing seed/update; depends on product RA columns already existing. | Verify `products` has `ra_enabled`, `ra_delivery_mode`, `ra_origin_host`, `ra_origin_landing_path`, `ra_requires_tunnel`, `ra_host_allowlist_json`, `access_tags_json`. Snapshot affected product rows first. |
| `0025_ra_stable_host_prep.sql` | Updates SciFinder allowlist and creates `ra_debug_events`. | Medium: data update + debug table. | Check target product slug exists; check `ra_debug_events`. |
| `0026_ra_waf_clearance.sql` | Creates `ra_waf_clearance`. | Low: additive table/index. | Check `sqlite_master`. |
| `0027_ra_waf_browser.sql` | Adds `products.ra_waf_browser`. | Medium: `ALTER TABLE ADD COLUMN`. | `PRAGMA table_info(products);` |
| `0028_enable_acs_waf_browser.sql` | Sets `ra_waf_browser=1` for `acs`. | Medium: data update; assumes `ra_waf_browser` exists. | Check `acs` product row exists and current RA config. |
| `0029_ra_link_audit.sql` | Creates `ra_link_audit_findings` and index. | Low: additive table/index. | Check `sqlite_master`. |
| `0030_individual_tools_affiliate_clicks.sql` | Creates `individual_tools`, `affiliate_clicks`, index; seeds tool rows. | Medium: additive tables + seed data. | Check tables absent/present; if present, inspect rows before apply. |
| `0031_products_brochure_url.sql` | Adds `products.brochure_url`. | Medium: `ALTER TABLE ADD COLUMN`. | `PRAGMA table_info(products);` |
| `0032_user_profile_links.sql` | Creates social profile links table and index. | Low: additive table/index. | Check `sqlite_master`. |
| `0033_refresh_tokens.sql` | Creates DB-backed refresh-token replay table and index. | High security dependency; low schema risk. Needed for production replay protection. | Check `sqlite_master`; smoke login/refresh/replay after apply. |
| `0034_users_lower_email_index.sql` | Adds case-insensitive email index. | Low. | `PRAGMA index_list(users);` |
| `0035_product_requests_ai_usage_logs.sql` | Creates privacy-first product request and AI usage log tables plus indexes. | Low: additive tables/indexes; no existing rows updated. | Check `sqlite_master`; inspect table info/indexes after apply. |

## Required Preflight Commands

Run these before applying production migrations:

```powershell
npx wrangler d1 migrations list libedge-db-production --remote --env production

npx wrangler d1 execute libedge-db-production --remote --env production --command "PRAGMA table_info(products);"
npx wrangler d1 execute libedge-db-production --remote --env production --command "PRAGMA index_list(products);"
npx wrangler d1 execute libedge-db-production --remote --env production --command "PRAGMA index_list(users);"
npx wrangler d1 execute libedge-db-production --remote --env production --command "SELECT name, type FROM sqlite_master WHERE name IN ('admin_action_logs','ra_debug_events','ra_waf_clearance','ra_link_audit_findings','individual_tools','affiliate_clicks','user_profile_links','refresh_tokens','product_requests','ai_usage_logs');"
```

Snapshot data touched by seed/update migrations:

```powershell
npx wrangler d1 execute libedge-db-production --remote --env production --command "SELECT slug, name, access_tags_json, ra_enabled, ra_delivery_mode, ra_origin_host, ra_origin_landing_path, ra_requires_tunnel, ra_host_allowlist_json FROM products WHERE slug IN ('acs','cas-scifinder-discovery-platform','annual-reviews','cab-abstracts','emerald-premier','oxford-university-press','wiley');"
```

If any pending `ALTER TABLE ADD COLUMN` target column already exists, stop and create a compatibility plan instead of running the migration chain as-is.

## Apply Order

Preferred order after successful preflight:

1. Apply D1 migrations to production.
2. Deploy Main API Worker to production.
3. Deploy RA Proxy Worker to production only if RA-related migrations and worker changes are meant to go live together.
4. Run smoke tests.

Command, only after preflight approval:

```powershell
npx wrangler d1 migrations apply libedge-db-production --remote --env production
npx wrangler deploy --env production
```

## Smoke Tests

Auth:

1. `GET https://libedge-api-prod.agursel.workers.dev/api/auth/status` returns 200.
2. Wrong-password login returns 401, not 500.
3. Successful login returns 200 and sets auth/refresh cookies.
4. `GET /api/user/profile` succeeds after login.
5. `POST /api/auth/refresh` succeeds once with current refresh token.
6. Reusing the old refresh token returns 401 and revokes the family.
7. Logout returns 200 and subsequent profile request returns 401.

Products/admin:

1. Product list loads.
2. Admin product edit reads/writes logo/card/access fields.
3. EKUAL-tagged products render as expected.
4. Individual tools endpoint works.
5. Product request table exists and accepts only minimal request metadata.
6. AI usage log table exists and does not store raw prompt/output text.

RA:

1. `/api/ra/issue-token` works for a known active subscription.
2. Proxy redirect opens for a path-proxy product.
3. Session-host proxy product reaches landing page.
4. Admin RA overview/log views still load.

## Rollback Notes

- Worker rollback: use Cloudflare deployment/version rollback if a Worker deploy fails after migrations.
- D1 rollback: do not delete columns/tables casually. Prefer forward-fix migrations or restoring from a known D1 backup/export if a destructive data issue is discovered.
- Seed rollback: `0024_seed_ekual_products.sql` updates product rows. Keep the preflight snapshot before apply so affected rows can be manually restored if needed.

## Current Recommendation

Do not apply production migrations in the same session unless:

1. Wrangler auth is healthy.
2. Preflight schema queries are captured.
3. The `ALTER TABLE` duplicate-column risk is cleared.
4. A human confirms the production window.
