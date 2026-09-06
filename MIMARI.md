# LibEdge Mimari

Bu belge RA/proxy bileşenleri çıkarılmış LibEdge sürümünün güncel mimarisini özetler.
Eski uzaktan erişim kodu arşiv branch'inde saklanmıştır:
`archive-staging-before-ra-cleanup-2026-09-06`.

## Çalışma Modeli

```text
Cloudflare Pages
  -> statik HTML/CSS/JS
  -> functions/api/[[path]].js
  -> Hono Main Worker
  -> D1, R2, KV
```

## Ortamlar

| Ortam | Pages | Worker | D1 | R2 |
|---|---|---|---|---|
| Staging | `staging.libedge-website.pages.dev` | `libedge-api-staging` | `libedge-db` | `libedge-files-staging` |
| Production | `libedge-website.pages.dev` | `libedge-api-prod` | `libedge-db-production` | `libedge-files` |

## Ana Bileşenler

- `backend/src/index.js`: Hono API, auth, admin, dosya, duyuru, ürün ve abonelik route'ları.
- `backend/src/auth`: cookie/bearer auth, refresh token, parola ve rate limit helper'ları.
- `admin.html`: super-admin ve kurum admin paneli.
- `profile.html`: kullanıcı dashboard'u, abonelikler, dosyalar ve destek akışları.
- `functions/api/[[path]].js`: Pages ortamından Worker API'ye yönlendirme.
- `wrangler.toml`: local, staging ve production Worker binding'leri.
- `migrations/`: D1 migration geçmişi.

## Erişim Modeli

Ürün ve abonelik erişimleri RA proxy üretmeden çözülür:

- `direct`: doğrudan ürün URL'i.
- `institution_link`: kuruma özel giriş sayfası.
- `sso`: kurumsal SSO bağlantısı.
- `email_password_external`: harici sistemde kullanıcı adı/şifre ile erişim notu.
- `mixed`: birden fazla erişim yöntemi için açıklama/not akışı.
- `ip`: kampüs/VPN/IP kısıtı bilgisi; otomatik proxy üretmez.

Frontend erişim butonu yalnız tanımlı ve güvenli URL olduğunda yeni sekmede açılır.

## Veri ve Migration Notu

Production/staging veritabanı geçmişinde eski RA tabloları ve `products.ra_*`
kolonları bulunabilir. Bu temizlikte production veri kaybı riskini önlemek için
migration geçmişi ve mevcut DB kolonları silinmedi. Runtime artık RA route'u,
proxy token üretimi, tünel heartbeat'i veya RA admin ekranı çalıştırmaz.

İleride fiziksel DB sadeleştirme istenirse ayrı bir cleanup migration planı,
önce staging snapshot ve smoke test ile hazırlanmalıdır.

## Deploy Akışı

- Staging push: CI, Pages staging deploy ve backend staging deploy.
- Production: manuel workflow dispatch ve environment approval.
- D1 migration apply işleri manuel ve onaylı çalıştırılır.

## Güvenlik Baseline

- Secrets `.dev.vars`, Cloudflare secrets veya GitHub secrets üzerinden yönetilir.
- Kullanıcı/server kaynaklı dinamik metinler escape edilmeden `innerHTML` içine yazılmamalıdır.
- Dosya URL'leri allowlist mantığıyla gösterilir.
- Refresh token replay protection ve rate limit helper'ları aktif tutulur.