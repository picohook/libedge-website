# RA Production Readiness Guide

Bu belge LibEdge Remote Access'in staging POC'den production kullanıma geçişinde
gerekli operasyonel kararları ve kurum onboarding gereksinimlerini özetler.

## 1. Domain Taşıma

Hedef domain `libedge.com` olduğunda RA tarafında üç hostname sınıfı gerekir:

| Amaç | Mevcut | Hedef örnek |
|---|---|---|
| Portal | `staging.libedge-website.pages.dev` | `app.libedge.com` veya `www.libedge.com` |
| Path proxy | `proxy.selmiye.com` | `proxy.libedge.com` |
| Session host proxy | `r{sid}.selmiye.com` | `r{sid}.libedge.com` |
| Kurum egress tunnel | `ra-egress-{kurum}.selmiye.com` | `ra-egress-{kurum}.libedge.com` |
| Dosya/R2 host | `files.selmiye.com` | `files.libedge.com` |

Production'a geçmeden önce:

1. Cloudflare zone `libedge.com` altında yönetilir hale gelmeli.
2. Proxy Worker route'ları eklenmeli:
   - `proxy.libedge.com/*`
   - `*.libedge.com/*`
3. `*.libedge.com` Universal SSL/SaaS SSL kapsamı doğrulanmalı.
4. Main Worker env:
   - `RA_PROXY_HOST=proxy.libedge.com`
   - `RA_PROXY_BASE_HOST=libedge.com`
5. Proxy Worker env:
   - `RA_PROXY_BASE_HOST=libedge.com`
   - `RA_EGRESS_HOST=ra-egress-{kurum}.libedge.com` yalnız tek kurum fallback kullanılıyorsa
   - `RA_FILES_HOST=files.libedge.com`
6. Egress tunnel DNS kayıtları `{tunnelId}.cfargotunnel.com` CNAME olarak yeni zone'a taşınmalı.
7. Hardcoded eski domain kalmaması için kontrol:
   - `rg -n "selmiye.com|libedge-website.pages.dev|agursel.workers.dev"`

Not: `session_host_proxy` modu wildcard route olmadan çalışmaz. Bu route production
öncesi blocker'dır.

## 2. Kurumdan İstenecekler

Kurumun yayıncılardan yeni bir izin istemesine gerek yoktur. Ama LibEdge egress
agent kurum ağında çalışacağı için kurumdan şu bilgiler ve hazırlık istenir:

| Gereksinim | Açıklama |
|---|---|
| Teknik sorumlu | Kurulum ve log kontrolü için bir IT yetkilisi |
| Kurum public IP veya IP aralığı | Doğrulama ve publisher erişim testi için |
| 7/24 açık makine | VM, mini PC veya sunucu |
| Outbound HTTPS | `cloudflared` için dışarıya TCP 443 erişimi |
| Docker | `ra-egress` ve `cloudflared` container'ları için |
| Aktif ürün listesi | Kurumun erişim vermek istediği publisher ürünleri |
| Test kullanıcı hesabı | Portal akışını kurum dışından doğrulamak için |

Inbound port açılmaz. Kurum firewall'ında yalnız outbound 443 gerekir.

## 3. Kurum İçi Makine Gereksinimleri

Minimum:

- 1 vCPU
- 512 MB RAM
- 2 GB boş disk
- Docker Engine + Docker Compose plugin
- Outbound DNS + HTTPS

Önerilen:

- 2 vCPU
- 2 GB RAM
- Otomatik reboot sonrası Docker servislerinin başlaması
- Log rotasyonu
- Sabit kurum internet çıkışı

Linux önerilir; Windows Server veya Docker Desktop çalışan Windows makine de olur.
Raspberry Pi 4 sınıfı cihaz teknik olarak yeterlidir, ama production kurumlar için
VM veya küçük sunucu daha yönetilebilir.

## 4. Kurum Kurulum Akışı

LibEdge tarafı:

1. Kurum kaydı oluşturulur.
2. `institution_ra_settings` için egress endpoint ve secret hazırlanır.
3. Kuruma `docker-compose.yml`, `.env` değerleri ve kurulum komutu verilir.
4. Kurum aktif ürünleri `institution_subscriptions` altında açılır.
5. Admin panelinden "Tüneli Test Et" çalıştırılır.

Kurum tarafı:

1. Docker kurulur.
2. LibEdge'in verdiği `.env` dosyası aynı klasöre konur.
3. `docker compose up -d` çalıştırılır.
4. `docker compose logs -f cloudflared` ile tünelin bağlandığı doğrulanır.
5. LibEdge test kullanıcısı mobil ağdan veya kurum dışından ürün erişimini dener.

Örnek `.env`:

```dotenv
TUNNEL_TOKEN=ey...
EGRESS_SHARED_SECRET=...
ALLOWED_HOST_REGEX=^(www\.jove\.com|jove\.com|www\.emis\.com|emis\.com)$
```

## 5. Ürün Kapasitesi

Ürün sayısı için pratik limit uygulama tarafında düşük değildir. Her ürün bir
`products` satırı ve allowlist/recipe metadata'sıdır.

Beklenen ölçek:

| Alan | Güvenli başlangıç kapasitesi |
|---|---:|
| Ürün kataloğu | 1.000+ ürün |
| Kurum başına aktif ürün | 100-300 ürün |
| Toplam kurum abonelik satırı | 100.000+ satır |
| RA-ready IP publisher | Yüzlerce |

