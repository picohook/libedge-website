# LibEdge — Faz 1 Karar Özeti

> Bu doküman, bireysel katalog + affiliate + ücretsiz ürünler evrimine geçmeden önce netleşmesi gereken 14 stratejik kararı özetliyor. Her karar için: sorunun kendisi, seçenekler (artı/eksileriyle), benim önerim ve senin işaretleyeceğin alan var.
>
> Her şey karara bağlandıktan sonra: migration + backend iskelet + frontend toggle + ilk 3 sayfa (katalog listesi, ürün detayı, admin ürün editörü) tek oturumda çıkarılabilir.

---

## 1. Bölüm — Faz 1 Kapsamı

### Karar 1: URL Şeması

Ürün detay sayfalarının URL yapısı. SEO için kritik, sonradan değiştirmek zararlı.

- **A.** `/urunler/:slug` — Türkçe, tek seviye (örn. `/urunler/chatpdf`)
- **B.** `/products/:slug` — İngilizce, tek seviye
- **C.** `/kesfet/:slug` — "Discover" çağrışımı, tek seviye
- **D.** `/urunler/:kategori/:slug` — Kategori iç içe (örn. `/urunler/ai/chatpdf`)

**Önerim: A.** TR marka kimliğine uyar, TR anahtar kelime SEO değeri yüksek. Kategori URL'de yok — ürün kategori değişirse URL bozulmaz. İngilizce versiyonu ileride `/en/products/:slug` olarak paralel açılabilir.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] D  [ ] Diğer: _______

---

### Karar 2: Ana Navigasyon

Üst menüdeki "Ürünler" dropdown'ı bireysel katalogu nasıl entegre edecek?

- **A.** Mevcut dropdown iki kolona bölünür: **Kurumsal** (mevcut ürünler) + **Bireysel** (yeni katalog). En üstte "Tüm Ürünleri Keşfet" linki.
- **B.** Mevcut "Ürünler" korunur + nav'a ikinci bir "Keşfet" girişi eklenir (bireysel için).
- **C.** "Ürünler" → "Çözümlerimiz" (kurumsal), yeni nav "Araçlar" (bireysel).
- **D.** Nav'da yalnız "Ürünler" kalır, toggle sadece ana sayfada olur.

**Önerim: A.** Ana sayfadaki toggle ile simetri kurar, hem kurumsal hem bireysel ziyaretçi tek dropdown'dan kendi dünyasını bulur. "Tüm Ürünler" linki tam katalog sayfasına götürür.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] D  [ ] Diğer: _______

---

### Karar 3: Editör Rolü

Katalog yönetimi için ayrı bir rol mü, yoksa mevcut admin mi kullansın?

- **A.** Yeni `editor` rolü: ürün CRUD yapabilir, kullanıcı/kurum yönetemez, analytics sınırlı.
- **B.** Mevcut `admin` rolü: ürünleri de o yönetir, şimdilik ayrım yok.

**Önerim: B.** Faz 1'de muhtemelen sen ve belki 1 kişi ürün ekleyeceksiniz. Ayrı rol overhead. Ekip 3+ kişiye çıktığında bölünsün, o zaman "editor" rolü kolayca eklenir.

**Seçim:** [ ] A  [ ] B  [ ] Diğer: _______

---

### Karar 4: Email Servisi (lead magnet + transactional)

Ücretsiz içerik teslimi + sipariş bildirimi + bildirim emailleri için.

- **A.** Cloudflare Email Workers + MailChannels — ücretsiz, basit, Workers'la native
- **B.** Resend — modern API, Workers native, 3K email/ay ücretsiz, sonrası uygun fiyatlı
- **C.** SendGrid — olgun ama pahalı ve bürokratik (domain onayı uzun)
- **D.** Brevo (eski Sendinblue) veya Mailgun — TR'de yaygın, orta fiyat

**Önerim: B (Resend).** Developer experience en iyi, Workers'ta native çalışır, transactional + basit marketing campaign'lere yeter. Domain doğrulama 15 dk. MailChannels son dönemde erişim/kota kısıtları getirdi, production'da garantili değil.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] D  [ ] Diğer: _______

---

### Karar 5: İlk Katalog Büyüklüğü

Canlıya çıkıldığında bireysel kataloğunda kaç ürün olacak?

