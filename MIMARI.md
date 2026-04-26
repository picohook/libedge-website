# LibEdge — Remote Access Platform Mimarisi

> Son güncelleme: 2026-04-26  
> Durum: Staging'de aktif · AWS WAF production blocker var (§12.10)

---

## §1 Genel Bakış

LibEdge, üniversitelere akademik içerik erişimi sağlayan bir aggregator platformudur.  
**Remote Access (RA) modülü**, kullanıcıların kurum dışından (evden, mobilde) akademik
yayıncılara kurumun IP adresi üzerinden erişmesini sağlar — EZproxy benzeri ama
Cloudflare-native, zero-infrastructure hedefli.

### Stack

| Katman | Teknoloji |
|---|---|
| Frontend | Cloudflare Pages · vanilla HTML/JS · Tailwind CDN |
| Backend API | Cloudflare Workers (Hono) · D1 (SQLite) · KV · R2 |
| RA Proxy Worker | Cloudflare Workers (JS) · KV |
| RA Egress Agent | Go binary · Docker · Cloudflare Named Tunnel |
| Auth | Cookie-based (HttpOnly `authToken`) + RA JWT (HS256) |

---

## §2 Repo Yapısı

```
libedge-website/
├── backend/src/               # Ana API (Hono Workers)
│   ├── routes/ra/             # RA endpoint'leri
│   │   ├── issue-token.js     # Token üret, KV'a yaz, redirect URL döndür
│   │   └── ...
│   └── ra/
│       ├── jwt.js             # signProxyToken / verifyProxyToken (HS256)
│       ├── schema.js          # ensureRemoteAccessSchema — runtime kolonlar
│       ├── crypto.js          # AES-GCM egress secret encrypt/decrypt
│       ├── host.js            # encodeHost / decodeHost (path-proxy URL)
│       └── proxy-url.js       # buildRARedirectUrl (trailing slash temizleme)
├── workers/proxy/src/
│   ├── index.js               # Proxy Worker — path_proxy + session_host_proxy
│   └── egress-client.js       # HMAC-signed egress fetch
├── ra-egress/
│   ├── main.go                # Go egress agent (HMAC verify → upstream fetch)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── tunnel-provision.ps1   # Tek seferlik Named Tunnel kurulum scripti
│   └── .env                   # Gitignored — TUNNEL_TOKEN, EGRESS_SHARED_SECRET
├── assets/js/auth.js          # API_BASE = '' (relative) · cookie auth
├── profile.html               # Portal UI · openRemoteAccess()
└── wrangler.toml              # Ana backend wrangler config
```

---

## §3 Cloudflare Kaynakları (Staging)

| Kaynak | ID / İsim |
|---|---|
| D1 veritabanı | `libedge-db` · `207d80d6-7e6b-4e10-aacf-b218970dbaf8` |
| KV (rate limit) | `RATE_LIMIT_KV` · `556d17f88a7a48e381e5ffed1d150536` |
| KV (RA sessions) | `RA_UPSTREAM_SESSIONS` · `a3a0f76dca834921b4b1000bce675037` |
| R2 bucket | `libedge-files-staging` |
| Main Worker | `libedge-api-staging` |
| Proxy Worker | `libedge-ra-proxy-staging` |
| Named Tunnel | `libedge-ra-egress` → `ra-egress.selmiye.com` |
| Pages site | `staging.libedge-website.pages.dev` |

### Worker Routes (staging)

| Worker | Route |
|---|---|
| `libedge-api-staging` | `libedge-api-staging.agursel.workers.dev/*` |
| `libedge-ra-proxy-staging` | `proxy-staging.selmiye.com/*` · `*.selmiye.com/*` |

### Worker Secrets (proxy Worker staging)

| Secret | Açıklama |
|---|---|
| `RA_PROXY_TOKEN_SECRET` | JWT imzalama — main backend ile aynı değer |
| `RA_EGRESS_DEFAULT_SECRET` | HMAC secret fallback — ra-egress `.env` ile eşleşmeli |
| `RA_CREDS_MASTER_KEY` | AES-GCM master key (egress_secret_enc için) |

---

## §4 D1 Şeması (RA ile ilgili)

### `products` (RA kolonları)

