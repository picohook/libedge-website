# LibEdge Domain Migration Checklist

Bu dosya gelecekte `selmiye.com` / `libedge-website` staging düzeninden
`libedge.com` markalı production düzene geçerken izlenecek kontrol listesidir.
Şu an uygulanacak bir deploy talimatı değil; geçiş günü için runbook'tur.

## Hedef Durum

| Bileşen | Şimdiki değer | Hedef değer |
|---|---|---|
| Public portal | `staging.libedge-website.pages.dev` | `www.libedge.com` veya `app.libedge.com` |
| Main API Worker | `libedge-api-prod` | Aynı kalabilir |
| Path proxy host | `proxy.selmiye.com` | `proxy.libedge.com` |
| Session-host wildcard | `r{sid}.selmiye.com` | `r{sid}.libedge.com` |
| Egress tunnel host | `ra-egress-{kurum}.selmiye.com` | `ra-egress-{kurum}.libedge.com` |
| Files/R2 host | `files.selmiye.com` | `files.libedge.com` |
| GitHub repo | `picohook/libedge-website` | Yeni ad belirlenecek |

## Preflight

- [ ] `libedge.com` Cloudflare zone aynı hesapta veya erişilebilir bir hesapta.
- [ ] Cloudflare Pages projesi için hedef ad net: `libedge-website`, `libedge`, vb.
- [ ] GitHub repo adı/owner değişecekse yeni remote URL net.
- [ ] Production D1, KV, R2 kaynakları korunacak mı yoksa yeniden mi oluşturulacak karar verildi.
- [ ] Production secrets listesi hazır.
- [ ] DNS TTL ve cutover zamanı belirlendi.
- [ ] Geri dönüş planı: eski `selmiye.com` route'ları en az bir süre açık kalacak.

## Cloudflare DNS

`libedge.com` zone içinde gerekli kayıtlar:

| Host | Tür | Hedef | Proxy |
|---|---|---|---|
| `www` veya `app` | CNAME | Cloudflare Pages target | Proxied |
| `proxy` | Worker route | `libedge-ra-proxy-prod` | Proxied |
| `*` | Worker route | `libedge-ra-proxy-prod` | Proxied |
| `files` | R2 custom domain veya Worker | R2/files path | Proxied |
| `ra-egress-{kurum}` | CNAME | `{tunnelId}.cfargotunnel.com` | Proxied |

Önemli: `session_host_proxy` için `*.libedge.com/*` Worker route'u zorunludur.
Bu olmadan `r{sid}.libedge.com` linkleri DNS/route seviyesinde kırılır.

## Worker Config Değişiklikleri

`wrangler.toml` production vars:

```toml
[env.production.vars]
ENVIRONMENT = "production"
WORKER_NAME = "libedge-api-prod"
RA_PROXY_HOST = "proxy.libedge.com"
RA_PROXY_BASE_HOST = "libedge.com"
```

`workers/proxy/wrangler.toml` production routes/vars:

```toml
[env.production]
name = "libedge-ra-proxy-prod"
routes = [
  { pattern = "proxy.libedge.com/*", zone_name = "libedge.com" },
  { pattern = "*.libedge.com/*",     zone_name = "libedge.com" }
]

[env.production.vars]
ENVIRONMENT = "production"
RA_PROXY_BASE_HOST = "libedge.com"
RA_EGRESS_HOST = "ra-egress.libedge.com" # yalnız single fallback kullanılıyorsa
RA_FILES_HOST = "files.libedge.com"
```

Staging de `libedge.com` altına taşınacaksa aynı mantıkla:

```toml
RA_PROXY_HOST = "proxy-staging.libedge.com"
RA_PROXY_BASE_HOST = "libedge.com"

routes = [
  { pattern = "proxy-staging.libedge.com/*", zone_name = "libedge.com" },
  { pattern = "*.libedge.com/*",             zone_name = "libedge.com" }
]
```

Not: Staging ve production aynı wildcard `*.libedge.com/*` route'unu aynı anda
paylaşamaz. Production wildcard varsa staging için ayrı zone/subdomain stratejisi
seçilmeli: örn. `*.staging.libedge.com/*`.

## Secrets

Main Worker production:

```powershell
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put RA_PROXY_TOKEN_SECRET --env production
npx wrangler secret put RA_CREDS_MASTER_KEY --env production
npx wrangler secret put RA_EGRESS_DEFAULT_SECRET --env production
```

Proxy Worker production:

```powershell
cd workers/proxy
npx wrangler secret put RA_PROXY_TOKEN_SECRET --env production
npx wrangler secret put RA_CREDS_MASTER_KEY --env production
npx wrangler secret put RA_EGRESS_DEFAULT_SECRET --env production
cd ../..
```

Production hedefi çoklu kurumda `RA_EGRESS_DEFAULT_SECRET` yerine kurum bazlı
`institution_ra_settings.egress_secret_enc` kullanmaktır. Fallback secret sadece
geçiş ve single-tenant smoke için tutulmalı.

## D1 / KV / R2

- [ ] Production D1 migration'ları uygulanmış:

```powershell
npx wrangler d1 migrations apply libedge-db-production --env production
```

- [ ] RA delivery mode legacy temizliği production D1'de çalıştırılmış:

```sql
UPDATE products
   SET ra_delivery_mode = 'path_proxy'
 WHERE lower(trim(coalesce(ra_delivery_mode, ''))) IN ('proxy', 'direct_login');
```

- [ ] `RA_UPSTREAM_SESSIONS` production KV namespace doğru bind edilmiş.
- [ ] `RATE_LIMIT_KV` production KV namespace doğru bind edilmiş.
- [ ] R2 production bucket `libedge-files` custom domaini yeni hosta bağlanmış.
- [ ] `R2_PUBLIC_URL` veya dosya hostu kullanan env/secrets yeni domaini gösteriyor.

## Kod İçinde Domain Araması

Geçiş PR'ında şu aramalar temiz olmalı:

```powershell
rg -n "selmiye.com|libedge-website.pages.dev|agursel.workers.dev|proxy-staging"
```

Beklenen kalanlar yalnız doküman/backward-compat notları olmalı.

Özellikle kontrol edilecek yerler:

- `wrangler.toml`
- `workers/proxy/wrangler.toml`
- `workers/proxy/src/index.js` içindeki hata sayfası portal URL'i
- `backend/src/index.js` CORS allowlist ve public origin helper'ları
- `README.md`
- `MIMARI.md`
- `RA_PRODUCTION_READINESS.md`

## Deploy Sırası

1. Cloudflare DNS kayıtlarını ve wildcard SSL'i hazırla.
2. Production secrets eksiksiz mi kontrol et.
3. Main Worker production deploy:

```powershell
npx wrangler deploy --env production
```

4. Proxy Worker production deploy:

```powershell
cd workers/proxy
npx wrangler deploy --env production
cd ../..
```

5. Pages production domainini bağla.
6. D1/KV/R2 bindinglerini Cloudflare dashboard'da doğrula.
7. Kurum egress tunnel DNS kayıtlarını yeni domaine geçir.
8. Eski route'ları hemen kapatma; smoke testler tamamlanana kadar paralel tut.

## Smoke Test

- [ ] `https://www.libedge.com` veya `https://app.libedge.com` açılıyor.
- [ ] Login/logout çalışıyor.
- [ ] `/api/me` production Main Worker'a gidiyor.
- [ ] Admin panel ürün listesi geliyor.
- [ ] `POST /api/ra/issue-token` path_proxy üründe `proxy.libedge.com/...` üretiyor.
- [ ] `POST /api/ra/issue-token` session_host_proxy üründe `r{sid}.libedge.com/...` üretiyor.
- [ ] `r{sid}.libedge.com` DNS + SSL + Worker route çalışıyor.
- [ ] Proxy Worker `RA_UPSTREAM_SESSIONS` KV okuyup yazıyor.
- [ ] Egress health test `200` dönüyor.
- [ ] JoVE veya benzeri IP-auth ürün paywall göstermeden açılıyor.
- [ ] Mobil dış ağ testi geçiyor.
- [ ] Files/R2 avatar/logo URL'leri açılıyor.

## Rollback

1. Pages custom domaini eski hosta döndür.
2. Worker routes'u eski `selmiye.com` patternlerine geri al.
3. `RA_PROXY_HOST` ve `RA_PROXY_BASE_HOST` eski değerlere geri deploy et.
4. Egress CNAME kayıtlarını eski tunnel hostlara döndür.
5. D1 verisi geri alınmaz; domain değişikliği veri modelini bozmaz.

## Kararlar

- `ra_delivery_mode` yalnız `session_host_proxy` ve `path_proxy`.
- `direct_login` proxy modu değildir; legacy değer `path_proxy` olarak normalize edilir.
- Production wildcard route blocker'dır.
- Ürün onboarding UI domain geçişinden sonra büyütülecek.
- Kurum onboarding öncesi `RA_PRODUCTION_READINESS.md` rehberi güncel tutulacak.