- **A.** 10–15 ürün — "butik" küratörlük, her biri kaliteli açıklama ve görsel
- **B.** 20–30 ürün — dengeli, hem çeşit var hem küratörlük kalitesi kaybolmaz
- **C.** 50+ ürün — geniş katalog, her kategoride en az 3-5 seçenek

**Önerim: A veya B arası (15–25).** Boş kategoriler kötü UX, ama her kategoriye zorla ürün doldurmak kaliteyi düşürür. Her ürünün gerçekten iyi yazılmış açıklaması, düzgün görseli, SEO meta'sı olsun. Her ay 5–10 yeni ürün eklenir.

**Seçim:** [ ] A (10–15)  [ ] B (20–30)  [ ] C (50+)  [ ] Diğer: _______

---

## 2. Bölüm — Veri Modeli Mimarisi

### Karar 6: Ücretsiz İçerik İçin Order Kaydı

Kullanıcı email bırakıp ücretsiz içerik indirirken arka planda ne olsun?

- **A.** `orders` tablosuna `total=0, status=completed` bir kayıt yazılır. Tutarlılık: Kütüphanem sayfası hem ücretsiz hem ücretli satın alımları aynı sorgudan çeker.
- **B.** Sadece `entitlement` yazılır, order yaratılmaz. Sadelik: gereksiz veri yazılmaz.

**Önerim: A.** Başta biraz fazla gibi görünse de, Faz 2'de abonelik geldiğinde "satın alım geçmişi" sayfası tek sorgu path'iyle çalışır. Free/paid ayrımını UI katmanına değil, veri katmanına güvenerek yaparsın.

**Seçim:** [ ] A  [ ] B  [ ] Diğer: _______

---

### Karar 7: Entitlement Hedefi (Kullanıcı / Lead)

Email yakalayıp hesabı olmayan birine erişim hakkı nasıl verilir?

- **A.** Entitlement sadece User'a bağlanır. Email girenе minimal hesap yok → sadece `leads` tablosuna yazılır, içerik email ile gönderilir, erişim hakkı yaratılmaz.
- **B.** Entitlement hem User hem Lead'e bağlanabilir (polymorphic).
- **C.** Email girene otomatik minimal hesap aç (passwordless magic link), sonra normal User entitlement'ı yarat.

**Önerim: C.** Kullanıcı email girer → otomatik User kaydı oluşur → magic link ile giriş yapabilir → entitlement User'a bağlanır → Kütüphanem sayfası anında çalışır. KVKK açısından temiz (açık user hesabı, aydınlatma metni rıza alındı), UX açısından tutarlı (ücretsiz/ücretli aynı flow'dan akar), veri modeli sade.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] Diğer: _______

---

### Karar 8: Institutional License Destekleme Zamanı

Kurumsal lisans (bir kurumun çalışanlarına/öğrencilerine erişim) veri modeline ne zaman girsin?

- **A.** Faz 1'de hiç yok, kurumsal kısım eski akışta (iletişim formu → sözleşme → manuel takip).
- **B.** Veri modeli kurumsal lisansa hazır olacak (tablolar var), Faz 1'de sadece individual aktif. Faz 2'de institutional dashboard gelir.
- **C.** Faz 1'de tam kuruluyor: kurumsal entitlement'lar, seat yönetimi, kurum admin rolü, hepsi.

**Önerim: B.** Tablolar hazır, kod path'leri stubbed. Kurumsal gelir akışın değişmiyor (hâlâ sözleşmeli satış). Ama Faz 2'de "kurumsal kontrol paneli" açmak istediğinde migration işkencesi yaşamıyorsun.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] Diğer: _______

---

## 3. Bölüm — Ekosistem ve Büyüme

### Karar 9: Referral Programı Yapısı

Bireysel kullanıcı kurumsal ürünü kurumuna önerdiğinde ne olsun?

- **A.** Sadece attribution + teşekkür emaili. Ödül yok, sadece sistemde kim önerdi bilinsin.
- **B.** Hafif ödül: "Ambassador" rozeti, profil işareti, teşekkür emaili.
- **C.** Maddi ödül: anlaşma kapanırsa kullanıcıya 3-6 ay premium bireysel hesap, veya LibEdge kredisi.
- **D.** Tiered: tüm öneriler attribution + teşekkür (A seviyesi). Anlaşma kapanırsa maddi ödül (C seviyesi). Rozetler orta katman olarak çalışır (B).