| Kolon | Tip | Açıklama |
|---|---|---|
| `ra_enabled` | INTEGER | 0/1 |
| `ra_delivery_mode` | TEXT | `path_proxy` \| `session_host_proxy` |
| `ra_origin_host` | TEXT | Upstream hostname, örn. `www.jove.com` |
| `ra_origin_landing_path` | TEXT | İlk yönlendirme path'i, örn. `/research` |
| `ra_host_allowlist_json` | TEXT | JSON array — egress SSRF koruması için |
| `ra_requires_tunnel` | INTEGER | 1 = egress gerekli |

### `institution_ra_settings`

| Kolon | Açıklama |
|---|---|
| `institution_id` | PK |
| `egress_endpoint` | Tunnel URL, örn. `https://ra-egress.selmiye.com` |
| `egress_secret_enc` | AES-GCM şifreli HMAC secret (NULL ise RA_EGRESS_DEFAULT_SECRET kullanılır) |
| `enabled` | 0/1 |
| `tunnel_status` | `healthy` / `unknown` / `degraded` |

### Staging D1 Mevcut Değerler

```sql
-- products
slug='jove-research'
  ra_delivery_mode = 'session_host_proxy'
  ra_origin_landing_path = '/research'
  ra_origin_host = 'www.jove.com'
  ra_enabled = 1

-- institution_ra_settings
institution_id = 1
  egress_endpoint = 'https://ra-egress.selmiye.com'
  egress_secret_enc = NULL   ← RA_EGRESS_DEFAULT_SECRET fallback kullanılıyor
  enabled = 1
  tunnel_status = 'healthy'
```

---

## §5 RA Akışı — session_host_proxy Modu

```
[Kullanıcı tarayıcı]
  │
  │  1. POST /api/ra/issue-token  (cookie: authToken httpOnly)
  ▼
[libedge-api-staging Worker]
  │  - Abonelik lookup: ra_delivery_mode, ra_origin_landing_path
  │  - JWT sign (HS256): sub, iid, sid, pid, jti, mod, exp
  │  - KV yaz: rhost:{sessionId} → {origin_host, institution_id, expires_at}
  │  - Redirect URL: https://r{sid}.selmiye.com{landingPath}?t={JWT}
  ▼
[Tarayıcı → https://r{sid}.selmiye.com/research?t=JWT]
  │
  ▼
[libedge-ra-proxy-staging Worker]
  │  acceptSessionHostToken():
  │  - JWT verify (HS256, RA_PROXY_TOKEN_SECRET)
  │  - JTI tek kullanımlık kontrol (RATE_LIMIT_KV)
  │  - KV session doğrula
  │  - 302 + Set-Cookie: ra_proxy_session={sid}
  ▼
[Tarayıcı → https://r{sid}.selmiye.com/research (cookie ile)]
  │
  ▼
[libedge-ra-proxy-staging Worker]
  │  handleSessionHost():
  │  - KV'dan session yükle
  │  - buildUpstreamHeaders(): ra_proxy_session strip, diğer cookieler forward
  │  - Origin/Referer rewrite: r*.selmiye.com → www.jove.com
  │  - egressFetch() → ra-egress.selmiye.com/proxy
  ▼
[ra-egress (Go, Named Tunnel)]
  │  - X-RA-Signature HMAC-SHA256 verify
  │  - ALLOWED_HOST_REGEX kontrol (SSRF koruması)
  │  - net/http → www.jove.com (kurum IP'siyle)
  │  - Response stream
  ▼
[www.jove.com]
```

---

## §6 egressFetch — HMAC İmzalama

`workers/proxy/src/egress-client.js` — proxy Worker → ra-egress arası imzalama:

```
msg = "{METHOD}|{targetURL}|{timestamp}|{body_sha256_hex}"
sig = HMAC-SHA256(msg, egress_secret)

Request headers:
  X-RA-Target-URL:  https://www.jove.com/...
  X-RA-Method:      GET
  X-RA-Timestamp:   {unix_ts}
  X-RA-Signature:   {hex}
```

Secret öncelik sırası (egress-client.js):
1. D1'de `egress_secret_enc` varsa + `RA_CREDS_MASTER_KEY` varsa → AES-GCM decrypt
2. `RA_EGRESS_DEFAULT_SECRET` env varı → plaintext fallback
3. Hata fırlat

---

## §7 Proxy Worker — Header Politikası

