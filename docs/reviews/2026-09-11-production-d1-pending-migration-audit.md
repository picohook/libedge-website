# Production D1 Pending Migration Audit

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Record the out-of-scope production schema drift discovered while preparing D-016 Track B, without folding unrelated migrations into the semantic-retrieval workstream and without authorizing any production migration apply.

This audit is deliberately separate from D-016. D-016 Track B remains blocked until this production migration backlog is understood and dispositioned.

## Trigger

Read-only production D1 inspection run:

`34583816393`

Target production binding:

- binding: `DB`
- database_name: `libedge-db-production`
- database_id: `64e57edf-8163-4495-8874-fec00485b2ff`

The run executed only:

`npx wrangler d1 migrations list DB --env production --remote`

No migration apply command was executed.

## Observed pending migrations

Production reported the following migrations as pending:

1. `0042_tunnel_alert_tracking.sql`
2. `0043_products_ra_cookie_mode.sql`
3. `0044_wiley_stable_host.sql`
4. `0045_add_clinicalkey_uptodate.sql`
5. `0046_add_ai_product_cards.sql`
6. `0047_user_deletion_integrity.sql`
7. `0048_research_telemetry_counters.sql`

Because `0042`-`0047` were not part of the D-016 telemetry migration proposal, the locked hard-STOP condition fired.

## Overall conclusion

`STOP — DO NOT APPLY PRODUCTION D1 MIGRATIONS.`

The production database is six migrations behind the intended D-016 telemetry migration. These migrations belong to unrelated feature/privacy workstreams and must not be bulk-applied merely to unblock `0048`.

No assumption is made that the six earlier migrations are bad. The issue is that their production applicability, feature state, data effects, and operational context have not yet been independently reviewed in this workstream.

## Migration-by-migration inspection

### 0042 — tunnel alert tracking

File:

`migrations/0042_tunnel_alert_tracking.sql`

Introduced by commit:

`e39b7c6ad9fce876acf64d5d3140322ae7fcf2d7` — 2026-05-23 — `feat(infra): Infra-02 — tunnel down email alerts (Resend)`.

SQL effect:

```sql
ALTER TABLE institution_ra_settings
  ADD COLUMN tunnel_alert_sent_at INTEGER;
```

Nature:

- additive schema change;
- directly coupled to tunnel-heartbeat / tunnel-alert runtime logic;
- the introducing commit explicitly stated that staging had the migration and production was pending.

Risk/unknowns before production apply:

- confirm the production Worker version actually contains or expects the corresponding tunnel-alert logic;
- confirm production `institution_ra_settings` does not already contain an equivalent manually-created column outside migration tracking;
- confirm required alert secrets/operational policy if the runtime feature is intended to be active.

Preliminary disposition: `REQUIRES FEATURE-STATE REVIEW`.

### 0043 — per-publisher RA cookie mode

File:

`migrations/0043_products_ra_cookie_mode.sql`

Introduced by commit:

`0c1b7e2ea7d6316ad37d0096f686f826dcd24963` — 2026-05-24 — `feat(proxy): per-publisher cookie mode — 'scoped' (default) vs 'host' (vetis-style)`.

SQL effect:

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ra_cookie_mode TEXT NOT NULL DEFAULT 'scoped';
```

Nature:

- additive schema change with a backward-compatible default;
- coupled to remote-access proxy cookie behavior;
- introducing commit states staging application and Wiley host-mode testing.

Risk/unknowns before production apply:

- confirm production proxy runtime version and whether it reads this column;
- confirm default `scoped` semantics are desired for all existing production products;
- confirm there is no manual schema drift.

Preliminary disposition: `REQUIRES FEATURE-STATE REVIEW`.

### 0044 — Wiley stable-host delivery mode

File:

`migrations/0044_wiley_stable_host.sql`

Introduced by commit:

`68f3c118f1a2cda891f77b40d97dde9eb73e5505` — 2026-05-25 — `feat(d1): Wiley'i stable_host_proxy moda al — vetis-style browser cache shared`.

SQL effect:

```sql
UPDATE products
SET ra_delivery_mode = 'stable_host_proxy'
WHERE slug = 'wiley';
```

Nature:

- not merely schema-additive;
- directly mutates production product behavior for Wiley;
- introducing commit explicitly says staging already had the change and production would require the migration.

Risk/unknowns before production apply:

- confirm Wiley remote-access behavior is intended to switch in production now;
- confirm production runtime supports `stable_host_proxy` and all related host/cookie assumptions;
- confirm rollback/observability plan for live Wiley access.