Gerçek limit teknik olmaktan çok operasyondur:

- Her ürünün host allowlist'i doğru çıkarılmalı.
- Bazı publisher'lar Cloudflare/AWS WAF/SPA özel davranışı ister.
- Ürünlerin bir kısmı kurumda abonelikli olmayabilir; bu normaldir, sadece o
  kurum için subscription aktif edilmez.

## 6. Kullanıcı ve Kurum Kapasitesi

Cloudflare Workers concurrency modelinde portal/proxy katmanı yatay ölçeklenir.
Başlangıçta dar boğaz kurum içindeki egress makinesi ve kurumun internet çıkışıdır.

Yaklaşık kapasite varsayımları:

| Bileşen | Başlangıç tahmini |
|---|---:|
| Kurum sayısı | 100-1.000 kurum |
| Kullanıcı hesabı | 50.000-200.000 |
| Günlük RA oturumu | 10.000-100.000 |
| Tek kurum egress eşzamanlı kullanıcı | 50-200 |
| Tek küçük VM egress throughput | Kurum uplink ve publisher yanıtına bağlı |

Kapasiteyi belirleyen ana faktörler:

- Publisher sayfalarının ağırlığı (video, PDF, SPA assetleri)
- Kurum uplink bant genişliği
- `ra-egress` container CPU/RAM
- Cloudflare D1/KV günlük okuma-yazma kotaları
- Log saklama süresi

İlk production için öneri:

1. Kurum başına tek egress agent.
2. Yoğun kurumlarda 2 vCPU / 2 GB RAM VM.
3. `ra_access_logs` için retention politikası.
4. Ağır video ürünlerinde kurum bazlı bant genişliği ölçümü.

## 7. Ürün Onboarding Önceliği

Domain taşınmadan önce yeni ürün onboarding UI büyütülmemeli. Öncelik:

1. `libedge.com` domain ve wildcard proxy route.
2. Kurum egress kurulum rehberi ve destek akışı.
3. Toplu ürün ekleme/import akışı.
4. Recipe template'lerini dropdown/seçilebilir hale getirme.
5. Yeni ürün ekleme flow'unu batch import ile aynı doğrulama kurallarına bağlama.

### Toplu Ürün Ekleme Taslağı

Toplu ekleme için tek kaynak CSV/TSV veya admin paste modalı olabilir. İlk sürümde
şu kolonlar yeterli:

```text
slug, name, category, default_access_type, default_access_url,
ra_enabled, ra_origin_host, ra_delivery_mode, ra_origin_landing_path,
ra_host_allowlist_json
```

IP kontrollü publisher için tipik satır:

```text
default_access_type=ip
ra_enabled=1
ra_origin_host=publisher.example.com
ra_delivery_mode=session_host_proxy
```

Direkt link ürünleri için:

```text
default_access_type=direct
default_access_url=https://...
ra_enabled=0
```

Import davranışı:

- Mevcut slug varsa varsayılan olarak hata/skip; açık `update_existing` olmadan ezmez.
- `ra_origin_host` hostname olarak normalize edilir, URL kabul edilirse host kısmı alınır.
- `ra_host_allowlist_json` boşsa origin host tek başına yeterlidir.
- Import sonrası ürünler admin product modalında normal şekilde düzenlenebilir.

## 8. Source Of Truth

`MIMARI.md` as-built belge olarak tutulur. RA şeması veya delivery mode değiştiğinde
aynı commit içinde şu dosyalar kontrol edilir:

- `MIMARI.md`
- `wrangler.toml`
- `workers/proxy/wrangler.toml`
- `backend/src/ra/schema.js`
- `backend/src/routes/ra/*`
- `test/ra/*`

`ra_delivery_mode` geçerli değerleri yalnız:

- `session_host_proxy`
- `path_proxy`

Legacy `proxy` ve `direct_login` sadece migration/normalization katmanında okunur
ve `path_proxy` olarak saklanır.

## 9. 2026-04-29 Operasyonel Güncelleme

Bugünkü staging değişiklikleri:

- Admin işlemlerinde audit/geri alma eklendi:
  - ürün update
  - abonelik update/delete
  - kurum aboneliği update/delete
  - kurum update
  - hızlı "Geri al" ve işlem geçmişinden "Geri yükle"
- Proxy hata sayfası LibEdge markalı ve güvenli hale getirildi; ham `err.message`
  kullanıcıya gösterilmiyor.
- Proxy katmanına KV fixed-window rate limit eklendi:
  - session: 300 istek/dk
  - kurum: 5000 istek/dk
  - limit aşımı: `429` + `Retry-After`
- Main Worker cron heartbeat eklendi. Her 5 dakikada aktif egress endpoint'leri
  `/health` üzerinden kontrol edip `tunnel_status` ve `tunnel_last_seen` alanlarını
  günceller.
- Admin oturum yenileme ve kurum arama/filtreleme tarafında staging sorunları
  giderildi; Türkçe karakterli arama ve `tunnel_last_seen` tipi daha toleranslı.
- Test kapsamı genişledi: error page, proxy rate limit, tunnel health.

Kalan production işleri:

- Limit değerleri production trafik ölçümüne göre env üzerinden kalibre edilecek.
- Tünel heartbeat sonuçları admin panelde uyarı/badge davranışına bağlanacak.
- Toplu ürün import UI/API eklenecek.
