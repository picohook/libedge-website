# Production Migration Plan

Bu belge güncel production migration guardrail notudur. Eski RA rollout ayrıntıları
`archive-staging-before-ra-cleanup-2026-09-06` arşivinde saklanmıştır.

## Durum

- Production D1 migration geçmişinde eski RA tabloları/kolonları bulunabilir.
- Güncel uygulama kodu RA route, proxy Worker, egress agent veya browser servis kullanmaz.
- Migration geçmişi production veri kaybı riskini önlemek için bu temizlikte silinmedi.

## Guardrails

1. Production migration apply öncesi mutlaka `migrations list` çıktısı alınır.
2. `ALTER TABLE ... ADD COLUMN` migration'ları non-idempotent kabul edilir.
3. Veri değiştiren seed/update migration'larından önce ilgili tablolar snapshot alınır.
4. D1 rollback genellikle forward-fix veya yedekten restore gerektirir; kolon/tablo silme rutin rollback değildir.
5. Worker/Pages deploy rollback'i Cloudflare deployment rollback üzerinden yapılır.

## Preflight

```powershell
npx wrangler d1 migrations list libedge-db-production --remote --env production
npx wrangler d1 execute libedge-db-production --remote --env production --command "PRAGMA table_info(products);"
npx wrangler d1 execute libedge-db-production --remote --env production --command "PRAGMA table_info(users);"
```

## Deploy Sırası

1. Staging migration ve backend deploy.
2. Staging smoke test: login, profil, ürün erişim linkleri, admin ürün/abonelik, dosya, duyuru, destek.
3. Production migration apply.
4. Production backend deploy.
5. Production Pages deploy.
6. Production smoke test.

## Smoke Test

- Login/logout ve refresh token yenileme çalışır.
- Profil abonelik kartları doğrudan/kurumsal/SSO erişim URL'lerini açar.
- Admin ürün CRUD, abonelik CRUD ve kurum listesi açılır.
- Dosya yükleme/paylaşım ve duyuru akışları çalışır.
- Destek talepleri listelenir ve yanıtlanır.