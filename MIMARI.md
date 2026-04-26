# LibEdge — Remote Access Platform Mimarisi

> Son güncelleme: 2026-04-26  
> Durum: Staging'de aktif · Mobil erişim uçtan uca çalışıyor ✅

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

slug='emis'
  ra_delivery_mode = 'session_host_proxy'
  ra_origin_landing_path = '/php/login/redirect'
  ra_origin_host = 'www.emis.com'
  ra_host_allowlist_json = '["www.emis.com","emis.com","cas.emis.com","auth.emis.com","m.emis.com"]'
  ra_enabled = 1

slug='acs'
  ra_delivery_mode = 'session_host_proxy'
  ra_origin_landing_path = '/'
  ra_origin_host = 'pubs.acs.org'
  ra_host_allowlist_json = '["pubs.acs.org","acs.org","www.acs.org","idp.acs.org"]'
  ra_enabled = 0  -- staging config hazır, ACS Cloudflare challenge 403 nedeniyle pasif

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
  │  - Origin/Referer rewrite: r*.selmiye.com → publisher origin
  │  - egressFetch() → ra-egress.selmiye.com/proxy
  ▼
[ra-egress (Go, Named Tunnel)]
  │  - X-RA-Signature HMAC-SHA256 verify
  │  - ALLOWED_HOST_REGEX kontrol (SSRF koruması)
  │  - net/http → publisher allowlist host (kurum IP'siyle)
  │  - Response stream
  ▼
[Publisher]
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

### Upstream'e gönderilen (browser → publisher):
- Tüm browser cookie'leri **ra_proxy_session hariç** (aws-waf-token, cf_clearance, joveiptoken vb.)
- Origin ve Referer → `r*.selmiye.com` → publisher origin olarak rewrite
- Cloudflare runtime header'ları strip: `cf-connecting-ip`, `cf-ray`, `x-forwarded-for`, `cdn-loop` vb.
- Ürün bazlı override: EMIS için upstream'e desktop User-Agent / Client Hints gönderilir

### Publisher'dan gelen response:
- Set-Cookie → domain `r*.selmiye.com`, path `/` olarak rewrite
- `getSetCookie()` destekli çoklu Set-Cookie işleme
- Location → `r*.selmiye.com` subdomain'e rewrite
- CSP, HSTS strip (proxy domain'i bozuyor)

### Multi-host publisher routing

Bazı yayıncılar tek hostta kalmaz; örn. EMIS akışı:

```
www.emis.com/php/login/redirect → www.emis.com/php/emiscom/registered →
cas.emis.com/login → www.emis.com/v2/app/auth → www.emis.com/v2/
```

`session_host_proxy` modunda primary host normal path'te kalır:

```
https://r{sid}.selmiye.com/v2/
```

Allowlist'teki alternatif hostlar encoded prefix altında taşınır:

```
https://r{sid}.selmiye.com/__ra-host/cas-emis-com/login
https://r{sid}.selmiye.com/__ra-host/m-emis-com/api/
```

Bu sayede CAS/auth/mobile host geçişleri aynı `ra_proxy_session` altında kalır, ama
SSRF sınırı `products.ra_host_allowlist_json` ile korunur.

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
- Mobil (WiFi'sız) erişimde JoVE kurum IP'si (159.20.68.12) görüyor ✅ — paywall yok
- `ra_origin_landing_path='/research'` doğru çalışıyor
- Named Tunnel Docker restart'ta URL değişmiyor
- JWT HS256 signing/verification çalışıyor
- HMAC-imzalı proxy→egress iletişimi çalışıyor
- Cookie round-trip: `ra_proxy_session` strip, diğerleri forward
- Origin/Referer rewrite: `r*.selmiye.com` → `www.jove.com`
- iOS Safari'de yeni sekme açılıyor (popup blocker aşıldı)

### §12.2 Yürütülen Proxy Düzeltmeleri

Bu oturumda `workers/proxy/src/index.js`'e eklenenler:

1. **Cookie forward**: Tüm cookie'ler forward, yalnızca `ra_proxy_session` strip
2. **Origin/Referer rewrite**: proxy domain → publisher origin
3. **CF runtime header strip**: `cf-connecting-ip`, `cf-ray`, `x-forwarded-for` vb.
4. **Set-Cookie multi**: `headers.getSetCookie()` destekli çoklu cookie handling
5. **Trailing slash**: `proxy-url.js` — landing path'e gereksiz `/` eklenmiyor
6. **Staging debug headers**: `X-RA-Debug-*` (yalnızca ENVIRONMENT=staging)
7. **Redirect manual**: Proxy Worker → ra-egress fetch `redirect: 'manual'`  
   → EMIS gibi ara `302 + Set-Cookie` kullanan akışlarda cookie kaybı engellendi.
8. **Multi-host session routing**: `__ra-host/{encoded-host}` prefix'i  
   → `cas.emis.com`, `auth.emis.com`, `m.emis.com` gibi hostlar tek session altında proxylanır.
9. **EMIS mobile config rewrite**: `m.emis.com/config/application*.js` içindeki
   absolute API originleri `r*.selmiye.com/__ra-host/m-emis-com/...` adreslerine çevrilir.
10. **EMIS desktop-UA override**: Mobil cihazdan gelen EMIS isteklerinde upstream'e desktop
    browser kimliği gönderilir; EMIS böylece çalışan `/v2/` CAS akışına yönlenir.

### §12.3 Yürütülen ra-egress Düzeltmeleri

Bu oturumda `ra-egress/main.go`'ya eklenenler:

1. **HTTP/2 devre dışı**: `TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{}`  
   → Go'nun HTTP/2 SETTINGS frame fingerprint'i AWS WAF tarafından bot olarak sınıflandırılıyordu.  
   → HTTP/1.1 ile `/_waf-probe → 200` ✅

2. **IPv4 zorla**: `DialContext: tcp4`  
   → Docker container default outbound IPv6 kullanabilir; kurum IP'si IPv4 (159.20.68.12).

3. **IP-ifşa header filtreleme**: `isIPRevealingHeader()` header loop'a eklendi  
   → `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, `CF-Ray`, `CF-Connecting-IPv6` vb.  
   → JoVE artık mobil kaynak IP yerine yalnızca egress container IP'sini (kurum IP'si) görüyor.

4. **Redirect takip etmeme**: `CheckRedirect: http.ErrUseLastResponse`  
   → ara `302` yanıtları Proxy Worker'a döner; `Set-Cookie` ve `Location` Worker tarafından
   rewrite edilip tarayıcıya iletilir. EMIS session cookie kaybı bu şekilde çözüldü.

5. **Healthcheck modu**: `/ra-egress --healthcheck`  
   → scratch image içinde `wget` bağımlılığı olmadan Docker healthcheck çalışır.

### §12.4 Ürün Bazlı Doğrulama — EMIS (2026-04-26)

**D1 konfigürasyonu:**

```sql
slug='emis'
  ra_origin_host = 'www.emis.com'
  ra_origin_landing_path = '/php/login/redirect'
  ra_delivery_mode = 'session_host_proxy'
  ra_host_allowlist_json = '["www.emis.com","emis.com","cas.emis.com","auth.emis.com","m.emis.com"]'
```

**Kritik akış:**

```
Portal → r{sid}.selmiye.com/php/login/redirect?t=JWT →
www.emis.com/php/login/redirect → 302 →
www.emis.com/php/emiscom/registered → 302 →
cas.emis.com/login → 302 →
www.emis.com/v2/app/auth?token=... → 302 →
www.emis.com/v2/ → 200 ✅
```

**Kanıtlar:**
- Desktop kurum dışı erişim: `/v2/app/user?timezone=Europe%2FIstanbul → 200`
- Mobil WiFi kapalı erişim: desktop `/v2/` arayüzü açılıyor ✅
- `m.emis.com/api/` mobile fallback çağrıları proxylenebiliyor; ancak EMIS mobile API 401 döndüğü
  için EMIS'e özel desktop-UA override ile çalışan CAS `/v2/` akışı tercih edildi.
- `ra-egress` kurum IP'siyle çıkıyor; EMIS IP tabanlı auth kurum içinde doğrulandı.

---

## §13 Portal UI Entegrasyonu

Portal `staging.libedge-website.pages.dev` üzerinde çalışıyor.  
Backend: Pages → `libedge-api-staging` Worker (Pages integration, `_routes.json` yok).  
`workers_dev = true` wrangler.toml `[env.staging]`'de explicit set edilmeli (routes eklenince
varsayılan olarak devre dışı kalıyor).

---

## §14 Açık Sorunlar ve Üretim Hazırlığı

### §14.1 AWS WAF Challenge — ✅ ÇÖZÜLDÜ (2026-04-26)

**Belirti:** `challenge.js: Max challenge attempts exceeded`  
**Kök neden:** Go'nun HTTP/2 istemci SETTINGS/HEADERS frame sıralaması AWS WAF tarafından
"non-browser" fingerprint olarak sınıflandırılıyordu.

**Uygulanan çözüm (`ra-egress/main.go`):**

```go
Transport: &http.Transport{
    // HTTP/2 devre dışı — Go h2 fingerprint AWS WAF'ı tetikliyordu
    TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{},
}
```

**Doğrulama:** `/_waf-probe → 200` ✅ — AWS WAF artık HTTP/1.1 isteği challenge'lamıyor.

**Not — Vetis mimarisi:** Vetis forward proxy modelini kullanıyor (browser TLS doğrudan
JoVE'ye); AWS WAF browser TLS fingerprint'ini görüyor. Bizim çözümümüz farklı ama eşdeğer
sonuç veriyor (HTTP/1.1 fingerprint nötr).

### §14.2 iOS Safari Popup Blocker — ✅ ÇÖZÜLDÜ (2026-04-26)

**Belirti:** `a.click()` `async` fonksiyon içinde (await fetch() sonrası) iOS Safari'de
engelleniyor; yeni sekme açılmıyordu.

**Kök neden:** iOS Safari `window.open()` / `a.click()`'i yalnızca senkron kullanıcı
gesture context'inde izin veriyor; `async` fonksiyon içinde `await` sonrasında engelliyor.

**Uygulanan çözüm (`profile.html`):**

```javascript
// await'ten ÖNCE sekme aç (senkron gesture context'inde)
const newTab = window.open('', '_blank');
try {
    const res = await fetch(`${API_BASE}/api/ra/issue-token`, { ... });
    // ...
    if (newTab) {
        newTab.location.href = redirectUrl;  // fetch sonrası URL set et
    } else {
        window.location.href = redirectUrl;   // fallback: aynı sekme
    }
} catch (err) {
    if (newTab) newTab.close();
    // hata göster
}
```

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
  - JoVE içerik sayfaları → paywall yok, içerik açılıyor ✅
  - Mobil (WiFi'sız) erişim → JoVE kurum IP (159.20.68.12) görüyor ✅
  - EMIS CAS akışı → /v2/ desktop arayüzü açılıyor ✅
  - EMIS mobil cihaz → desktop-UA override ile /v2/ açılıyor ✅
  - iOS Safari → yeni sekme açılıyor ✅
  - AWS WAF → HTTP/1.1 fingerprint ile bypass ✅

Sonraki adım: Production D1 migration (§14.5), egress secret yönetimi (§14.4) ve
çoklu kurum onboarding (§14.6).
```

---

## §16 Yeni Ürün Onboarding Reçetesi

Yeni bir IP-auth yayıncı ürünü eklerken önce kurum IP'sinden doğrudan davranış doğrulanır,
sonra aynı akış proxy altında çoğaltılır.

### §16.1 Gerekli D1 Alanları

```sql
UPDATE products
SET
  ra_enabled = 1,
  ra_delivery_mode = 'session_host_proxy',
  ra_origin_host = '{primary-host}',
  ra_origin_landing_path = '{entry-path}',
  ra_host_allowlist_json = '["{primary-host}","{auth-host}", "..."]',
  ra_requires_tunnel = 1
WHERE slug = '{product-slug}';
```

`ra_origin_landing_path` mümkün olduğunca yayıncının IP-auth başlatan gerçek giriş yolu
olmalı. EMIS için bu `/php/login/redirect`; JoVE için `/research`.

### §16.2 Kontrol Listesi

1. Kurum IP'sinden incognito test: entry URL hangi son URL'e gidiyor?
2. DevTools Network: `302 Location`, `Set-Cookie`, auth/CAS hostları not edilir.
3. `ra_host_allowlist_json`: yalnızca akışta gereken hostlar eklenir.
4. `ra-egress/.env ALLOWED_HOST_REGEX`: aynı hostları kapsıyor mu?
5. Proxy test: `X-RA-Debug-Upstream-Status`, `X-RA-Debug-Upstream-Location`,
   `X-RA-Debug-Set-Cookies` header'ları kontrol edilir.
6. Mobil test: yayıncı mobil hosta zorla yönlendiriyorsa desktop-UA override gerekip
   gerekmediği değerlendirilir.
7. Başarılı sayfa yüklemesi yetmez; gerçek kullanıcı endpoint'i 200 dönmeli
   (`/api/user`, `/app/user`, `/ip-auth` vb.).

### §16.3 Ürün Bazlı Özel Durumlar

| Ürün | Özel davranış | Çözüm |
|---|---|---|
| JoVE | AWS WAF HTTP/2 fingerprint challenge | `ra-egress` HTTP/2 kapalı |
| JoVE | Mobil kaynak IP header'ları | IP-ifşa header'ları strip |
| EMIS | Ara `302 + Set-Cookie` kaybı | Worker→egress `redirect: 'manual'` |
| EMIS | CAS/auth multi-host akışı | `__ra-host/{encoded-host}` routing |
| EMIS | Mobil app API 401 | EMIS için desktop-UA override |
| EMIS | Mobile config absolute API URL | `application*.js` URL rewrite |
| ACS | Cloudflare challenge 403 (`pubs.acs.org`) | Staging config hazır, ürün pasif; mevcut Go egress ile çözülmedi |

### §16.4 ACS Bulgusu (2026-04-26)

ACS Publications için staging D1 kaydı hazırlandı:

```sql
slug='acs'
  ra_origin_host = 'pubs.acs.org'
  ra_origin_landing_path = '/'
  ra_delivery_mode = 'session_host_proxy'
  ra_host_allowlist_json = '["pubs.acs.org","acs.org","www.acs.org","idp.acs.org"]'
```

`ra-egress` allowlist regex'ine ACS hostları eklendi ve container yeniden başlatıldı.
İmzalı egress smoke test:

```
GET https://pubs.acs.org/ → 403
server: cloudflare
body: "Just a moment..."
```

Sonuç: ACS config/allowlist tarafı hazır, ancak upstream Cloudflare challenge mevcut Go egress
isteğini kabul etmiyor. Bu JoVE/EMIS'teki cookie, redirect veya allowlist sınıfı bir sorun değil.
Kırık ürün göstermemek için staging D1'de `acs.ra_enabled = 0` ve kurum aboneliği `inactive`
durumunda bırakıldı.
