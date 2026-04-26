# LibEdge Product Strategy

Bu belge LibEdge'in ürün deneyimini, katalog ayrımını, kullanıcı ana sayfasını,
öneri sistemini ve AI destekli araçların rolünü tarif eder. Amaç tek bir ürün
listesi yerine kullanıcının bağlamına göre kişiselleşen akademik erişim kapısı
oluşturmaktır.

## 1. Konumlandırma

LibEdge yalnız bir ürün kataloğu değildir.

LibEdge'in hedef vaadi:

> Akademik kaynaklarını bul, eriş, çalış, öneri al ve kurumundan ihtiyaç duyduğun
> kaynakları talep et.

Bu nedenle ürün deneyimi dört ihtiyacı birlikte karşılamalıdır:

1. Kullanıcı hangi kaynaklara erişebildiğini hemen görmeli.
2. Kurum RA anlaşması varsa kurumun tüm erişilebilir kaynakları öne çıkmalı.
3. Bireysel kullanıcı ücretsiz, ücretli ve affiliate ürünleri keşfedebilmeli.
4. AI destekli ücretsiz araçlar kullanıcıyı siteye getirmeli ve doğru ürüne yönlendirmeli.

## 2. Üç Ana Alan

### LibEdge Kurumsal

Kurumlara satılan, lisanslanan veya tekliflenen ürünler.

Kullanıcı dili:

- Kurum için erişim
- Demo talep et
- Teklif al
- Kurum lisansı

Hedef kullanıcı:

- Kurum yöneticisi
- Kütüphane / satın alma yetkilisi
- Akademik birim temsilcisi
- Kurumsal ürün araştıran bireysel kullanıcı

### Bireysel

Bireysel kullanıcının doğrudan kullanabileceği ürünler.

Alt modeller:

- Ücretli bireysel ürün
- Ücretsiz ürün
- Affiliate / dış sağlayıcı ürünü

Kullanıcı dili:

- Satın al
- Ücretsiz eriş
- Dış sağlayıcıda incele
- Bireysel abonelik

### Kurum Kaynakları

Kurumun zaten abone olduğu ve LibEdge RA üzerinden erişim verdiği kaynaklar.
LibEdge burada satıcı gibi değil, erişim altyapısı gibi davranır.

Kullanıcı dili:

- Kurum aboneliğinizle erişilir
- Erişime Git
- Kurum erişim sunucusu aktif/pasif
- Bu kaynak kurumunuz tarafından sağlanır

Bu alan yalnız RA anlaşmalı kurum kullanıcılarına gösterilir.

## 3. Ürün Sınıflandırması

Katalogda ürün tek satır olabilir, ama UI davranışı bu metadata ile ayrılır.

Önerilen alanlar:

```text
audience:
  corporate
  individual
  institution_resource

monetization:
  paid
  free
  affiliate
  institution

subjects:
  medicine, chemistry, business, law, engineering, ...

levels:
  undergraduate, graduate, researcher, clinician, faculty, ...

formats:
  video, journal, database, ebook, course, ai_tool, ...

tool_capabilities:
  pdf_chat, article_summary, document_qa, citation_help, resource_finder, ...

recommendation_weight:
  number
```

İlk uygulamada alan sayısı daha küçük tutulabilir:

```text
audience
monetization
subjects_json
formats_json
recommendation_weight
```

## 4. Ana Sayfa Davranışı

Profil sayfası erişim arama yeri olmamalıdır. Kullanıcı login olur olmaz ana
sayfa kişiselleşmelidir.

### Login Olmayan Kullanıcı

Gösterilecek bölümler:

1. Ücretsiz AI araçları
2. Bireysel ürünler
3. Ücretsiz ürünler
4. Affiliate öneriler
5. LibEdge Kurumsal

### Login Olmuş, RA Anlaşması Olmayan Kullanıcı

Gösterilecek bölümler:

1. Erişimlerim
2. Sana önerilenler
3. Bireysel ürünler
4. Ücretsiz ürünler
5. LibEdge Kurumsal

