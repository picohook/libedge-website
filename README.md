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
  -> /api/* Hono Worker
  -> D1 SQLite, R2 dosya depolama, KV rate limit
```

Backend Cloudflare Workers üzerinde çalışır. Frontend statik HTML/CSS/JS olarak
Cloudflare Pages üzerinden yayınlanır.

## Repo Yapısı

```text
libedge-website/
├── backend/src/index.js          # Main Worker ve API route'ları
├── backend/src/auth/             # Auth, refresh token, rate limit helper'ları
├── backend/src/validation.js     # Ortak validation helper'ları
├── migrations/                   # D1 migration geçmişi
├── admin.html                    # Admin paneli
├── profile.html                  # Kullanıcı portalı
├── assets/                       # CSS, JS ve görseller
├── functions/api/[[path]].js     # Pages -> Worker API yönlendirmesi
├── wrangler.toml                 # Worker env config
└── .github/workflows/            # CI, deploy ve migration workflow'ları
```

Not: Migration geçmişinde eski RA tabloları/kolonları bulunabilir. Bunlar üretim
veritabanı geçmişini temsil ettiği için bu temizlikte fiziksel olarak silinmedi.

## Gereksinimler

- Node.js 18+
- Cloudflare hesabı: Workers, Pages, D1, R2, KV
- Proje bağımlılıkları: `npm install`

## Lokal Geliştirme

```powershell
npm install
npx wrangler d1 migrations apply libedge-db --local
npx wrangler dev --env local
```

Lokal secrets `.dev.vars` dosyasında tutulur ve Git'e commit edilmez.

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
```

## Deploy

Staging backend:

```powershell
npx wrangler deploy --env staging
npx wrangler d1 migrations apply libedge-db --remote --env staging
```

Production backend:

```powershell
npx wrangler deploy --env production
npx wrangler d1 migrations apply libedge-db-production --remote --env production
```

Production migration'ları otomatik veya rutin işlem gibi çalıştırılmamalıdır.
Önce bekleyen migration listesi, veri etkisi, smoke test ve rollback yolu
kontrol edilmelidir.

## CI/CD

- `ci.yml`: PR ve `staging`/`main` push için syntax, lint, test ve CSS build.
- `deploy-workers.yml`: `staging` push ile staging backend deploy eder.
  Production backend deploy manuel `workflow_dispatch` ve environment approval ile yapılır.
- `deploy-pages.yml`: `staging` push ile staging Pages deploy eder.
  Production Pages deploy manuel çalıştırılır.
- `staging-smoke.yml`: GitHub Secrets ile gerçek staging auth ve dosya smoke
  testlerini manuel çalıştırır.
- `d1-migrations.yml`: D1 migration `list`/`apply` işleri için manuel workflow.

## Ana Özellikler

- Kullanıcı kayıt/giriş, refresh token ve KVKK onayı
- Profil dashboard'u ve abonelik erişim kartları
- Kurum, kullanıcı, ürün ve abonelik yönetimi
- Merkezi ve kurumsal dosya paylaşımı
- Duyuru yönetimi
- Destek talepleri
- Ürün önerileri ve bireysel araçlar
- Airtable senkronizasyonu
