# 0047-SCOPE-01 — Follow-up plan before controlled staging deletion

Status: `READ-ONLY LIVE SCHEMA CONFIRMATION PENDING / NO MIGRATION APPLY / NO LIVE DELETION AUTHORIZED`

Date: 2026-09-11

## Corrected decision

`user_notifications` remains part of the user-deletion privacy surface, but repository schema inspection found that canonical migration `0008_user_notifications.sql` already defines:

```sql
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

with:

```sql
idx_user_notifications_user(user_id, is_read)
```

Therefore a new trigger-replacement migration is **not** the default next step. It is needed only if fresh live staging schema evidence shows material divergence from migration 0008.

## Why the original scope concern still matters

`user_notifications` is an active per-user delivery table containing a required `user_id` and notification title/body content. It must disappear with the deleted account.

The important correction is that deletion may be provided by the existing schema-level FK cascade rather than by an explicit statement inside `trg_users_privacy_cleanup`.

## Required live read-only staging prechecks

Before any fixture or account is created, obtain actual staging evidence for:

1. `PRAGMA table_info(user_notifications)`;
2. `PRAGMA foreign_key_list(user_notifications)`;
3. `PRAGMA index_list(user_notifications)` and index details as needed;
4. FK target `users(id)` with `ON DELETE CASCADE`;
5. `idx_user_notifications_user` with `user_id` as leading column;
6. no material schema drift from migration 0008.

Any mismatch is a hard STOP and returns the finding for migration design/review.

## Application-path / retention result

Repository-level inspection confirms the active institution send-to-users path inserts per-user `user_notifications` rows.

No intentional retention requirement after account deletion was identified in this pass. Expected disposition is still `DELETE with account`.

## Migration strategy

Do not create migration 0049 unless live staging schema evidence demonstrates that the expected cascade is missing or otherwise unsafe.

Do not mutate migration 0047 or migration 0008 in place.

If staging matches migration 0008, no new migration is required for `0047-SCOPE-01`.

## Controlled staging packet amendment

Amend the packet to treat the deletion-policy surface as 30 domains:

- 29 trigger-touched domains;
- 1 FK-cascade domain: `user_notifications`.

Required additions:

- schema precheck includes live `user_notifications` FK/index evidence;
- target fixture includes at least one `user_notifications` row per target user;
- positive assertion: target rows disappear after deletion;
- negative assertion: `U_CONTROL` rows remain unchanged;
- PRE/POST evidence includes exact row counts;
- execution record states whether deletion occurred by confirmed FK cascade.

The trigger SQL itself remains the reviewed 0047 trigger if the live cascade is confirmed.

## Active user-linked inventory

Re-run the complete active user-linked table inventory before execution, distinguishing explicit trigger cleanup from schema-level cascades. A table absent from the trigger is not automatically a privacy omission if an independently verified FK cascade provides the intended deletion policy.

## Existing stress fixture

Do not change the reviewed stress pair silently:

- `25,000 ai_usage_logs`;
- `25,000 notifications`.

The canonical `user_notifications` index does not create a repository-level reason to add it as a third stress store.

## Timing-threshold sanity check

The existing `2.0 s` ordinary / `5.0 s` stress / `2.0 s` unrelated-write thresholds remain well below Cloudflare Worker platform execution ceilings. The actual browser/application caller must still be checked for a shorter explicit timeout or `AbortController` before execution.

## Authorization boundary

This plan authorizes only:

- read-only live staging schema confirmation;
- repository/code inventory work;
- amendment and independent review of the controlled staging packet.

It does NOT authorize:

- creation or application of migration 0049;
- applying any migration to staging or production;
- creating staging disposable accounts;
- seeding fixtures;
- deleting staging users;
- resuming D-016 Track B;
- enabling semantic-primary.

Supporting discovery:

`docs/reviews/2026-09-11-0047-scope-01-read-only-discovery.md`
