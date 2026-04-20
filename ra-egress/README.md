# ra-egress — Kurum-içi Egress Agent

LibEdge Uzaktan Erişim platformunun kurum-tarafı bileşeni.

## Ne yapar?

Kurumunuzun yayıncı (publisher) aboneliklerine kurum dışından güvenli erişim için
gerekli olan **tek şey**: Publisher tarafından whitelist'lenmiş kurum IP'nizden
çıkan bir proxy. Bu agent tam olarak onu yapar — kurum ağınızda çalışır, trafik
kurumunuzun gerçek internet IP'sinden yayıncıya ulaşır.

- **Inbound port açmak gerekmez** — Cloudflare Tunnel (cloudflared) sayesinde
  bağlantı sadece *outbound* 443.
- **Kaynak tüketimi düşük** — Raspberry Pi 4 (2GB RAM) yeter.
- **Ek abonelik yok** — Cloudflare Tunnel ücretsiz, LibEdge size tünel token'ı verir.

## Gereksinimler

- Docker ve Docker Compose (en kolay: [Docker Desktop](https://docs.docker.com/get-docker/) veya Linux'ta `apt install docker.io docker-compose-plugin`)
- Çalışan bir makine (RPi, eski PC, VM) — 7/24 açık olmalı
- Kurum internet bağlantısı (outbound 443 HTTPS)
- LibEdge admin panelinizden alacağınız üç değer:
  - `TUNNEL_TOKEN`
  - `EGRESS_SHARED_SECRET`
  - `ALLOWED_HOST_REGEX` (LibEdge önceden dolduruyor, değiştirmeniz gerekmez)

## Kurulum (5 dakika)

1. Bu klasördeki dosyaları sunucunuza kopyalayın:

   ```
   docker-compose.yml
   .env.example
   ```

2. `.env.example` dosyasını `.env` olarak kopyalayıp içini LibEdge admin panelinden aldığınız değerlerle doldurun:

   ```
   TUNNEL_TOKEN=ey...            # uzun base64 string
   EGRESS_SHARED_SECRET=...      # 32 byte random
   ALLOWED_HOST_REGEX=...        # örn: ^(www\.)?sciencedirect\.com$
   ```

3. Başlatın:

   ```
   docker compose up -d
   ```

4. LibEdge admin panelinde kurum sayfanızda **"Tüneli Test Et"** butonuna basın.
   Yeşil tik (🟢 Bağlı) gördüğünüzde hazırsınız.

## Yönetim

Durdur: `docker compose down`
Loglara bak: `docker compose logs -f`
Güncelleme: `docker compose pull && docker compose up -d`

Platformu geçici olarak devre dışı bırakmak için: `docker compose down`
→ LibEdge kullanıcıları "Kurum erişim sunucusu şu anda kapalı" uyarısı görür,
veri kaybı olmaz.

## Güvenlik

- **HMAC imza:** Yalnızca LibEdge Worker'ından imzalanmış istekler kabul edilir.
- **Host allowlist:** `ALLOWED_HOST_REGEX`'te listelenen publisher'lar dışına çıkış
  engellidir — kurum iç ağınıza SSRF yapılamaz.
- **Boyut ve timeout limitleri:** Request 10MB, timeout 30sn varsayılan.
- **No privileged mount:** Container'lar host dosya sistemine erişmez.

## Sık Sorulan Sorular

**Q: RPi yeterli mi?**
A: Evet. 2GB RAM, cloudflared ~50MB, ra-egress ~10MB. Yaklaşık 100 eşzamanlı kullanıcıyı idare eder.

**Q: Başka bir port açmam gerekiyor mu?**
A: Hayır. Sadece outbound 443 HTTPS yeterli. Tünel kurumdan dışarı bağlantı kurar.

**Q: Trafiğim kimden görünür?**
A: Yayıncı (publisher) kurumunuzun gerçek IP'sini görür — tıpkı bir öğrenci kampüsten erişiyormuş gibi. Dolayısıyla publisher'a yeni whitelist başvurusu gerekmez.

**Q: LibEdge trafiği görüyor mu?**
A: Evet — metadata seviyesinde (hangi kullanıcı, hangi kaynak, ne zaman). Credential ve publisher session cookie'leri AES-GCM ile şifreli saklanır. Gerçek makale içeriği LibEdge'de kalmaz.

**Q: Birden fazla bina/ağda aynı kurum, birden fazla agent kurabilir miyim?**
A: Şu anda tek tünel destekli — aynı kurum için bir tane yeterli. Yüksek erişilebilirlik için failover ileride eklenecek.

## Sorun Giderme

- **"Tüneli Test Et" kırmızı:** `docker compose logs cloudflared` → TUNNEL_TOKEN doğru mu?
- **Publisher 403:** `ALLOWED_HOST_REGEX` yayıncı hostname'ini kapsıyor mu? LibEdge admin panelinden kontrol edin.
- **Publisher 401/login:** Kurum credential'ı LibEdge admin panelinde güncel mi?

Destek: `support@libedge.com`