### Login Olmuş, RA Anlaşmalı Kurum Kullanıcısı

Gösterilecek bölümler:

1. Kurum Kaynaklarım
2. Erişimlerim
3. Sana önerilenler
4. Bireysel ürünler
5. LibEdge Kurumsal

Kurum kullanıcısı için ilk ekranın ana değeri "Kurum Kaynaklarım" olmalıdır.

## 5. Home Feed API

Frontend ürün erişim kararlarını kendi içinde hesaplamamalıdır. Backend hazır
bölümler ve aksiyonlar dönmelidir.

Önerilen endpoint:

```text
GET /api/home-feed
```

Örnek cevap:

```json
{
  "user": {
    "id": 123,
    "institution_id": 188,
    "has_ra_access": true
  },
  "sections": [
    {
      "id": "institution_resources",
      "title": "Kurum Kaynaklarım",
      "priority": 10,
      "items": []
    },
    {
      "id": "my_access",
      "title": "Erişimlerim",
      "priority": 20,
      "items": []
    },
    {
      "id": "recommended",
      "title": "Sana Önerilenler",
      "priority": 30,
      "items": []
    },
    {
      "id": "individual",
      "title": "Bireysel Ürünler",
      "priority": 40,
      "items": []
    },
    {
      "id": "corporate",
      "title": "LibEdge Kurumsal",
      "priority": 50,
      "items": []
    }
  ]
}
```

Her item kendi aksiyonlarını taşımalıdır:

```json
{
  "slug": "jove-research",
  "name": "JoVE",
  "access_status": "institution_available",
  "badges": ["Kurum aboneliği", "Video"],
  "primary_action": {
    "type": "ra_access",
    "label": "Erişime Git",
    "subscription_id": 16
  },
  "secondary_actions": []
}
```

## 6. Kart Aksiyonları

Kart butonları ürünün ticari ve erişim durumuna göre backend tarafından belirlenir.

| Durum | Primary action |
|---|---|
| Kullanıcının erişimi var | Erişime Git |
| Bireysel satın alınabilir | Satın Al / İncele |
| Ücretsiz | Ücretsiz Eriş |
| Affiliate | Dış Sağlayıcıda İncele |
| Kurumda yok ama kurumsal lisanslanabilir | Kurumumdan Talep Et |
| Ürün ChatPDF gibi premium AI ürünü | ChatPDF'i Aç / Talep Et |

Ürün hem bireysel hem kurumsal olabilir. Bu durumda primary action kullanıcının
en hızlı faydasına göre seçilir, diğer seçenek secondary action olur.

### Action Resolution Rules

Aynı ürün birden fazla audience/monetization tipinde olabilir. Primary action
deterministik olmalıdır.

Öncelik sırası:

1. Kurum erişimi varsa ve kullanıcı RA kullanabiliyorsa → `ra_access`
2. Kullanıcının bireysel aboneliği/satın alımı varsa → `owned_access`
3. Ürün ücretsizse → `free_access`
4. Bireysel ücretli ürünse → `purchase`
5. Affiliate ürünse → `affiliate_outbound`
6. Kurumsal lisanslanabilir ama kurumda yoksa → `request_from_institution`
7. Hiçbir aksiyon yoksa → `learn_more`

Örnek:

```text
if institution_access AND user.has_ra:
  primary = ra_access
else if user_has_individual_access:
  primary = owned_access
else if product.monetization == free:
  primary = free_access
else if product.individual_paid:
  primary = purchase
else if product.affiliate:
  primary = affiliate_outbound
else if product.corporate_available AND user.institution_id:
  primary = request_from_institution
else:
  primary = learn_more
```

Secondary action'lar primary action ile çelişmemelidir. Örneğin kurum erişimi
olan üründe satın alma CTA'sı ilk ekranda baskın gösterilmez.

## 7. Kurumumdan Talep Et

Kurumda olmayan ama ilgili bir ürün için kullanıcı ihtiyacını iletebilmelidir.
Bu hem kullanıcı faydası hem de satış sinyali üretir.

Akış:

