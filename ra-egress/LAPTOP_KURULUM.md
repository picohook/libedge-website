# Kurumda Kalacak Laptop Kurulumu

Bu paket yalnız LibEdge RA egress agent'ı çalıştırmak içindir. Ana LibEdge
backend/frontend projesini bu laptop'a koymak gerekmez.

## Ne Kopyalanır?

Paket içinde yalnız şu klasörler bulunur:

- `ra-egress/`: kurum IP'sinden publisher'a çıkış yapan Go agent
- `ra-browser/`: WAF/browser gerektiren publisher akışları için Chromium servis

Kopyalanmaması gerekenler:

- Repo kökündeki `.env`
- `ra-egress/.env`
- `.env.backup`, `.env.before-recovery`
- `ra-egress.exe` veya lokal binary çıktıları
- D1 export/backups, Wrangler state, GitHub credential veya production secret'ları

## Laptop Hazırlığı

1. Laptop kurum ağına bağlı kalmalı.
2. Güç ayarlarında uyku/hibernation kapalı olmalı.
3. Docker Desktop kurulmalı ve açılışta çalışacak şekilde ayarlanmalı.
4. Mümkünse Ethernet kullanılmalı.
5. Windows Update otomatik restart saatleri kontrol edilmeli.

## En Kolay Kurulum

Paket klasörünü kurum laptop'ına kopyalayın.

Paket kökündeki `KIT-MANIFEST.txt` dosyasını kontrol edin. Dosyada kaynak commit
ve aşağıdaki runtime marker beklentisi görünmelidir:

```text
Chromium launched (channel=chrome, wiley-cold-bootstrap=1)
```

```powershell
cd ra-egress
.\KURULUM-BASLAT.ps1
```

Script sizden gereken değerleri sorar, `.env` dosyasını oluşturur ve Docker
servislerini başlatır.

Gereken değerler:

- `TUNNEL_TOKEN`
- `EGRESS_SHARED_SECRET`
- `LIBEDGE_API_URL`
- `LIBEDGE_SERVICE_KEY` (yoksa boş bırakılabilir)
- `ALLOWED_HOST_REGEX` (varsayılan JoVE hostlarıyla gelir)

`.env` zaten hazırlanmışsa script onu kullanır ve sadece servisleri başlatır.

Manuel başlatmak isterseniz:

```powershell
docker compose up --build -d
```

## Kontrol

```powershell
docker compose ps
docker compose logs --tail 80 cloudflared
docker compose logs --tail 80 ra-egress
```

LibEdge admin panelinde:

1. Uzaktan Erişim > Kurum Tünelleri
2. İlgili kurum
3. `egress_endpoint` doğru mu kontrol edin.
4. `Tüneli Test Et` çalıştırın.

Yeşil sonuç geldiyse, başka şehirden LibEdge'e giren kullanıcı trafiği yayıncıya
kurum IP'sinden çıkabilir.

## Günlük Kullanım

Başlat:

```powershell
docker compose up -d
```

Durdur:

```powershell
docker compose down
```

Log:

```powershell
docker compose logs -f
```

## Güvenlik Notu

`.env` dosyası secret içerir. Bu dosyayı e-posta, GitHub veya ortak klasörle
paylaşmayın. Laptop kaybolursa veya yetkisiz erişim şüphesi olursa:

1. Cloudflare tunnel token'ı iptal edin.
2. `EGRESS_SHARED_SECRET` değerini rotate edin.
3. Admin panelde kurum egress ayarını geçici olarak kapatın.
