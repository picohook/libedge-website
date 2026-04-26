# LibEdge

Üniversiteler ve kurumlar için akademik içerik erişim platformu. Kullanıcılar abonelikli yayıncı içeriklerine (JoVE, EMIS, IOP, ACS, Lecturio, Primal Pictures vb.) LibEdge portalı üzerinden erişir. Uzaktan Erişim (RA) modülü, kurum ağı dışındaki kullanıcıların kurum IP kimliğiyle yayıncı içeriklerine ulaşmasını sağlar.

---

## Mimari

```
Kullanıcı → LibEdge Portal (Cloudflare Pages)
               ↓ /api/* (Hono, Cloudflare Workers)
          Main Worker  ──────────────── D1 (SQLite)
               ↓ /api/ra/issue-token        KV (session, rate-limit)
          JWT (5 dk)                         R2 (dosya depolama)
               ↓
          RA Proxy Worker (proxy.libedge.com)
               ↓ egressFetch
          Kurum Egress Agent (cloudflared, kampüs ağında)
               ↓
          Yayıncı (jove.com, emis.com, …)
```

Tüm backend Cloudflare Workers üzerinde çalışır; sunucu yok, cold-start yok.

---

## Repo Yapısı

```
libedge-website/
├── backend/
│   └── src/
│       ├── index.js                  # Main Worker — tüm /api/* route'ları
│       ├── ra/
│       │   ├── schema.js             # D1 şema ensure (idempotent)
│       │   ├── jwt.js                # HS256 proxy token sign/verify
│       │   ├── crypto.js             # AES-GCM credential şifreleme
│       │   ├── host.js               # host encode/decode (hyphen-label)
│       │   └── proxy-url.js          # landing path builder
│       └── routes/ra/
│           ├── issue-token.js        # POST /api/ra/issue-token
│           ├── admin-overview.js     # GET /api/ra/admin/institutions, /logs
│           ├── admin-tunnel.js       # GET/PUT /api/ra/admin/institution-egress/:id
│           └── admin-config.js       # Ürün RA ayarları CRUD
├── workers/
│   └── proxy/
│       ├── wrangler.toml
│       └── src/
│           ├── index.js              # RA Proxy Worker (path_proxy + session_host_proxy)
│           ├── egress-client.js      # Kurum tüneline HMAC-imzalı istek
│           ├── upstream.js           # Cookie jar + login recipe executor
│           └── recipe.js             # form_post / js_spa recipe motoru
├── migrations/                       # D1 SQL migration'ları (sıralı)
├── admin.html                        # Super-admin tek sayfa arayüzü
├── profile.html                      # Kullanıcı portalı
├── wrangler.toml                     # Main Worker config (local / staging / production)
├── MIMARI.md                         # Detaylı teknik mimari belgesi
├── PRODUCT_STRATEGY.md               # Katalog, AI, öneri ve home-feed stratejisi
├── RA_PRODUCTION_READINESS.md        # RA production hazırlık rehberi
├── LIBEDGE_DOMAIN_MIGRATION.md       # libedge.com geçiş checklist'i
└── KVKK_SECURITY.md                  # KVKK ve veri güvenliği baseline'ı
```

---

## Gereksinimler

- Node.js 18+
- `npm install -g wrangler` (Cloudflare Workers CLI)
- Cloudflare hesabı (Workers, D1, KV, R2 etkin)

---

## Lokal Geliştirme

```powershell
# Bağımlılıkları yükle
cd backend && npm install && cd ..

# Lokal D1 migration'ı uygula
npx wrangler d1 migrations apply libedge-db --local

# Main Worker'ı başlat (http://localhost:8787)
npx wrangler dev --env local

# Proxy Worker'ı başlat (ayrı terminalde, http://localhost:8788)
cd workers/proxy
npx wrangler dev --env local --port 8788
```

