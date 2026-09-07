# Workflow

LibEdge repo'sunda günlük çalışma için güncel kısa akış:

## Şema

```text
Dosya değişti
  -> git status / git diff
  -> ilgili ekran veya akışı test et
  -> git add ...
  -> git commit -m "..."
  -> git branch --show-current
  -> git push origin <branch>
  -> CI / staging deploy / smoke sonucu kontrol et
```

## Ne Zaman Ne Yapılır

| Durum | Yapılacak |
|---|---|
| AI veya sen dosya değiştirdi | `git status --short` |
| Tam olarak ne değiştiğini görmek istiyorsun | `git diff --name-only` ve gerekirse `git diff` |
| Davranışı doğrulamak istiyorsun | staging veya preview üzerinde smoke test |
| Asıl staging hattını güncellemek istiyorsun | `staging` branch'e push/deploy |
| Production migration/deploy istiyorsun | önce Production Infrastructure Preflight + migration list + rollback yolu |
| Frontend HTML/JS güvenlik değişikliği yaptın | parse kontrolü + `git diff --check`; kullanıcı/server verisi ham `innerHTML` içine girmemeli |
| KVKK kullanıcı silme değişikliği yaptın | D1 policy testi + gerekiyorsa R2 purge E2E |
| Secret/config değiştirdin | değeri repoya/loga yazmadan environment ve required-secret guardrail'ini doğrula |
| Sistem Sağlığı değişikliği yaptın | super-admin 200 + normal admin 403 + anonymous 401; response no-store ve PII/secret içermemeli |

## Ortam Ayrımı

- Local/default Worker: `libedge-api-local`.
- Staging Worker: `libedge-api-staging`.
- Production Worker: `libedge-api-prod`.
- Kaynak kod local ve staging'de aynı branch/commit olmalıdır.
- Normal `npx wrangler dev` D1/R2/KV binding'lerini yerelde simüle eder; staging verisine otomatik bağlanmaz.
- Remote kaynağa yalnız açık seçimle gidilir: `remote = true`, `wrangler dev --remote` veya ilgili CLI komutunda `--remote`.
- Local D1 işlemleri için `--local` kullanılır.
- Staging D1 işlemleri için `--remote --env staging` açıkça kullanılır.
- Production D1/R2/KV tamamen ayrı kaynaklardır ve production workflow'ları dışında doğrudan kullanılmamalıdır.

Örnek:

```powershell
# Local-only D1
npx wrangler d1 execute libedge-db --local --command "SELECT 1;"

# Gerçek staging D1 - bilinçli remote işlem
npx wrangler d1 migrations list libedge-db --remote --env staging
```

## CI/CD

- `ci.yml`: syntax, lint, test ve CSS build kalite kapısı.
- `deploy-workers.yml`: staging Worker otomatik; production Worker manuel.
- `deploy-pages.yml`: staging Pages deploy; production Pages manuel.
- `staging-smoke.yml`: auth, files ve frontend browser smoke.
- `d1-migrations.yml`: D1 list/apply; production apply öncesi şema kontrolü ve Time Travel bookmark.
- `production-preflight.yml`: production'a yazmadan secret isimleri, D1, Time Travel, R2, KV ve config dry-run kontrolü.

## Migration Kuralları

- Staging ve production D1'in aynı migration seviyesinde olduğu **asla varsayılmaz**.
- Her apply öncesi `migrations list` okunur.
- Staging'de 7 Eylül 2026 itibarıyla `0046_add_ai_product_cards.sql` ve `0047_user_deletion_integrity.sql` uygulanmıştır.
- Production migration seviyesi production preflight gününde ayrıca doğrulanır.
- Production'a bu stabilizasyon çalışması sırasında migration uygulanmamıştır.
- D1 rollback için öncelik forward-fix; gerektiğinde Time Travel bookmark kullanılır.
- Production kişisel veri export'u rutin GitHub Actions artifact'ı olarak saklanmaz.

## Smoke Kuralları

