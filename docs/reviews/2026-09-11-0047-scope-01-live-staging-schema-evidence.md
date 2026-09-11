# 0047-SCOPE-01 — Live staging schema evidence for `user_notifications`

Status: `CONFIRMED LIVE SCHEMA DIVERGENCE / FK CASCADE ABSENT / STAGING EXECUTION BLOCKED`

Date: 2026-09-11

## Purpose

Record the read-only live staging D1 evidence required by the 0047-SCOPE-01 follow-up plan.

No application data was written or deleted by this inspection.

## Inspection run

Workflow run:

`34601127734`

Head commit:

`28baff26c852a0eb377dd9e2599c0f19f559e3b3`

Target database:

- name: `libedge-db`
- id: `207d80d6-7e6b-4e10-aacf-b218970dbaf8`
- environment: `staging`

The successful inspection executed only read-only statements:

```sql
PRAGMA table_info(user_notifications);
PRAGMA foreign_key_list(user_notifications);
PRAGMA index_list(user_notifications);
SELECT name, sql
FROM sqlite_master
WHERE type='index' AND tbl_name='user_notifications'
ORDER BY name;
```

## Live results

### Table shape

`PRAGMA table_info(user_notifications)` confirmed the expected columns:

- `id` INTEGER PRIMARY KEY
- `user_id` INTEGER NOT NULL
- `type` TEXT NOT NULL DEFAULT 'info'
- `title` TEXT NOT NULL
- `body` TEXT
- `ref_id` INTEGER
- `ref_type` TEXT
- `is_read` INTEGER NOT NULL DEFAULT 0
- `created_at` TEXT NOT NULL DEFAULT datetime('now')

### Foreign keys

`PRAGMA foreign_key_list(user_notifications)` returned:

```text
[]
```

Therefore the live staging table has **no foreign-key constraint** on `user_id` and no `ON DELETE CASCADE` behavior to rely on.

This materially diverges from the canonical migration file `migrations/0008_user_notifications.sql`, which declares:

```sql
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

### Indexes

Live staging contains both expected indexes:

- `idx_user_notifications_user`
- `idx_user_notifications_type`

The live SQL is:

```sql
CREATE INDEX idx_user_notifications_user ON user_notifications(user_id, is_read);
CREATE INDEX idx_user_notifications_type ON user_notifications(type);
```

Therefore deletion by `user_id` has an appropriate supporting index.

## Conclusion

The earlier static hypothesis that `user_notifications` was already covered by live FK cascade is false for staging.

`0047-SCOPE-01` remains a real privacy/integrity gap in the live staging schema.

Current status:

`OPEN / LIVE FK CASCADE ABSENT / EXPLICIT DELETION POLICY REQUIRED / BLOCKS CONTROLLED STAGING DELETION`

The existing controlled staging deletion packet must remain blocked.

## Migration-history implication

Do not rewrite already-applied migration `0008` or `0047` in place.

The next step is to return this unexpected schema fact for review, then prepare a separately reviewed forward migration proposal that makes the live deletion policy explicit. The previously discussed natural candidate remains a new trigger-replacement migration after fresh migration-number verification.

No migration SQL is authorized by this evidence record itself.

## One-time workflow cleanup

The temporary read-only inspection workflow was removed after the successful evidence capture.