1. Kullanıcı kartta "Kurumumdan Talep Et" der.
2. Modal açılır:
   - Neden ihtiyacınız var?
   - Kullanım amacı: ders, araştırma, klinik, tez, genel
   - Aciliyet: düşük, normal, yüksek
3. Talep kaydedilir.
4. Kullanıcı "Talebiniz kurum yöneticilerine iletildi" mesajını görür.
5. Admin panelde kurum bazlı talep özeti oluşur.

Önerilen tablo:

```text
product_requests
- id
- product_slug
- institution_id
- user_id
- reason
- use_case
- urgency
- status: new | reviewed | sent_to_institution | approved | rejected | fulfilled
- created_at
- updated_at
```

Spam ve tekrar önleme:

```sql
UNIQUE(user_id, product_slug, institution_id)
```

Ek kurallar:

- `rejected` talepler için aynı kullanıcıya 6 ay cooldown uygulanabilir.
- Kullanıcı aynı talebi tekrar açarsa yeni kayıt yerine mevcut talep durumu gösterilir.
- Talep sonrası kullanıcıya beklenen süreç gösterilir:
  "Talebiniz iletildi. Kurumunuz taleplere genellikle 5 iş günü içinde yanıt verir.
  Durum değiştiğinde e-posta ile bilgilendirileceksiniz."
- Kurum bazlı tipik yanıt süresi ölçülür ve zamanla gerçek veriden hesaplanır.

Kurallar:

- Aynı kullanıcı aynı ürünü tekrar tekrar talep edememeli.
- Talep sayıları ürün kartlarında sosyal kanıt olarak kullanılabilir.
- Admin tarafında ürün, kurum, bölüm/fakülte ve talep sayısı bazlı filtre olmalı.

## 8. Kütüphaneci / Kurum Karar Paneli

"Kurumumdan Talep Et" akışı yalnız form toplamak değildir; kurum karar vericisine
satın alma ve bütçe döneminde kullanılacak karar desteği üretmelidir.

Panelde gösterilecekler:

- En çok talep edilen ürünler
- Talep eden kullanıcı sayısı
- Bölüm/fakülte dağılımı
- Talep gerekçeleri ve kullanım amacı
- Zaman içindeki talep trendi
- Mevcut aboneliklerde kullanım ve erişim başarı oranı
- "Bu ürün alınırsa şu kadar kullanıcı ihtiyacı karşılanır" özeti

Bu panel LibEdge'in kuruma yalnız ürün değil, karar destek mekanizması sunduğunu
gösterir. Kurumsal satışta deal closer olarak konumlandırılır.

## 9. Öneri Sistemi

İlk sürümde açıklanabilir kural motoru yeterlidir. AI zorunlu değildir.

Kullanıcı sinyalleri:

- Bölüm / fakülte
- Rol: öğrenci, akademisyen, klinisyen, kütüphaneci
- İlgi alanları
- Kurum tipi
- Kurumun eriştiği ürünler
- Kullanıcının son erişimleri
- Kullanıcının talepleri

Ürün sinyalleri:

- Subjects
- Levels
- Formats
- Audience
- Monetization
- Tool capabilities
- Recommendation weight

Öneri sebepleri kullanıcıya görünmelidir:

- Bölümünüzle ilgili
- Kurumunuzda erişilebilir
- Ücretsiz erişim
- Benzer kullanıcılar talep etti
- Dış sağlayıcı önerisi
- PDF analizi için uygun

### MVP Sinyal Seti

İlk sürümde sinyal seti dar tutulur:

1. Kullanıcının bölüm/fakültesi
2. Kurumun eriştiği ürünler
3. Son 7 gündeki genel en çok erişilen 5 ürün
4. Ürün subject tag'leri
5. Ücretsiz veya zaten erişilebilir ürün önceliği

Collaborative filtering veya karmaşık davranışsal ranking MVP kapsamına alınmaz.

## 10. Araçlar ve Ürünler Ayrımı

Ücretsiz AI araçları, katalogdaki ücretsiz ürünlerle karışmamalıdır.

Araçlar:

