# LibEdge

LibEdge, kurumlar ve kullanıcılar için akademik içerik erişimi, ürün kataloğu,
duyurular, dosya paylaşımı, destek ve yönetim akışlarını bir araya getiren
Cloudflare tabanlı bir portaldır.

Bu sürümde uzaktan erişim/proxy altyapısı çalışma kodundan çıkarılmıştır.
Kullanıcı erişimleri doğrudan URL, kuruma özel giriş bağlantısı, SSO, kayıt
bağlantısı veya harici erişim bilgisi üzerinden yönetilir.

## Mimari

```text
Kullanıcı
  -> Cloudflare Pages frontend
  -> /api/* Pages proxy
  -> Hono Worker
  -> D1 SQLite, R2 dosya depolama, KV rate limit
```

Worker giriş noktası `backend/src/worker.js` dosyasıdır. Bu wrapper mevcut
`backend/src/index.js` API uygulamasını çalıştırır ve scheduled privacy R2 purge
görevini ekler.

## Ortamlar

| Ortam | Worker | D1 | R2 | KV |
|---|---|---|---|---|
| Local/default | `libedge-api-local` | staging D1 (`libedge-db`) | staging R2 (`libedge-files-staging`) | local/default KV namespace |
| Staging | `libedge-api-staging` | `libedge-db` | `libedge-files-staging` | staging KV namespace |
| Production | `libedge-api-prod` | `libedge-db-production` | `libedge-files` | production KV namespace |

**Önemli:** Local ve staging aynı kodu çalıştırabilir, ancak tamamen aynı ortam değildir.
Default/local Worker adı ve KV binding'i farklıdır. Buna karşılık mevcut `wrangler.toml`
tasarımında local/default D1 ve R2 staging kaynaklarını kullanır. Bu nedenle local testler
staging verisini/dosyalarını etkileyebilir; gerçek veri üzerinde destructive local test yapılmamalıdır.
Production kaynakları local/staging'den ayrıdır.

## Repo Yapısı

```text
libedge-website/
├── backend/src/worker.js         # Worker entrypoint + scheduled privacy purge
├── backend/src/index.js          # Hono API route'ları
├── backend/src/privacy/          # Privacy R2 purge helper'ları
├── backend/src/auth/             # Auth, refresh token, rate limit helper'ları
├── backend/src/validation.js     # Ortak validation helper'ları
├── migrations/                   # D1 migration geçmişi
├── admin.html                    # Admin paneli
├── profile.html                  # Kullanıcı portalı
├── assets/                       # CSS, JS ve görseller
├── functions/api/[[path]].js     # Pages -> Worker API yönlendirmesi
├── wrangler.toml                 # Worker env config
└── .github/workflows/            # CI, deploy, smoke, preflight ve migration workflow'ları
```

## Lokal Geliştirme

```powershell
npm install
npx wrangler dev
```

`wrangler.toml` default bloğu local geliştirme içindir; `--env local` diye ayrı bir
environment tanımlı değildir. Lokal secrets `.dev.vars` dosyasında tutulur ve Git'e
commit edilmez.

```text
JWT_SECRET=...
R2_PUBLIC_URL=...
AIRTABLE_PAT=...
AIRTABLE_BASE_ID=...
RESEND_API_KEY=...
RESEND_ALERT_TO=...
```

## Test ve Build

```powershell
npm test
npm run lint
npm run build
npm run smoke:frontend
```

Canlı staging smoke testleri GitHub Actions üzerinden çalıştırılır.

## Deploy

Staging backend normalde `staging` push ile workflow üzerinden deploy edilir.
Production backend ve Pages manuel workflow dispatch + production environment ile çalıştırılır.

Production için doğrudan CLI yerine repo workflow'ları tercih edilir. Migration apply öncesi
`PRODUCTION_MIGRATION_PLAN.md` ve Production Infrastructure Preflight takip edilmelidir.

## CI/CD

- `ci.yml`: syntax, lint, test ve CSS build kalite kapısı.
- `deploy-workers.yml`: staging backend otomatik; production backend manuel.
- `deploy-pages.yml`: staging Pages deploy; production Pages manuel.
- `staging-smoke.yml`: auth/files/frontend staging smoke testleri.
- `d1-migrations.yml`: D1 migration list/apply; production apply preflight + Time Travel bookmark içerir.
- `production-preflight.yml`: production'a yazmadan D1, Time Travel, R2, KV, secret isimleri ve config erişimini kontrol eder.

## Stabilizasyon Durumu — 7 Eylül 2026

- Auth/cookie/origin güvenliği: CLOSED
- Mobile navigation: CLOSED
- `/api/products` staging erişimi: CLOSED
- Admin audit altyapısı: uygulanmış
- KVKK kullanıcı silme/anonimleştirme: staging D1 E2E doğrulandı
- Support ticket attachment privacy purge: staging R2 E2E doğrulandı
- Çerez politikası: mevcut gerçek site davranışıyla eşleştirildi; aktif analytics tracker bulunmuyor
- Production D1 migration preflight: uygulanmış
- Production infrastructure preflight: uygulanmış; gerçek production çalıştırması production geçiş gününde yapılacak

## Ana Özellikler

- Kullanıcı kayıt/giriş, refresh token ve KVKK onayı
- Profil dashboard'u ve abonelik erişim kartları
- Kurum, kullanıcı, ürün ve abonelik yönetimi
- Merkezi ve kurumsal dosya paylaşımı
- Duyuru yönetimi
- Destek talepleri
- Ürün önerileri ve bireysel araçlar
- Airtable senkronizasyonu
