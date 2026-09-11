# 0047-SCOPE-01 — `user_notifications` deletion-scope review

Status: `OPEN / LIVE FK CASCADE ABSENT / EXPLICIT DELETION POLICY REQUIRED / BLOCKS STAGING EXECUTION`

Date: 2026-09-11

## Original finding

The controlled 0047 staging-deletion packet accurately covered all 29 tables explicitly touched by `trg_users_privacy_cleanup`, while a systematic runtime-DDL scan identified an additional active user-scoped table not named in the trigger: `user_notifications`.

The application actively inserts per-user rows containing notification title/body content, so the table must be part of the account-deletion privacy surface.

## Static repository evidence

Canonical migration `migrations/0008_user_notifications.sql` declares:

```sql
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

and creates:

```sql
CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON user_notifications(user_id, is_read);
```

This initially suggested that the table might already be covered by schema-level FK cascade.

## Live staging evidence — decisive result

A read-only inspection of the actual remote staging D1 database was executed in workflow run:

`34601127734`

against:

- database name: `libedge-db`
- database id: `207d80d6-7e6b-4e10-aacf-b218970dbaf8`

The live results were:

### Table columns

`PRAGMA table_info(user_notifications)` confirmed the expected column shape.

### Foreign keys

`PRAGMA foreign_key_list(user_notifications)` returned an empty result set:

```text
[]
```

Therefore the live staging table has **no foreign-key constraint** on `user_id` and no `ON DELETE CASCADE` behavior to rely on.

### Indexes

Live staging contains:

- `idx_user_notifications_user(user_id, is_read)`
- `idx_user_notifications_type(type)`

So an explicit delete by `user_id` is index-supported.

## Triage decision

The static cascade hypothesis is rejected for live staging.

Current finding state:

`OPEN / LIVE FK CASCADE ABSENT / EXPLICIT DELETION POLICY REQUIRED / BLOCKS STAGING EXECUTION`.

`user_notifications` is an active per-user delivery table. Its expected privacy disposition remains:

`DELETE with the account`.

Because the live staging schema does not supply the canonical cascade, the existing 0047 trigger leaves this domain uncovered.

## Migration-history rule

Do not rewrite already-applied migration `0008` or `0047` in place.

The schema divergence must be addressed through a separately reviewed forward migration proposal after migration-number verification.

The previously discussed semantic trigger action remains the narrow expected policy:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

No migration SQL is authorized by this triage record itself.

## Controlled packet effect

The controlled staging deletion packet remains **BLOCKED BEFORE EXECUTION**.

The eventual deletion-policy surface is 30 domains:

- 29 current trigger-touched domains;
- `user_notifications` as the newly confirmed uncovered domain requiring an explicit forward-policy fix.

No synthetic account may be created, no fixture may be seeded, and no deletion may be run until the forward migration proposal and amended execution packet are independently reviewed and accepted.

## Production / D-016 boundary

Unchanged:

- no production migration is authorized;
- production 0042-0048 backlog remains STOPPED;
- D-016 Track B remains STOPPED;
- semantic-primary remains OFF;
- this finding remains outside D-016.

Supporting live evidence:

`docs/reviews/2026-09-11-0047-scope-01-live-staging-schema-evidence.md`