**Önerim: D (Tiered).** En esnek: baseline olarak herkese attribution + teşekkür, belirli bir eşiğin üzerinde öneri yapana rozet, anlaşma kapandığında maddi ödül. Ödül-ödülsüz optimal karışımı yakalar. Riski: muhasebe/KPI setup'ı biraz iş.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] D  [ ] Diğer: _______

---

### Karar 10: Koleksiyonlar + Ambassador Profilleri

- **Koleksiyonlar (Favorites/Wishlist):** kullanıcı ürünü kaydeder, kendi listesi olur.
- **Public Ambassador profilleri:** aktif öneri yapan kullanıcılar kendi açık profillerine sahip olur ("Ayşe Yılmaz'ın LibEdge Kütüphanesi").

Faz dağılımı:

- **A.** Koleksiyon → Faz 1, Ambassador → Faz 3
- **B.** İkisi de Faz 2+
- **C.** İkisi de Faz 1
- **D.** İkisi de opsiyonel, ihtiyaç doğduğunda açılır

**Önerim: A.** Koleksiyonlar (favori ekleme) basit, Faz 1'de bitirilir ve "kuruma öner" gibi akışları da besler ("koleksiyonumu kuruma öner"). Ambassador public profili güzel ama şimdilik lüks, sosyal kanıt kritik bir ihtiyaç haline geldiğinde Faz 3'te açılır.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] D  [ ] Diğer: _______

---

### Karar 11: Cross-product İlişkileri

"Bunu inceleyenler şunlara da baktı" — ilişkiler nereden gelecek?

- **A.** Manuel küratör: admin panelden ürün ilişkileri (complement/alternative/upsell) tanımlanır.
- **B.** Algoritmik: co-view/co-click event log'undan otomatik hesaplanır.
- **C.** Hibrit: algoritmik default, manuel override mümkün.

**Önerim: A.** Faz 1 için 15–25 ürünlük katalogda küratörlük kaliteli çıkar ve soğuk başlatma problemi (cold start) yaşanmaz. Tablo (`product_relations`) baştan kurulduğunda, Faz 2-3'te algoritmik katman üstüne eklenir (hibrit C'ye doğal evrim).

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] Diğer: _______

---

### Karar 12: Onboarding Persona Quiz'i

Kullanıcının kim olduğunu erken öğrenmenin yolları.

- **A.** Yok. Kullanıcı özgürce gezer, davranışından sinyal topla.
- **B.** Zorunlu: kayıt sonrası 3-4 soruluk quiz ("öğrenci misin/araştırmacı mı..."), geçilemez.
- **C.** Opsiyonel: quiz var ama atlanabilir; tamamlayana kişiselleştirilmiş "sizin için" şeridi.
- **D.** Lightweight implicit: ilk tıklamalardan sessiz persona tahmini, sayfalar buna göre hafifçe düzenlenir.

**Önerim: C.** Zorunlu quiz kötü UX, veri değeri yeterince büyük değil. Opsiyonel + teşvikli optimal. İleride (Faz 2+) davranışsal implicit sinyallere eklenir.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] D  [ ] Diğer: _______

---

## 4. Bölüm — Yapısal Kararlar

### Karar 13: Marka / Domain Ayrımı

Bireysel katalog LibEdge ana domain'inde mi?

- **A.** Tek domain: libedge.com (hem kurumsal hem bireysel). Mevcut SEO birikimi korunur.
- **B.** Subdomain: market.libedge.com (ayrı ürün hissi).
- **C.** Yeni marka ve domain (tamamen ayrı pazar yeri kimliği).

**Önerim: A.** Mevcut domain otoritesi ve SEO birikimi çok değerli. Bireysel katalog ana sayfada "toggle ile ikinci katman" olarak konumlanırsa tekdomainde akıcı durur. Faz 4 marketplace aşamasına gelinirse subdomain veya yeni marka o zaman tartışılır.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] Diğer: _______

---

### Karar 14: Ürün Audience Modeli

Bir ürün hem kurumsala hem bireysele hitap edebilir. Veri modelinde nasıl?