- Tek işlevlidir.
- Kullanıcının niyetini anlar veya çıktı üretir.
- Ürün/kaynak önerisine bağlanır.
- Örnek: Kaynak Bulucu, Terim Açıklayıcı, Çalışma Planı.

Ürünler:

- Devamlı kullanılan veya abonelik/erişim ilişkisi olan kaynaklardır.
- Kart, erişim ve ticari aksiyon taşır.
- Örnek: JoVE, EMIS, ChatPDF, ACS, Primal Pictures.

UI'da "Araçlar" ve "Ürünler" ayrı görsel dil kullanmalıdır.

## 11. Ücretsiz AI Araçları

Ücretsiz AI araçları kullanıcıyı siteye getirmek için kullanılmalıdır. Bunlar
ChatPDF gibi temsilcisi olunan premium ürünü kanibalize etmemelidir.

AI araçları tasarlanırken KVKK ve veri minimizasyonu `KVKK_SECURITY.md` içindeki
kurallara göre uygulanır. Kullanıcı adı, e-posta, ham IP, credential, JWT veya
cookie gibi veriler AI sağlayıcısına gönderilmez.

İlk önerilen araçlar:

1. Akademik Kaynak Bulucu
2. Akademik Terim Açıklayıcı
3. Çalışma Planı Oluşturucu
4. Hangi veri tabanında aramalıyım asistanı

Bu araçların ortak prensibi:

- Kullanıcı niyetini alır.
- LibEdge ürün/kaynak kataloğuyla eşleştirir.
- Erişimi olan kaynaklarda "Erişime Git" gösterir.
- Erişimi olmayanlarda "Kurumumdan Talep Et" gösterir.
- Bireysel/affiliate ürünlerde doğru ticari aksiyon gösterir.

Önerilen endpoint:

```text
POST /api/ai/resource-finder
```

Input:

```json
{
  "query": "Omuz rehabilitasyonu için kaynak arıyorum",
  "department": "Fizyoterapi",
  "role": "Öğrenci",
  "language": "tr"
}
```

Kısıtlar:

- Login olmayan kullanıcı: günlük düşük limit
- Login olan kullanıcı: daha yüksek limit
- Kurum kullanıcısı: kurum politikasına göre limit
- Aynı sorgular cache'lenmeli
- AI'a yalnız kontrollü katalog verisi gönderilmeli

MVP notu:

- Akademik Kaynak Bulucu stratejik olarak en değerli araçtır.
- Çalışma Planı Oluşturucu teknik olarak daha kolay MVP olabilir.
- PDF özetleme ücretsiz araç olarak yapılmaz; ChatPDF'e yönlendirilir.

## 12. ChatPDF'in Konumu

PDF özetleme ve PDF ile sohbet özelliği ücretsiz LibEdge aracı olarak
kopyalanmamalıdır. Çünkü ChatPDF temsilcisi olunan premium AI/PDF ürünüdür.

ChatPDF şu niyetlerde önerilmelidir:

- PDF yüklemek istiyorum
- Makale özeti çıkar
- Makaleye soru sor
- Dokümandan ana bulguları çıkar
- Akademik metni analiz et

Kart aksiyonları:

- Kurumda erişim varsa: ChatPDF'i Aç
- Kurumda yoksa: Kurumumdan Talep Et
- Bireysel model varsa: Bireysel İncele / Satın Al

ChatPDF ürün metadata'sı:

```text
audience: corporate | individual
monetization: paid | institution
formats: ai_tool
tool_capabilities: pdf_chat, article_summary, document_qa
```

## 13. Anonim Kullanıcı Hafızası

Login olmayan kullanıcı ürünü incelediğinde veya AI aracını kullandığında, login
sonrası deneyimin devam etmesi dönüşümü artırır.

Öneri:

```text
anonymous_session_id cookie
product_views
- id
- anonymous_session_id
- user_id nullable
- product_slug
- source_section
- created_at
```

Login sonrası:

- Aynı `anonymous_session_id` ile kayıtlı product view'lar kullanıcıya bağlanır.
- Home feed "Son baktıkların" veya öneri sinyali olarak kullanabilir.
- KVKK gereği retention kısa tutulur ve cookie politikasıyla açıklanır.