- Auth değişikliklerinde başarılı login + profile + refresh + logout + 401/403 senaryoları.
- Register değişikliklerinde KVKK onayı true zorunluluğu ve onaysız kayıt reddi.
- File değişikliklerinde erişim izinleri, R2 key ve cache-control.
- Frontend değişikliklerinde desktop/mobile browser smoke.
- Privacy silme değişikliklerinde sentetik kullanıcıyla D1 cleanup ve attachment purge queue/R2 zinciri.
- Playwright yalnız `test/frontend/**/*.spec.js` browser testlerini çalıştırır; Vitest `.test.js` dosyaları browser smoke'a dahil edilmez.
- Sistem Sağlığı UI testi eski RA/tünel KPI referanslarının geri gelmediğini de doğrular.

## Güncel Stabilizasyon Durumu — 7 Eylül 2026

- Auth/cookie/origin: CLOSED
- Mobile off-canvas navigation: CLOSED
- `/api/products` staging erişimi: CLOSED
- Admin audit altyapısı: uygulanmış
- KVKK kullanıcı silme ve anonimleştirme: staging D1 E2E SUCCESS
- Privacy R2 purge: staging R2 E2E SUCCESS
- Çerez/analytics policy uyumu: CLOSED; aktif analytics tracker yok
- Final canlı staging bütünlük smoke: AUTH + FILES + FRONTEND + SYSTEM HEALTH SUCCESS
- Super-admin Sistem Sağlığı: endpoint + dashboard widget + RA/tünel KPI temizliği staging'de LIVE ve doğrulanmış
- Production D1 preflight/rollback guardrail: uygulanmış
- Production Infrastructure Preflight: uygulanmış, production geçişinde manuel çalıştırılacak
- Staging henüz freeze edilmemiştir; geliştirme devam eder.

## Post-Stabilizasyon Ürün İyileştirme Roadmap'i

Aşağıdaki maddeler mevcut stabil staging tabanı üzerinde davranış değişikliklerini kontrollü ve küçük paketler halinde geliştirmek için sıralanmıştır.

### P2-A — Admin Dashboard / Genel Bakış

- Genel Bakış KPI kartlarını gerçek yönetim ekranlarına bağla: kullanıcılar, kurumlar, ürünler, abonelikler, talepler, duyurular, destek kayıtları ve dosyalar ilgili filtrelenmiş listeye tek tıkla gitmeli.
- KPI kartlarında yalnız sayı değil anlamlı alt bilgi göster: ör. bekleyen, son 7 gün, süresi yaklaşan, işlem gerektiren.
- "İşlem Gerektirenler" alanı ekle: açık destek talepleri, bekleyen ürün istekleri, yakında bitecek abonelikler, privacy purge hatası gibi yönetici aksiyonu isteyen durumlar.
- "Son Aktiviteler" özetini audit log üzerinden kullanıcı dostu hale getir; ham teknik log yerine kim/ne/zaman formatı ve ilgili kayda link.
- Hızlı işlemler ekle: kullanıcı ekle, kurum ekle, ürün ekle, duyuru oluştur, dosya yükle gibi en sık kullanılan admin aksiyonları.
- Sistem Sağlığı kartını mevcut haliyle sade tut; detayları yalnız super-admin için açılır panel/modal üzerinden göster.
- Dashboard kartlarını role göre göster; normal admin için gereksiz super-admin teknik bilgisini gizli tut.

### P2-B — Profil / Kullanıcı Dashboard'u

- Profil sayfasının bilgi hiyerarşisini yeniden ele al: kullanıcının ilk bakışta erişebildiği ürünler, son duyurular, dosyalar ve önemli abonelik durumları görünmeli.
- Aktif abonelik/erişim kartlarını daha anlaşılır yap: erişim tipi, kurum, geçerlilik ve doğrudan "Eriş" aksiyonu.
- Kullanıcının sık kullandığı ürünleri veya son erişilenleri öne çıkarma seçeneğini değerlendir.
- Duyuru ve dosya bölümlerinde okunmamış/yeni durumunu daha görünür yap.
- Profil bilgileri, şifre/güvenlik ve KVKK/hesap silme gibi hesap ayarlarını içerikten görsel olarak ayır.
- Mobil dashboard kullanımını ayrıca optimize et; kart yoğunluğunu ve gereksiz dikey kaydırmayı azalt.
- Boş durumları iyileştir: "henüz dosya yok" yerine kullanıcıyı doğru sonraki adıma yönlendiren mesaj ve butonlar.