- **A.** `audience` alanı **set**: `['corporate']`, `['individual']`, veya `['corporate','individual']`. Bir ürün birden fazla audience'a atanabilir; UI o an seçili toggle'a göre filtreler.
- **B.** `audience` alanı **tek değer**: ürünün bir ana audience'ı olur; ikisinde de gerekiyorsa ürün iki kez oluşturulur (iki kayıt).
- **C.** Audience UI-only: backend'de böyle bir alan yok, hangi sayfada görüneceği kategori/etiket mantığıyla karar verilir.

**Önerim: A.** En esnek. Örneğin ChatPDF hem bireysel araştırmacıya hem kurumsal lisansa uygun. Tek kayıt, iki görünüm. UI filtresi `WHERE audience @> 'individual'` gibi kısa bir SQL ile halleder.

**Seçim:** [ ] A  [ ] B  [ ] C  [ ] Diğer: _______

---

## Özet Tablo — Hızlı İşaretleme

| # | Karar | A | B | C | D |
|---|-------|---|---|---|---|
| 1 | URL şeması | [ ] `/urunler/:slug` | [ ] `/products/:slug` | [ ] `/kesfet/:slug` | [ ] kategori-içi |
| 2 | Navigasyon | [ ] iki-kolonlu dropdown | [ ] yeni "Keşfet" | [ ] "Çözümler"/"Araçlar" | [ ] nav'da sadece toggle |
| 3 | Editör rolü | [ ] yeni `editor` | [ ] sadece admin | — | — |
| 4 | Email servisi | [ ] MailChannels | [ ] Resend | [ ] SendGrid | [ ] Brevo/Mailgun |
| 5 | Katalog büyüklüğü | [ ] 10–15 | [ ] 20–30 | [ ] 50+ | — |
| 6 | Free için order? | [ ] evet (tutarlılık) | [ ] hayır (sadelik) | — | — |
| 7 | Entitlement hedefi | [ ] sadece User | [ ] User/Lead poly | [ ] magic-link auto-User | — |
| 8 | Institutional license | [ ] Faz 1'de yok | [ ] model hazır, Faz 2'de aktive | [ ] tam Faz 1'de | — |
| 9 | Referral ödülü | [ ] sadece attribution | [ ] hafif (rozet) | [ ] maddi | [ ] tiered |
| 10 | Koleksiyon/Ambassador | [ ] Kol. F1, Amb. F3 | [ ] ikisi F2+ | [ ] ikisi F1 | [ ] sonra |
| 11 | Cross-product | [ ] manuel | [ ] algoritmik | [ ] hibrit | — |
| 12 | Onboarding quiz | [ ] yok | [ ] zorunlu | [ ] opsiyonel | [ ] implicit |
| 13 | Domain/Marka | [ ] tek domain | [ ] subdomain | [ ] yeni marka | — |
| 14 | Audience modeli | [ ] set | [ ] tek değer | [ ] UI-only | — |

---

## Önerilen Kombinasyon (hızlı başlangıç)

Eğer hepsini tek tek okumak istemezsen, benim tavsiyem bütünü:

> **1A · 2A · 3B · 4B · 5B · 6A · 7C · 8B · 9D · 10A · 11A · 12C · 13A · 14A**

Bu kombinasyon: minimum kapsam risk, maksimum gelecek esnekliği. Faz 1'i 3-4 haftada bitirir, Faz 2-4'ü migration zahmetsiz açar.

---

## Karar Sonrası İlk Sprint

Kararlar netleştiği anda çıkartacağımız deliverable'lar:

1. **`migrations/0011_catalog_offers_orders_entitlements.sql`** — tüm tabloların create statement'ları (individual entitlement aktif, institutional stub).
2. **Backend base fonksiyonlar** — `createProduct`, `createOffer`, `createOrder`, `grantEntitlement`, `userEntitlements`, `trackProductEvent`, `captureRecommendation`.
3. **Admin paneli: Ürün CRUD sekmesi** — katalog, offer düzenleme, cover image upload (R2'ye), audience seçimi.
4. **Ana sayfa toggle UI** — Kurumsal/Bireysel görünüm geçişi, URL hash ile state.
5. **Ürün detay sayfası iskeleti** — `/urunler/:slug`, JSON-LD Product schema dahil.
6. **Go redirect + event log** — `/go/:slug` affiliate tıklama takibi.
7. **Free content gated flow** — email yakalama → magic link → entitlement → teslim.

---

*Hazırlandı: 17 Nisan 2026*
