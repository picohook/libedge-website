# Production Migration Plan

Bu belge LibEdge production geçişi için güncel guardrail ve operasyon planıdır.
Eski RA rollout ayrıntıları `archive-staging-before-ra-cleanup-2026-09-06`
arşivinde saklanmıştır.

## Güncel Durum — 7 Eylül 2026

- Aktif geliştirme hattı `staging` branch'idir; henüz freeze edilmemiştir.
- Staging Pages: `https://staging.libedge-website.pages.dev/`.
- Staging Worker: `libedge-api-staging`.
- Staging D1: `libedge-db`; 0046 ve 0047 migration'ları uygulanmıştır.
- Production D1: `libedge-db-production`; staging ile aynı migration seviyesinde olduğu varsayılmaz.
- Production deploy ve migration işlemleri manuel workflow + production environment üzerinden yapılır.
- Production'a bu stabilizasyon çalışması sırasında deploy veya migration yapılmamıştır.

## Kalıcı Guardrails

1. Production migration apply öncesi `.github/workflows/d1-migrations.yml` ile bekleyen migration listesi alınır.
2. Kritik `products` ve `users` şemaları preflight sırasında doğrulanır.
3. Migration apply öncesi D1 Time Travel rollback bookmark bilgisi alınır.
4. `ALTER TABLE ... ADD COLUMN` migration'ları non-idempotent kabul edilir.
5. Veri değiştiren seed/update migration'ları ayrıca incelenir; production verisi GitHub artifact olarak export edilmez.
6. Worker/Pages deploy rollback'i Cloudflare deployment rollback üzerinden yapılır.
7. Production Worker için `wrangler.toml` içindeki gerekli secret sözleşmesi deploy sırasında fail-closed uygulanır.
8. `.github/workflows/production-preflight.yml` production'a yazmadan D1, Time Travel, R2, KV, secret isimleri ve Wrangler config erişimini doğrular.

## Production Secret Sözleşmesi

Production Worker için en az şu secret/config değerleri beklenir:

- `JWT_SECRET`
- `RESEND_API_KEY`
- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`

Secret değerleri repoya veya workflow loglarına yazılmaz. GitHub/Cloudflare kontrollerinde yalnız varlık ve isim doğrulanır.

## Preflight

Tercih edilen yöntem GitHub Actions içindeki **Production Infrastructure Preflight** workflow'udur.
Manuel CLI karşılığı:

```powershell
npx wrangler d1 migrations list libedge-db-production --remote --env production
npx wrangler d1 execute libedge-db-production --remote --env production --command "PRAGMA table_info(products); PRAGMA table_info(users);"
npx wrangler d1 time-travel info libedge-db-production --env production
npx wrangler deploy --env production --dry-run
```

Preflight read-only olmalıdır; migration veya deploy işlemi yapmaz.

## Deploy Sırası

1. Staging kodu ve migration seviyesi doğrulanır.
2. Staging CI + frontend/auth/files smoke testleri yeşil olmalıdır.
3. Production Infrastructure Preflight çalıştırılır ve yeşil olmalıdır.
4. Production D1 migration listesi incelenir ve gerekli migration'lar uygulanır.
5. Production backend deploy edilir.
6. Production Pages deploy edilir.
7. Production smoke test çalıştırılır.

## Production Smoke Test

- Login/logout ve refresh token yenileme çalışır.
- Profil abonelik kartları güvenli erişim URL'lerini açar.
- Admin ürün, kullanıcı, abonelik ve kurum işlemleri açılır.
- Dosya yükleme/paylaşım, duyuru ve destek akışları çalışır.
- `/api/products` başarılı cevap verir.
- Auth cookie'leri HttpOnly/Secure/SameSite=Lax davranışını korur.
- State-changing request origin kontrolü çalışır.
- Kullanıcı silme/anonimleştirme policy'si ve privacy R2 purge consumer deploy edilen sürümde bulunur.

## Rollback / Recovery

- D1 için öncelik forward-fix; gerektiğinde preflight/apply öncesi alınan Time Travel bookmark kullanılır.
- Production kişisel veri export'u rutin GitHub Actions artifact'ı olarak tutulmaz.
- Worker/Pages kod rollback'i Cloudflare deployment geçmişi üzerinden yapılır.
- Recovery sonrası aynı production smoke seti yeniden çalıştırılır.
