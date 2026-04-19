# Environment Notes

## Current Environment Map

### Staging
- Pages: `https://libedge-new.pages.dev`
- Worker: `https://form-handler-staging.agursel.workers.dev`
- D1: `libedge-db`
- R2: `libedge-files-staging`
- KV: `556d17f88a7a48e381e5ffed1d150536`

### Production
- Pages: `https://libedge-website.pages.dev`
- Worker: `https://form-handler-prod.agursel.workers.dev`
- D1: `libedge-db-production`
- R2: `libedge-files`
- KV: `5640d9b898c54a96bdd9e361e1c6f593`

## What Was Changed
- `production` now uses its own D1 database.
- Referenced files were copied from `libedge-files-staging` to `libedge-files`.
- Pages projects were pointed to explicit worker URLs with `WORKER_BASE_URL`.
- Silent Pages fallback to `form-handler.agursel.workers.dev` was removed.

## Known Gaps
- 4 referenced files were missing in the staging bucket too, so they could not be copied to production:
  - `tickets/2/admin-1775934380179.png`
  - `uploads/2/1775480003991-d5o2478ihql.pdf`
  - `uploads/2/1775480923644-jfh88p8y32m.pdf`
  - `uploads/2/1775481183775-lirsrb9knwj.pdf`
- See: [backups/r2-copy-failed.txt](/abs/path/c:/Users/OWNER/Documents/GitHub/libedge-website/backups/r2-copy-failed.txt)

## Smoke Checklist

### Production
Open `https://libedge-website.pages.dev`
- Homepage loads
- Login works
- Admin opens
- `Ayarlar` tab shows `production`
- `Kurumlar` logos load
- Profile avatar and institution logo load
- Announcements page opens
- A sample file/download link opens

### Staging
Open `https://libedge-new.pages.dev`
- Homepage loads
- Login works
- Admin opens
- `Ayarlar` tab shows `staging`
- `Kurumlar` logos load
- Profile avatar and institution logo load
- Announcements page opens
- A sample file/download link opens

## Important Files
- [wrangler.toml](/abs/path/c:/Users/OWNER/Documents/GitHub/libedge-website/wrangler.toml)
- [functions/api/[[path]].js](</abs/path/c:/Users/OWNER/Documents/GitHub/libedge-website/functions/api/[[path]].js>)
- [scripts/copy-r2-objects.ps1](/abs/path/c:/Users/OWNER/Documents/GitHub/libedge-website/scripts/copy-r2-objects.ps1)
