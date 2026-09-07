# scripts/

## auth-smoke.mjs

End-to-end auth smoke check for staging or a dedicated test deployment.
It uses real HTTP requests but reads credentials only from environment
variables; do not commit test-user passwords.

Required:

```bash
export LIBEDGE_SMOKE_EMAIL=user@example.edu
export LIBEDGE_SMOKE_PASSWORD=...
```

Optional:

```bash
export LIBEDGE_SMOKE_BASE_URL=https://staging.libedge-website.pages.dev
export LIBEDGE_SMOKE_ORIGIN=https://staging.libedge-website.pages.dev
export LIBEDGE_SMOKE_ADMIN_EMAIL=admin@example.edu
export LIBEDGE_SMOKE_ADMIN_PASSWORD=...
```

Usage:

```bash
npm run smoke:auth
```

The script verifies login cookies, profile access, refresh rotation,
logout clearing, post-logout 401s, invalid refresh attempts, wrong
password rejection, normal-user admin denial, and admin products access
when admin credentials are provided.

## files-smoke.mjs

Live file and ticket attachment smoke check for staging or a dedicated
test deployment. It uses real HTTP requests and writes temporary smoke
objects to the target environment, then attempts to close the smoke
ticket and delete the managed file reference.

Required:

```bash
export LIBEDGE_SMOKE_EMAIL=user@example.edu
export LIBEDGE_SMOKE_PASSWORD=...
export LIBEDGE_SMOKE_ADMIN_EMAIL=admin@example.edu
export LIBEDGE_SMOKE_ADMIN_PASSWORD=...
```

Optional:

```bash
export LIBEDGE_SMOKE_BASE_URL=https://staging.libedge-website.pages.dev
export LIBEDGE_SMOKE_ORIGIN=https://staging.libedge-website.pages.dev
export LIBEDGE_SMOKE_OTHER_EMAIL=other-user@example.edu
export LIBEDGE_SMOKE_OTHER_PASSWORD=...
```

Usage:

```bash
npm run smoke:files
```

The script verifies managed upload, anonymous/user denial, admin
download, private no-store cache headers, ticket attachment creation,
anonymous denial, owner/admin download, and other-user denial when other
user credentials are provided. Ticket attachments must remain behind
`/api/files/ticket-attachments/...`; a public R2 URL is treated as a
failed smoke check.

## GitHub Actions staging smoke

The manual `Staging Smoke` workflow runs the same live smoke scripts
against staging without committing credentials. Add these secrets to the
`staging` environment or repository secrets:

```bash
LIBEDGE_SMOKE_EMAIL
LIBEDGE_SMOKE_PASSWORD
LIBEDGE_SMOKE_ADMIN_EMAIL
LIBEDGE_SMOKE_ADMIN_PASSWORD
```

Optional, for the other-user ticket attachment denial check:

```bash
LIBEDGE_SMOKE_OTHER_EMAIL
LIBEDGE_SMOKE_OTHER_PASSWORD
```

Then run **Actions -> Staging Smoke -> Run workflow**. The default target
is `https://staging.libedge-website.pages.dev`.

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