### Upstream'e gönderilen (browser → JoVE):
- Tüm browser cookie'leri **ra_proxy_session hariç** (aws-waf-token, cf_clearance, joveiptoken vb.)
- Origin ve Referer → `r*.selmiye.com` → `www.jove.com` olarak rewrite
- Cloudflare runtime header'ları strip: `cf-connecting-ip`, `cf-ray`, `x-forwarded-for`, `cdn-loop` vb.

### JoVE'den gelen response:
- Set-Cookie → domain `r*.selmiye.com`, path `/` olarak rewrite
- `getSetCookie()` destekli çoklu Set-Cookie işleme
- Location → `r*.selmiye.com` subdomain'e rewrite
- CSP, HSTS strip (proxy domain'i bozuyor)

---

## §8 ra-egress Go Agent

**Dosya:** `ra-egress/main.go`  
**Build:** `CGO_ENABLED=0 go build -ldflags="-s -w" -o ra-egress .`  
**Image:** ~10MB (scratch base)

**Env değişkenleri:**

| Değişken | Açıklama |
|---|---|
| `EGRESS_SHARED_SECRET` | HMAC key — proxy Worker ile eşleşmeli |
| `ALLOWED_HOST_REGEX` | SSRF koruması regex, örn. `^(www\.jove\.com\|jove\.com)$` |
| `TUNNEL_TOKEN` | Cloudflare Named Tunnel token |
| `MAX_REQUEST_BYTES` | Default 10MB |

**`.env` mevcut değerleri (gitignored):**
```
EGRESS_SHARED_SECRET=5HycdKymy1sXwsICtdxrMmDd1CVjF6SUgCtTOilJIGg=
ALLOWED_HOST_REGEX=^(www\.jove\.com|jove\.com|cdn\.jove\.com|player\.jove\.com|assets\.jove\.com)$
```

**Önemli:** `ALLOWED_HOST_REGEX` içindeki `$` karakteri PowerShell here-string'de
backtick ile escape edilmeli: `` `$ `` — `tunnel-provision.ps1` düzeltildi.

---

## §9 Named Tunnel Kurulumu

**Script:** `ra-egress/tunnel-provision.ps1`

```powershell
# Tek seferlik — repo kökünden:
Set-ExecutionPolicy -Scope Process Bypass
.\ra-egress\tunnel-provision.ps1

# Farklı kurum için:
.\ra-egress\tunnel-provision.ps1 -TunnelName "sabanciuniv-ra" -EgressHost "ra-egress-sabanciuniv.selmiye.com"
```

Script adımları:
1. `cloudflared` kur (winget)
2. Cloudflare hesabına login
3. Named Tunnel oluştur (idempotent)
4. DNS CNAME ekle: `EgressHost → {tunnelId}.cfargotunnel.com`
5. Tunnel token al → `.env` yaz
6. `docker compose up --build -d`
7. D1'e `egress_endpoint` yaz

**Sonraki başlatmalar:** `docker compose up -d` — URL değişmez.

---

## §10 Portal UI (profile.html)

**Fonksiyon:** `openRemoteAccess(subscriptionId)`

```javascript
// 1. POST /api/ra/issue-token
// 2. response.redirect_url → yeni sekmede aç
// 3. iOS Safari: a.click() async sonrası popup engellenir
//    → window.location.href veya kullanıcıya tıklanabilir link göster (açık sorun)
```

**Auth:** `credentials: 'include'` — `authToken` httpOnly cookie otomatik gider.  
**API_BASE:** `''` (relative) — portal hangi domain'de çalışıyorsa oraya istek atar.

---

## §11 Staging Test Akışı (PowerShell)

```powershell
$base = "https://libedge-api-staging.agursel.workers.dev"

# 1. Login
$auth = Invoke-RestMethod "$base/api/auth/login" -Method Post `
    -Body '{"email":"...","password":"..."}' -ContentType "application/json" `
    -SessionVariable sess

# 2. Abonelik listesi
$subs = Invoke-RestMethod "$base/api/subscription/list" `
    -Headers @{Authorization="Bearer $($auth.access.token)"}

# 3. RA token
$ra = Invoke-RestMethod "$base/api/ra/issue-token" -Method Post `
    -Body "{`"subscription_id`":$($subs[0].id)}" `
    -ContentType "application/json" `
    -Headers @{Authorization="Bearer $($auth.access.token)"}

# 4. Tarayıcıda aç
Start-Process $ra.redirect_url
```

---

## §12 POC Sonuçları

### §12.1 Doğrulanan Akış (2026-04-26)

```
Portal (staging.libedge-website.pages.dev) → "Erişime Git" →
issue-token → r{sid}.selmiye.com/research?t=JWT →
Proxy Worker (302 + cookie) → r{sid}.selmiye.com/research →
egressFetch → ra-egress.selmiye.com/proxy →
www.jove.com/research → 200 ✅
```

**Kanıtlar:**
- ra-egress logları: 40+ proxied request, tümü 200
- `POST /api/ip-auth → 200` — JoVE kurum IP'sini tanıdı
- `ra_origin_landing_path='/research'` doğru çalışıyor
- Named Tunnel Docker restart'ta URL değişmiyor
- JWT HS256 signing/verification çalışıyor
- HMAC-imzalı proxy→egress iletişimi çalışıyor
- Cookie round-trip: `ra_proxy_session` strip, diğerleri forward
- Origin/Referer rewrite: `r*.selmiye.com` → `www.jove.com`

### §12.2 Yürütülen Proxy Düzeltmeleri

Bu oturumda `workers/proxy/src/index.js`'e eklenenler:

1. **Cookie forward**: Tüm cookie'ler forward, yalnızca `ra_proxy_session` strip
2. **Origin/Referer rewrite**: proxy domain → publisher origin
3. **CF runtime header strip**: `cf-connecting-ip`, `cf-ray`, `x-forwarded-for` vb.
4. **Set-Cookie multi**: `headers.getSetCookie()` destekli çoklu cookie handling
5. **Trailing slash**: `proxy-url.js` — landing path'e gereksiz `/` eklenmiyor
6. **Staging debug headers**: `X-RA-Debug-*` (yalnızca ENVIRONMENT=staging)

---

## §13 Portal UI Entegrasyonu

Portal `staging.libedge-website.pages.dev` üzerinde çalışıyor.  
Backend: Pages → `libedge-api-staging` Worker (Pages integration, `_routes.json` yok).  
`workers_dev = true` wrangler.toml `[env.staging]`'de explicit set edilmeli (routes eklenince
varsayılan olarak devre dışı kalıyor).