## 14. Erişim ve Affiliate Analitiği

Ürün kartı aksiyonları ölçülmeden iyileştirilemez.

### Access Attempts

`Erişime Git` tıklandığında erişimin sonucu izlenmelidir:

```text
access_attempts
- id
- user_id nullable
- anonymous_session_id nullable
- institution_id nullable
- product_slug
- action_type
- target_host
- status: started | success | failed
- error_type nullable
- latency_ms nullable
- created_at
```

Kullanım:

- RA hatalarının ürün/kategori bazlı görünmesi
- Hangi kaynakların gerçekten kullanıldığının ölçülmesi
- Kart aksiyonlarının iyileştirilmesi
- Kurum raporlarına başarı/arıza verisi eklenmesi

### Affiliate / Outbound Click Tracking

Bireysel ve affiliate model için attribution baştan tasarlanmalıdır:

```text
outbound_clicks
- id
- user_id nullable
- anonymous_session_id nullable
- institution_id nullable
- product_slug
- target_url
- source_section
- campaign
- created_at
```

Bu veri reklam veren/partner raporlaması ve bireysel lead üretimi için gerekir.

## 15. Wishlist

Bireysel kullanıcı için "Kurumumdan Talep Et" akışının karşılığı wishlist olabilir.

Örnek aksiyonlar:

- Favorilere ekle
- İndirime girince haber ver
- Türkiye'de açılınca bildir
- Kurumuma öner

Wishlist bireysel lead datasını zenginleştirir, ama MVP'de home-feed ve talep
akışından sonra gelmelidir.

## 16. Browser Extension / Access Checker

Uzun vadede en güçlü retention kanallarından biri browser extension olabilir.

Kullanıcı publisher sayfasındayken:

> LibEdge ile kurumunuz üzerinden erişebilirsiniz.

İlk fazda MVP kapsamına alınmaz. RA, home-feed ve talep/raporlama oturduktan
sonra büyüme kanalı olarak değerlendirilir.

## 17. Bildirim / Duyuru Feed'i

Geniş akademik haber sitesi yapılmamalıdır. İlk sürüm kişisel erişim bildirimleri
ile sınırlı kalmalıdır:

- Kurumunuzun yeni erişime açtığı kaynaklar
- Talep ettiğiniz ürünün durumu değişti
- Size önerilen yeni ürünler
- Sık kullandığınız kaynakta bakım/erişim sorunu var

## 18. MVP Sırası

Önerilen uygulama sırası:

1. Ürün stratejisi ve metadata kararları bu belgeyle sabitlenir.
2. DB migration: ürün sınıflandırma alanları, `product_requests`,
   `access_attempts`, `outbound_clicks`.
3. `/api/home-feed` backend endpoint'i.
4. Basit öneri motoru: bölüm + kurum erişimi + popüler ürünler.
5. Ana sayfa login durumuna göre home-feed render eder.
6. "Kurumumdan Talep Et" modal + API.
7. Kütüphaneci talep/rapor paneli.
8. Affiliate/outbound click tracking raporu.
9. Çalışma Planı veya Akademik Kaynak Bulucu MVP.
10. ChatPDF yönlendirme ve talep akışı.
11. Wishlist.
12. Bildirim/feed.
13. Browser extension / Access Checker.

## 19. Tasarım İlkeleri

- Kullanıcı önce erişebildiği şeyleri görür.
- Kurum kaynakları satış kataloğu gibi sunulmaz.
- Ücretsiz AI araçları değer verir ama premium ürünleri ikame etmez.
- AI araçları kişisel veri minimizasyonu ile çalışır.
- Ürün kartında aksiyon belirsiz olmaz.
- Backend erişim ve aksiyon kararını verir, frontend render eder.
- Öneriler açıklanabilir olur.
- Kurumdan talep akışı düşük sürtünmeli olur.
- Ürün/araç ayrımı UI'da net olur.
- Aynı ürün için primary action deterministik çözülür.
