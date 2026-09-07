# LibEdge Mimari

Bu belge RA/proxy bileşenleri çıkarılmış LibEdge sürümünün güncel mimarisini özetler.
Eski uzaktan erişim kodu arşiv branch'inde saklanmıştır:
`archive-staging-before-ra-cleanup-2026-09-06`.

## Çalışma Modeli

```text
Cloudflare Pages
  -> statik HTML/CSS/JS
  -> functions/api/[[path]].js
  -> backend/src/worker.js
       -> backend/src/index.js (Hono API)
       -> backend/src/privacy/r2-purge.js (scheduled privacy purge)
  -> D1, R2, KV
```

## Ortamlar

| Ortam | Pages | Worker | D1 | R2 | KV |
|---|---|---|---|---|---|
| Local/default | local dev | `libedge-api-local` | `libedge-db` (staging D1) | `libedge-files-staging` | default/local KV namespace |
| Staging | `staging.libedge-website.pages.dev` | `libedge-api-staging` | `libedge-db` | `libedge-files-staging` | staging KV namespace |
| Production | production Pages / `libedge.com` hedefi | `libedge-api-prod` | `libedge-db-production` | `libedge-files` | production KV namespace |

Local/default ve staging **tam olarak aynı ortam değildir**. Kod aynı branch/commit'ten
çalıştırılabilir; fakat Worker adı ve KV namespace'i farklıdır. Mevcut güvenli varsayılan
tasarımda local/default D1 ve R2 staging kaynaklarını kullanır. Dolayısıyla local destructive
D1/R2 testi staging verisini etkileyebilir. Production kaynakları ayrıdır.

## Ana Bileşenler

- `backend/src/worker.js`: gerçek Worker entrypoint; API'yi delege eder ve scheduled privacy purge çalıştırır.
- `backend/src/index.js`: Hono API, auth, admin, dosya, duyuru, ürün ve abonelik route'ları.
- `backend/src/privacy/r2-purge.js`: yalnız allowlist `ticket-attachments/` prefix'i için privacy purge queue tüketicisi.
- `backend/src/auth`: cookie auth, refresh token, parola ve rate limit helper'ları.
- `admin.html`: super-admin ve kurum admin paneli.
- `profile.html`: kullanıcı dashboard'u, abonelikler, dosyalar ve destek akışları.
- `functions/api/[[path]].js`: Pages ortamından Worker API'ye yönlendirme.
- `wrangler.toml`: local/default, staging ve production Worker binding'leri.
- `migrations/`: D1 migration geçmişi; `0047_user_deletion_integrity.sql` privacy cleanup policy'sini içerir.

## Kullanıcı Silme / Privacy Mimarisi

- Kullanıcı silme policy'si merkezi D1 trigger ile uygulanır.
- Hesaba özel auth/engagement verileri silinir.
- İş kayıtları gerektiğinde anonimleştirilir veya kullanıcı bağlantısı kaldırılır.
- Paylaşılan/kurumsal içerikler fiziksel olarak gereksiz yere silinmez; creator/uploader ilişkisi kaldırılır.
- Support ticket attachment referansları silinmeden önce `privacy_r2_purge_queue` içine alınır.
- Scheduled Worker consumer yalnız `ticket-attachments/` prefix'ini fiziksel R2 silmeye kabul eder.
- D1 ve R2 zinciri gerçek staging sentetik E2E testleriyle doğrulanmıştır.

## Erişim Modeli

Ürün ve abonelik erişimleri RA proxy üretmeden çözülür:

- `direct`: doğrudan ürün URL'i.
- `institution_link`: kuruma özel giriş sayfası.
- `sso`: kurumsal SSO bağlantısı.
- `email_password_external`: harici sistemde kullanıcı adı/şifre ile erişim notu.
- `mixed`: birden fazla erişim yöntemi için açıklama/not akışı.
- `ip`: kampüs/VPN/IP kısıtı bilgisi; otomatik proxy üretmez.

Frontend erişim butonu yalnız tanımlı ve güvenli URL olduğunda yeni sekmede açılır.

## Deploy Akışı

- `staging` push: CI ve ilgili Pages/Worker staging deploy'ları.
- Production: manuel workflow dispatch + production environment.
- D1 production apply: manuel; migrations list + şema kontrolü + Time Travel bookmark öncesinde çalışır.
- Production Infrastructure Preflight: read-only D1/Time Travel/R2/KV/secret-name/config kontrolü.

## Güvenlik Baseline

- Auth cookie'leri HttpOnly, Secure, SameSite=Lax.
- State-changing request'lerde origin allowlist uygulanır.
- Secrets repoda tutulmaz; production gerekli secret sözleşmesi deploy sırasında fail-closed uygulanır.
- Kullanıcı/server kaynaklı dinamik metinler escape edilmeden `innerHTML` içine yazılmamalıdır.
- Dosya/R2 silme allowlist mantığıyla yapılır.
- Refresh token replay protection ve rate limit helper'ları aktiftir.
- Aktif analytics tracker bulunmadığı için sahte CMP/analytics iddiası yoktur; cookie policy gerçek davranışla eşleştirilmiştir.
