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

Kurallar:

- Aynı kullanıcı aynı ürünü tekrar tekrar talep edememeli.
- Talep sayıları ürün kartlarında sosyal kanıt olarak kullanılabilir.
- Admin tarafında ürün, kurum, bölüm/fakülte ve talep sayısı bazlı filtre olmalı.

## 8. Öneri Sistemi

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

## 9. Ücretsiz AI Araçları

Ücretsiz AI araçları kullanıcıyı siteye getirmek için kullanılmalıdır. Bunlar
ChatPDF gibi temsilcisi olunan premium ürünü kanibalize etmemelidir.

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

## 10. ChatPDF'in Konumu

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

## 11. MVP Sırası

Önerilen uygulama sırası:

1. Ürün stratejisi ve metadata kararları bu belgeyle sabitlenir.
2. DB migration: ürün sınıflandırma alanları ve `product_requests`.
3. `/api/home-feed` backend endpoint'i.
4. Ana sayfa login durumuna göre home-feed render eder.
5. "Kurumumdan Talep Et" modal + API.
6. Basit öneri motoru.
7. Akademik Kaynak Bulucu MVP.
8. ChatPDF yönlendirme ve talep akışı.
9. Admin panelde talep raporları.

## 12. Tasarım İlkeleri

- Kullanıcı önce erişebildiği şeyleri görür.
- Kurum kaynakları satış kataloğu gibi sunulmaz.
- Ücretsiz AI araçları değer verir ama premium ürünleri ikame etmez.
- Ürün kartında aksiyon belirsiz olmaz.
- Backend erişim ve aksiyon kararını verir, frontend render eder.
- Öneriler açıklanabilir olur.
- Kurumdan talep akışı düşük sürtünmeli olur.
