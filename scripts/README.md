# scripts/

## cleanup-r2-orphans.mjs

One-shot tool that finds R2 objects under `avatars/`,
`institution-logos/`, and `announcement-covers/` that are no longer
referenced by any row in D1 (`users.avatar_url`,
`institutions.logo_url`, `announcements.cover_image_url`) and deletes
them.

The owner-aware delete/update handlers shipped in PR #4 prevent *new*
orphans; this script is for cleaning up everything that leaked out
before that.

### Scopes it will NOT touch

- `files/` — managed library uploads (`collection_files` lifecycle,
  handled by the existing admin tools).
- `ticket-attachments/` — per-ticket private files; keep forever
  alongside the ticket.

### What you need

1. An R2 API token with **Object Read & Write** permission on the
   target bucket (Cloudflare dashboard → R2 → Manage R2 API Tokens).
2. `CLOUDFLARE_ACCOUNT_ID` (visible in the Cloudflare dashboard URL
   or under "Account home").
3. `wrangler` authenticated (for D1 queries — the same
   `CLOUDFLARE_API_TOKEN` you added to GitHub Secrets works fine).

```bash
export CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxx
export R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxx
export R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxx   # for wrangler d1 execute
```

### Usage

```bash
# Dry-run, staging (default) — no changes
node scripts/cleanup-r2-orphans.mjs

# Delete for real, staging
node scripts/cleanup-r2-orphans.mjs --apply

# Production (read-only preview)
node scripts/cleanup-r2-orphans.mjs --env=production

# Production (actually delete)
node scripts/cleanup-r2-orphans.mjs --env=production --apply
```

Always run the dry-run first, review the list, then `--apply`.

### What it prints

```
R2 orphan scan — env=staging bucket=libedge-files-staging mode=dry-run

=== avatars/ ===
  D1 rows referencing prefix: 42
  R2 objects in bucket:       51
  orphans (in R2, not in D1): 9
  orphan total size:          2.4 MB
  first 10:
    avatars/1776850123-a81…
    …

=== summary ===
  total orphans found:  17
  total size:           4.8 MB
  dry-run only. Re-run with --apply to delete.
```

### Safety

- The script only lists **three prefixes**. A key like
  `ticket-attachments/…` or `files/hash…` will never be listed, let
  alone deleted.
- Matching is exact — a D1 URL containing `avatars/123.jpg` protects
  the R2 key `avatars/123.jpg` regardless of whether the URL uses
  `https://files.selmiye.com/…`, `/api/files/…`, or the R2 public
  development URL.
- No argument can redirect the script to a different bucket; both
  bucket and D1 DB are derived from `--env`.
