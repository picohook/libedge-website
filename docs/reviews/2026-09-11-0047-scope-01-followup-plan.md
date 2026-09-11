# 0047-SCOPE-01 — Follow-up plan before controlled staging deletion

Status: `LIVE SCHEMA DIVERGENCE CONFIRMED / RETURN TO MIGRATION DESIGN REVIEW / NO APPLY / NO LIVE DELETION`

Date: 2026-09-11

## Decision

Live staging read-only evidence has now resolved the earlier uncertainty.

Canonical migration `0008_user_notifications.sql` declares `user_id -> users(id) ON DELETE CASCADE`, but the actual staging D1 table does **not** contain any foreign-key constraint.

Therefore `user_notifications` is not currently protected by schema-level cascade in staging and remains outside the explicit 0047 trigger cleanup.

## Decisive live evidence

Workflow run:

`34601127734`

Remote staging D1:

- `libedge-db`
- `207d80d6-7e6b-4e10-aacf-b218970dbaf8`

Results:

- expected columns present;
- `PRAGMA foreign_key_list(user_notifications)` -> empty result set;
- `idx_user_notifications_user(user_id, is_read)` present;
- `idx_user_notifications_type(type)` present.

Canonical evidence record:

`docs/reviews/2026-09-11-0047-scope-01-live-staging-schema-evidence.md`

## Privacy policy

Expected disposition remains:

`DELETE user_notifications rows with the deleted account`.

The narrow intended trigger semantics remain:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

The supporting live index means this predicate is index-supported.

## Migration strategy

Do not mutate migration `0008` or `0047` in place.

The next step is now to prepare a **forward migration proposal** that makes the live deletion policy explicit, after freshly verifying the migration directory / next migration number.

Because `0048_research_telemetry_counters.sql` currently exists, `0049` remains the natural candidate subject to fresh verification.

The proposal should replace/recreate `trg_users_privacy_cleanup` using the reviewed 0047 body plus the explicit `user_notifications` delete.

Any migration SQL must be independently byte-reviewed before staging apply.

## Required inventory check

Before finalizing the migration proposal, re-run the active user-linked table inventory and distinguish:

- explicit trigger cleanup;
- verified FK cascade;
- application-level cleanup;
- uncovered direct user links.

If another uncovered active user-linked domain appears, STOP and return to scope review rather than preparing a piecemeal migration.

## Controlled staging packet

The controlled deletion packet remains blocked.

After an independently accepted forward migration is applied to staging under separate authorization, the execution packet must cover 30 deletion-policy domains, including:

- target `user_notifications` row(s) seeded;
- target rows deleted;
- `U_CONTROL` rows unchanged;
- exact PRE/POST counts;
- fresh trigger SQL evidence matching the accepted forward migration.

## Existing stress fixture

Do not change the reviewed stress pair silently:

- `25,000 ai_usage_logs`;
- `25,000 notifications`.

The live `user_notifications` index does not itself justify changing the predeclared stress pair.

## Authorization boundary

This plan authorizes only:

- repository/code inventory work;
- preparation of a forward migration proposal;
- independent review preparation.

It does NOT authorize:

- applying any migration to staging or production;
- creating staging disposable accounts;
- seeding fixtures;
- deleting staging users;
- resuming D-016 Track B;
- enabling semantic-primary.