---

## §14 Açık Sorunlar ve Üretim Hazırlığı

### §14.1 AWS WAF Challenge — KRİTİK PRODUCTION BLOCKER ⛔

**Belirti:** `challenge.js: Max challenge attempts exceeded`  
**HTTP akışı:** browser → `r*.selmiye.com` → ra-egress → JoVE → 202 (WAF challenge)

**Teşhis (2026-04-26 debug session):**

AWS WAF (CloudFront katmanında), JoVE'nin uygulama katmanı IP auth'undan önce devreye
giriyor. Debug header'ları ile doğrulanan:

```
x-amzn-waf-action: challenge
x-ra-debug-upstream-status: 202
x-ra-debug-upstream-cookies: aws-waf-token   ← token upstream'e gidiyor ✓
x-ra-debug-upstream-referer: https://www.jove.com/research   ← rewrite doğru ✓
x-cache: Error from cloudfront
```

Yani proxy'nin cookie/header katmanı artık doğru. Sorun WAF token doğrulamasında:
ra-egress IP'si AWS WAF tarafından challenge'sız geçirilmiyor.

**Karşılaştırma — Vetis (çalışan rakip sistem):**
- Vetis proxy IP'si: `37.148.210.219`
- Vetis request → JoVE → 200 ✅
- Vetis cookie'lerinde `joveiptoken` mevcut (JoVE'nin IP auth JWT'si)
- `joveiptoken` payload: `{"ip":"88.255.172.68",...}` — Vetis sunucu IP'si

**Sonuç:** Vetis'in proxy sunucu IP'si JoVE/AWS WAF tarafından allowlist'te (ya uzun
süreli ilişki, ya explicit whitelist). `/api/ip-auth` uygulama katmanında çalışıyor, ama
AWS WAF edge'de bunu görmeden önce challenge dönüyor.

**Çözüm seçenekleri (öncelik sırasıyla):**