Preliminary disposition: `BEHAVIOR-CHANGING — SEPARATE PRODUCTION REVIEW REQUIRED`.

### 0045 — ClinicalKey and UpToDate product/RA records

File:

`migrations/0045_add_clinicalkey_uptodate.sql`

Introduced by commit:

`7bd8d10042d55b5cd42878f662fe34e27b611f71` — 2026-05-29 — `feat(products): add ClinicalKey + UpToDate + open egress host list`.

SQL effect:

- inserts or updates `clinicalkey` and `uptodate` product rows;
- marks them visible/RA-enabled;
- configures origins, landing paths, tunnel requirements and egress allowlists.

Nature:

- user-visible/catalog data change;
- remote-access/security-adjacent configuration change;
- introducing commit also changed egress-host-list runtime behavior outside the migration itself.

Risk/unknowns before production apply:

- confirm these products are intended to exist/be visible in production now;
- confirm the corresponding runtime change is deployed in production;
- confirm subscription/access policy and RA egress configuration are appropriate for production.

Preliminary disposition: `BEHAVIOR/ACCESS-CONFIG CHANGE — SEPARATE PRODUCTION REVIEW REQUIRED`.

### 0046 — AI product cards

File:

`migrations/0046_add_ai_product_cards.sql`

File history includes:

- `03bba65f0ad49128c784b706235cb764649a63b7` — 2026-09-06 — `Use provided logos for new AI products`;
- `cb4461e1fcdda70e4cf4181a8e6ab3afcb36303e` — 2026-09-06 — `Show new AI products in catalog recommendations`.

SQL effect:

- inserts or updates `EvidenceMD`, `Grammarly`, and `Superhuman Suite` product rows;
- sets catalog visibility, display order, descriptions and asset references.

Nature:

- directly user-visible catalog/content change;
- not a schema-only prerequisite.

Risk/unknowns before production apply:

- confirm product/content approval for production;
- confirm referenced assets are available in production;
- confirm desired visibility and display ordering.

Preliminary disposition: `PRODUCT-SCOPE CHANGE — SEPARATE PRODUCTION REVIEW REQUIRED`.

### 0047 — user deletion privacy/integrity policy

File:

`migrations/0047_user_deletion_integrity.sql`

Recent history:

- `9b00628fe9fa1d6ab5fccae331671d243a5c037e` — 2026-09-07 — `Harden user deletion data integrity`;
- `f54501106f427ab42bfc80d24016904636ff5572` — 2026-09-07 — `Complete user deletion privacy policy`.

SQL effect:

- creates `privacy_r2_purge_queue` and supporting index;
- replaces/creates a `BEFORE DELETE ON users` trigger;
- the trigger deletes, anonymizes or unlinks records across authentication, subscriptions, notifications, sharing, support, AI usage, affiliate, forms, files, announcements and audit-log tables;
- queues attachment URLs for later R2 deletion.

Nature:

- privacy/security critical;
- behavior-changing database trigger;
- potentially destructive by design when a user row is deleted;
- touches a large set of tables and depends on their production schema state.

Risk/unknowns before production apply:

- verify every referenced table/column exists with the expected production schema;
- independently review deletion semantics and retention/legal requirements;
- verify Worker-side R2 purge processing is present and production-ready;
- verify deletion flows/tests against a production-equivalent schema before apply.

Preliminary disposition: `HIGH-RISK PRIVACY/INTEGRITY MIGRATION — DEDICATED REVIEW REQUIRED`.

## Important sequencing implication

The normal Wrangler/D1 migration mechanism sees `0042` through `0048` as a sequential pending backlog. Therefore `0048` must not be treated as an isolated routine apply while `0042`-`0047` remain unresolved.

This audit does not authorize manual out-of-order execution of `0048`, editing D1 migration bookkeeping, or marking older migrations as applied without evidence.

## Required next work outside D-016

For each of `0042`-`0047`, establish:

1. owning feature/privacy context;
2. current production runtime compatibility;
3. current production schema/data preconditions;
4. whether production rollout is still desired;
5. migration-specific verification and rollback/recovery expectations;
6. reviewer/owner approval where appropriate.

Only after the earlier backlog has an explicit disposition may D-016 Track B return with a fresh read-only pending-migration list.

## D-016 boundary

D-016 itself remains unchanged:

- production semantic-primary stays OFF;
- `0048_research_telemetry_counters.sql` is still the intended telemetry migration;
- Track B is blocked by this unrelated production migration backlog;
- no production migration is authorized;
- no broad production rollout is authorized.
