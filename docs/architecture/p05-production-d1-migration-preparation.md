# P0.5 Production Retrieval — Production D1 Telemetry Migration Preparation

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Prepare a migration-first production D1 execution proposal for the already-reviewed `research_telemetry_counters` schema without applying any production migration and without enabling semantic-primary.

This document is planning-only.

## Current production state

Production semantic-primary remains:

`RESEARCH_SEMANTIC_PRIMARY_ENABLED = "false"`

Current production D1 binding in `wrangler.toml`:

- binding: `DB`
- database_name: `libedge-db-production`
- database_id: `64e57edf-8163-4495-8874-fec00485b2ff`

No production D1 migration is authorized by this record.

## Intended migration

`migrations/0048_research_telemetry_counters.sql`

Current staging-branch blob SHA:

`6bab3ae040f48781456792937d5a826d0d231d24`

Exact SQL:

```sql
-- Exact aggregate research telemetry counters.
-- Stores only allowlisted metric names, UTC date buckets and numeric aggregate values.
-- No query/user/topic/result content is permitted in this table.

CREATE TABLE IF NOT EXISTS research_telemetry_counters (
  date_utc TEXT NOT NULL,
  metric TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date_utc, metric)
);
```

This is the same migration previously reviewed and applied successfully to staging.

## Mandatory pre-apply sequence

Before any production apply command may be authorized:

1. confirm production semantic-primary is still `false` from fresh repository/config state;
2. independently confirm the intended production D1 binding/name/id;
3. re-fetch `0048_research_telemetry_counters.sql` and verify it has not changed from the reviewed migration;
4. run a **read-only pending migration list** against the production D1 database;
5. compare the pending list with the expected state;
6. if any unexpected pending migration appears in addition to the intended telemetry migration, classify **STOP — DO NOT APPLY** and return to review;
7. document the exact production apply command and verification commands before execution;
8. verify that no semantic-primary flag change is included in the migration commit/workflow/action.

## Read-only production inspection — completed

Inspection run:

`34583816393`

Only the read-only command below was executed:

`npx wrangler d1 migrations list DB --env production --remote`

Observed production pending migrations:

1. `0042_tunnel_alert_tracking.sql`
2. `0043_products_ra_cookie_mode.sql`
3. `0044_wiley_stable_host.sql`
4. `0045_add_clinicalkey_uptodate.sql`
5. `0046_add_ai_product_cards.sql`
6. `0047_user_deletion_integrity.sql`
7. `0048_research_telemetry_counters.sql`

This satisfies the hard-STOP condition in step 6 above.

Current classification:

`STOP — DO NOT APPLY PRODUCTION D1 MIGRATIONS`.

The earlier backlog is outside D-016 and is recorded separately in:

`docs/reviews/2026-09-11-production-d1-pending-migration-audit.md`

No bulk application of `0042`-`0047` is authorized merely to reach `0048`.

## Recovery expectations

The intended `0048` migration is additive (`CREATE TABLE IF NOT EXISTS`) and does not alter existing application tables.

However, recovery planning for `0048` is not currently actionable because production migration execution is blocked upstream by `0042`-`0047`.

If Track B later resumes:

- do not attempt an automatic destructive rollback;
- if apply fails, stop and inspect the migration state before any retry;
- if the table is created but later rollout is not authorized, leave the unused table in place pending a separately reviewed cleanup decision rather than issuing an ad-hoc DROP in production;
- semantic-primary remains OFF regardless of migration outcome.

## Post-apply verification — only after separate execution authorization

A future separately authorized production migration would verify only:

1. migration command completed successfully;
2. `research_telemetry_counters` exists in the intended production D1 database;
3. expected columns are present: `date_utc`, `metric`, `value`, `updated_at`;
4. composite primary key is `(date_utc, metric)`;
5. production semantic-primary remains `false`;
6. no semantic provider call is made as part of migration verification.

## Hard boundaries

Migration success would **not** authorize:

- production semantic-primary ON;
- broad production rollout;
- another semantic retry;
- relevance retuning;
- H/RRF;
- Vectorize;
- changing the `<=0.5 req/s` capacity guardrail.

## Current blocker to execution packet

Track B is paused until the separate production D1 pending-migration audit has explicit dispositions for `0042`-`0047`.

Only after that backlog is resolved may Track B obtain a fresh read-only production pending-migration list and return for a new execution review.