| # | Seçenek | Süre | Güvenilirlik |
|---|---|---|---|
| 1 | JoVE'den ra-egress sunucu IP'sini AWS WAF allowlist'e ekletmek | 1-2 hafta | ✅ En güvenli |
| 2 | RA_EGRESS_DEFAULT_SECRET yerine her kurum için ayrı egress konfigürasyonu + IP whitelist | Orta | ✅ |
| 3 | `utls` TLS fingerprint impersonation (Go) | 1-2 gün kod | ⚠️ Kırılgan |
| 4 | Headless browser (Playwright) ra-egress yanında | 3-5 gün | ⚠️ Ağır |

**Önerilen yol:** JoVE ile iletişime geç, ra-egress sunucusunun public IP'sini paylaş,
AWS WAF rule'larına eklemelerini iste. Çoğu akademik publisher bu süreci tanıyor.

### §14.2 iOS Safari Popup Blocker

**Belirti:** `a.click()` `async` fonksiyon içinde (await fetch() sonrası) iOS'ta engelleniyor.

**Konum:** `profile.html` → `openRemoteAccess()` → `a.click()`

**Çözüm:** `window.location.href = redirectUrl` (aynı sekmede açılır) veya
redirect_url'i tıklanabilir link olarak UI'da göster.

### §14.3 RA_PROXY_BASE_HOST Eksikliği

Staging `wrangler.toml`'da `RA_PROXY_HOST` var ama kod `c.env.RA_PROXY_BASE_HOST` kullanıyor.
Şu an `'selmiye.com'` fallback çalışıyor — ama explicit set edilmeli.

```toml
# workers/proxy/wrangler.toml [env.staging.vars]
RA_PROXY_BASE_HOST = "selmiye.com"
```

### §14.4 Egress Secret Yönetimi (Production)

Şu an: `RA_EGRESS_DEFAULT_SECRET` plaintext env var (tek kurum).  
Production hedef: `encryptCredential(secret, masterKey)` ile şifrelenip D1'e yazılmalı.

```javascript
// backend/src/ra/crypto.js — encryptCredential mevcut
const enc = await encryptCredential(egressSecret, env.RA_CREDS_MASTER_KEY);
// D1: UPDATE institution_ra_settings SET egress_secret_enc = ? WHERE institution_id = ?
```

### §14.5 Migration — Production D1

`migrations/0018_ra_schema_complete.sql` production D1'e uygulanmamış.
`ensureColumns` runtime'da ekliyor ama production'da explicit migration tercih edilmeli:

```powershell
npx wrangler d1 execute libedge-db-production --env production --file migrations/0018_ra_schema_complete.sql
```

### §14.6 Çoklu Kurum Onboarding

Her kurum için:
1. `tunnel-provision.ps1 -TunnelName "{kurum}-ra" -EgressHost "ra-egress-{kurum}.selmiye.com"`
2. `ALLOWED_HOST_REGEX` o kurumun yayıncı listesine göre güncelle
3. D1: `institution_ra_settings` yeni satır
4. Proxy Worker `RA_EGRESS_DEFAULT_SECRET` yerine kurum bazlı şifreli secret

---

## §15 Başka Geliştirici için Hızlı Başlangıç

```
Repo: C:\Users\OWNER\Documents\GitHub\libedge-website

Kritik dosyalar:
  workers/proxy/src/index.js          ← Proxy Worker (session_host_proxy + path_proxy)
  workers/proxy/src/egress-client.js  ← HMAC imzalama + RA_EGRESS_DEFAULT_SECRET fallback
  backend/src/routes/ra/issue-token.js ← Token üretimi
  backend/src/ra/jwt.js               ← HS256 sign/verify
  backend/src/ra/schema.js            ← ensureRemoteAccessSchema
  ra-egress/main.go                   ← Go egress agent
  profile.html                        ← Portal UI

Bilinen çalışan durum (2026-04-26):
  - Staging portal → session_host_proxy → r*.selmiye.com ✅
  - ra-egress tunnel → ra-egress.selmiye.com ✅
  - JoVE /api/ip-auth → 200 (kurum IP tanınıyor) ✅
  - JoVE içerik sayfaları → AWS WAF 202 challenge (üretim blocker) ⛔

Sonraki adım: JoVE'den IP whitelist al veya §14.1 seçeneklerine bak.
```