### P2-C — AI Araçları

- AI Araçları alanını baştan ürün mantığıyla gözden geçir: hangi araç ne işe yarıyor, kim için, hangi ihtiyacı çözüyor açık olmalı.
- Kartları yalnız logo/ad listesi olmaktan çıkar; kısa kullanım amacı, kategori, erişim tipi ve güçlü CTA ekle.
- Kategorileri netleştir: yazım, araştırma, literatür, sunum, veri analizi, üretkenlik vb.
- Arama/filtreleme ve kategori filtrelerini sadeleştir; gereksiz seçenekleri kaldır.
- Kuruma/aboneliğe göre erişilebilir araçları kullanıcıya önceliklendir; erişilemeyen araçların durumu açıkça belirtilsin.
- Yeni/popüler/önerilen gibi rozetleri yalnız gerçek veri varsa kullan; yapay "popüler" etiket üretme.
- Araç detayına veya doğrudan erişime giderken beklenen davranışı standartlaştır.
- AI araç kullanım verisi tutulacaksa KVKK/veri minimizasyonu ve amaç sınırlaması tasarımın parçası olmalı.

### P2-D — Genel Kullanılabilirlik ve Bilgi Mimarisi

- Admin ve profil navigasyonunda aktif bölüm, breadcrumb ve geri dönüş yollarını standardize et.
- Liste ekranlarında ortak arama, filtre, sıralama, pagination ve "filtreyi temizle" davranışı oluştur.
- Tablolarda mobil görünümü iyileştir; kritik alanları kart/stack formuna dönüştürmeyi değerlendir.
- Başarı/hata/toast mesajlarını ortaklaştır; teknik hata metni kullanıcıya doğrudan gösterilmemeli.
- Yükleme skeleton/spinner ve empty-state davranışlarını ortaklaştır.
- Silme, rol değiştirme, abonelik iptali gibi kritik işlemlerde tutarlı confirmation ve sonuç geri bildirimi sağla.
- Erişilebilirlik turu yap: klavye navigasyonu, focus state, form label, kontrast, aria ve modal focus yönetimi.

### P2-E — Arama ve Hızlı Erişim

- Admin için global hızlı arama/command palette değerlendir: kullanıcı, kurum, ürün ve destek kaydını tek yerden bulma.
- Kullanıcı profilinde ürün/dosya/duyuru aramasını bağlama göre basitleştir.
- Admin dashboard KPI linklerinde ilgili filtre query parametreleri korunmalı; ör. "bekleyen talepler" tıklanınca tüm talepler değil doğrudan bekleyenler açılmalı.

### P2-F — Privacy / Harici İçerik Hardening

- Google Maps iframe'ini kullanıcı haritayı açmadan yüklemeyecek şekilde `data-src`/on-demand modele geçirmek değerlendirilecek.
- Gelecekte analytics veya başka üçüncü taraf tracker eklenirse consent gate olmadan aktive edilmeyecek.

### P3 — Teknik Borç / Refactor

- `admin.html` içindeki büyük inline CSS/JS parçalarını davranışı değiştirmeden modüllere ayırma.
- `backend/src/index.js` monolitini domain bazlı route/service modüllerine küçük adımlarla ayırma.
- Ortak frontend API URL/fetch/error helper'larını standardize etme.
- Bu refactor'lar kullanıcıya görünür P2 iyileştirmeler ve regresyon testleri oturduktan sonra yapılmalı; stabil staging tabanını gereksiz yere riske atmamalı.

### Production'a Geçiş Öncesi

- Ürün iyileştirme fazı tamamlandığında final staging smoke tekrar çalıştırılır.
- Ardından production read-only preflight, migration list/plan, backup/Time Travel noktası, production deploy ve production smoke sırasıyla uygulanır.