Secrets lokal test için `.dev.vars` dosyasına yazılır (git'e commit edilmez):

```
JWT_SECRET=test-secret-32-chars-minimum
RA_PROXY_TOKEN_SECRET=test-proxy-secret-32-chars
RA_CREDS_MASTER_KEY=base64-encoded-32-byte-key
RA_EGRESS_DEFAULT_SECRET=test-egress-secret
```

---

## Deploy

### Staging

```powershell
# Main Worker
npx wrangler deploy --env staging

# D1 migration (staging DB)
npx wrangler d1 migrations apply libedge-db --env staging

# Proxy Worker
cd workers/proxy
npx wrangler deploy --env staging
cd ../..
```

### Production

```powershell
# Main Worker
npx wrangler deploy --env production

# D1 migration (production DB — AYRI veritabanı)
npx wrangler d1 migrations apply libedge-db-production --env production

# Proxy Worker
cd workers/proxy
npx wrangler deploy --env production
cd ../..
```

### Secrets (her ortam için ayrı)

```powershell
# Main Worker
npx wrangler secret put JWT_SECRET            --env staging
npx wrangler secret put RA_PROXY_TOKEN_SECRET --env staging
npx wrangler secret put RA_CREDS_MASTER_KEY   --env staging
npx wrangler secret put RA_EGRESS_DEFAULT_SECRET --env staging

# Proxy Worker (ayrı klasörden)
cd workers/proxy
npx wrangler secret put RA_PROXY_TOKEN_SECRET --env staging
npx wrangler secret put RA_CREDS_MASTER_KEY   --env staging
npx wrangler secret put RA_EGRESS_DEFAULT_SECRET --env staging
cd ../..
```

`--env staging` yerine `--env production` kullanarak production için tekrarla.

---

## Cloudflare DNS / Route Yapılandırması

| Ortam | Main Worker Route | Proxy Worker Route |
|---|---|---|
| Staging | `api-staging.libedge.com/*` | `proxy-staging.libedge.com/*`, `*.libedge.com/*` |
| Production | `api.libedge.com/*` | `proxy.libedge.com/*`, `*.libedge.com/*` |

> **Wildcard subdomain** (`*.libedge.com`) `session_host_proxy` modu için zorunludur — JoVE, EMIS, IOP bu modda çalışır. Cloudflare Proxied DNS kaydı + Universal SSL otomatik devreye girer.

---

## Uzaktan Erişim (RA) Modülü

### Proxy Modları

| Mod | Nasıl çalışır | Ürünler |
|---|---|---|
| `path_proxy` | `proxy.libedge.com/{encoded-host}/path` | Basit path tabanlı proxy akışları |
| `session_host_proxy` | `r{sid}.libedge.com/path` | JoVE, EMIS, ACS, IOP, Primal |

`ra_delivery_mode` kolonu bu iki değerden birini alır. `direct_login` ve `proxy` eski/geçersiz değerlerdir — `path_proxy` olarak migrate edilmeli.

### Erişim Tipleri (`access_type`)

| Değer | Anlamı |
|---|---|
| `direct` | Ücretsiz / doğrudan link |
| `ip` | Kurum IP'si / RA tüneli |
| `institution_link` | Kuruma özel giriş sayfası (Lecturio gibi) |
| `sso` | Kurumsal SSO |
| `email_password_external` | Kullanıcı adı + şifre |

### Token Akışı

1. Kullanıcı portalde "Erişime Git" → `POST /api/ra/issue-token`
2. Main Worker: abonelik doğrula → 5 dk geçerli JWT üret → KV'ya session yaz → `redirect_url` dön
3. Tarayıcı proxy Worker'a yönlenir → JWT doğrulanır (tek kullanımlık `jti`) → session cookie set → içerik proxylenir
4. Proxy Worker kurum egress agent'ına HMAC-imzalı istek atar; içerik kurum IP'sinden yayıncıya ulaşır

---

## Kurum Onboarding — RA Tünel Kurulumu

Kurumun kampüs ağında çalışan bir egress agent'a ihtiyacı var. Bu agent sayesinde kullanıcı trafik kurum IP'sinden çıkar.

### Gereksinimler

- Kampüs ağında sürekli açık bir sunucu/VM (Linux önerilir, Windows de desteklenir)
- Minimum 512 MB RAM, dışa çıkış interneti (gelen port açmaya gerek yok)
- `cloudflared` kurulumu (~10 dk)

### Kurulum Adımları

1. **LibEdge admin panelinden** kuruma ait egress endpoint ve secret alın (`Uzaktan Erişim > Kurum Tünelleri > Düzenle`)
2. Sunucuya `cloudflared` kurun:
   ```bash
   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
     -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
   ```
3. LibEdge'in sağladığı `tunnel-provision.ps1` / kurulum scriptini çalıştırın
4. Admin panelinde tünel durumunu kontrol edin (yeşil = aktif)

### Kurumdan İstenen Bilgiler

- Kampüs statik IP aralığı (publisher IP whitelisting için)
- Teknik iletişim kişisi (ad, e-posta)
- Hangi ürünlere erişim istendiği

---

## Kapasite

Cloudflare Workers + D1 mimarisinde pratik limitler:

| Kaynak | Kapasite |
|---|---|
| Kurumlar | Binlerce (D1 limiti değil, admin yönetim kapasitesi belirler) |
| Kullanıcılar | Onlarca bin (D1 5 GB free tier'da yüz binlerce kayıt) |
| Ürünler | Sınırsız pratik (onlarca–yüzlerce) |
| Eşzamanlı proxy oturumu | Workers concurrency limiti yok; KV okuma ~1 ms |
| Erişim log yazma | Aylık 50 M D1 write hakkı — günde 10.000 oturum limitin çok altında |
| Bant genişliği | Dağıtık: her kurumun egress agent'ı kendi bant genişliğini kullanır |

Gerçek bottleneck teknik değil operasyoneldir: her kurum tünelini kim kurar ve güncel tutar.

---

## Domain Geçişi (selmiye.com → libedge.com)

Geçiş için sadece Cloudflare Worker env değişkenlerini güncellemek yeterli — kod değişikliği minimumdur:

| Değişken | Staging | Production |
|---|---|---|
| `RA_PROXY_HOST` | `proxy-staging.libedge.com` | `proxy.libedge.com` |
| `RA_PROXY_BASE_HOST` | `libedge.com` | `libedge.com` |
| `RA_EGRESS_HOST` | `ra-egress-staging.libedge.com` | `ra-egress.libedge.com` |

`workers/proxy/wrangler.toml` route'larını, Cloudflare DNS kayıtlarını ve proxy hata sayfasındaki portal URL'ini güncelle.

---

## Bilinen Eksikler / Sonraki Adımlar

- [x] `direct_login` delivery mode'u kaldırıldı; legacy değerler `path_proxy` olarak normalize ediliyor
- [ ] Production'da `*.libedge.com` wildcard route aktif edilecek (session_host_proxy için zorunlu)
- [ ] Admin UI'dan ürün onboarding (manuel D1 SQL ihtiyacını azaltmak)
- [ ] MIMARI.md ile migration'lar arasındaki terminoloji tutarsızlıklarını gider
- [ ] KVKK/Gizlilik metni kayıtlı kullanıcı, RA ve AI araçlarını kapsayacak şekilde güncellenecek
