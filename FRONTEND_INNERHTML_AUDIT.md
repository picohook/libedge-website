# Frontend innerHTML Audit

Son güncelleme: 8 Mayıs 2026

Bu belge `admin.html`, `profile.html` ve ortak frontend JS dosyalarındaki `innerHTML`
kullanımlarının risk haritasıdır. Amaç çalışan ekranları hemen refactor etmek değil,
hangi noktaların sabit template, hangilerinin kullanıcı/server verisi taşıdığını net
görmektir.

## Özet

- `innerHTML` kullanımı yaygın; büyük kısmı loading/empty/icon gibi sabit template.
- Toast, support error ve profile file preview akışları son sertleştirmeyle daha güvenli hale getirildi.
- Kalan önemli risk sınıfı ham metinden çok URL attribute'larıdır: `href` ve `src` değerleri
  sadece `escapeHtml` ile kaçılırsa `javascript:` gibi scheme'ler mantıksal olarak hâlâ sorun olabilir.
- Tablo/list render'larında kullanıcı metni çoğunlukla `escapeHtml`, inline JS argument'ları ise
  çoğunlukla `jsStr` ile korunuyor.
- Bu dosya yaşayan kontrol listesi olarak tutulmalı; her frontend güvenlik değişikliğinde güncellenmelidir.

## Tamamlanan Küçük İyileştirmeler

- 8 Mayıs 2026: `profile.html` profil/sosyal linkleri, bireysel araç logo URL'leri,
  paylaşılan dosya linkleri ve destek eki linkleri `safeFileUrl` üzerinden geçirildi.
- 8 Mayıs 2026: `assets/js/auth.js` avatar URL'leri `safeAuthImageUrl` allowlist helper'ı
  ve versioned URL helper'ı üzerinden geçirildi.
- 8 Mayıs 2026: `admin.html` destek eki linkleri ve duyuru görsel preview/list URL'leri
  `safeDisplayUrl` üzerinden geçirildi.
- 8 Mayıs 2026: `admin.html` ürün erişim linkleri, bireysel araç logoları, kullanıcı dosya
  linkleri, abonelik erişim linkleri ve kurum logo URL'leri `safeDisplayUrl` kontrolüne alındı.
- 8 Mayıs 2026: `profile.html` kurum logosu ve duyuru kapak görseli `safeFileUrl` kontrolüne alındı.
- 8 Mayıs 2026: `assets/js/script.js` katalog ürün logo URL'leri `safeCatalogUrl` kontrolüne alındı.
- 8 Mayıs 2026: `assets/js/script.js` çeviri helper'ı icon + metin güncellemesini `innerHTML`
  yerine DOM node + text node ile yapacak şekilde temizlendi.
- 8 Mayıs 2026: `profile.html` notification inline action ID ve unread count değerleri
  numeric normalize edilerek template'e giriyor.

## Öncelikli Bulgular

### 1. Orta Risk: URL Attribute Allowlist Eksikleri

`escapeHtml` HTML kırılmasını engeller, ancak URL'nin güvenli scheme olup olmadığını doğrulamaz.
Bu yüzden `href`/`src` render eden noktalarda `safeFileUrl` veya benzeri allowlist helper
kullanılması daha doğru olur.

İlk bakılacak noktalar:

- `profile.html`: paylaşılan dosyalar listesinde `f.file_url` doğrudan `href` içine giriyor.
- `assets/js/auth.js`: `currentUser.avatar_url` doğrudan avatar `<img src="...">` içine giriyor.
- `admin.html`: duyuru kapak görseli ve preview görsel akışlarında `cover_image_url` / `src`
  değerleri yalnız `escapeHtml` ile attribute'a yazılıyor.

Öneri:

- `safeFileUrl` helper'ı ortak hale getirilmeli.
- Profil/avatar/duyuru görsel URL'leri için `http:`, `https:` ve uygulama içi relative path allowlist'i kullanılmalı.
- Geçersiz URL'de fallback avatar/placeholder gösterilmeli.

### 2. Tamamlandı: Çeviri Helper'ında `innerHTML`

`assets/js/script.js` içinde çeviri sırasında icon korunurken artık `innerHTML` kullanılmıyor.
Icon clone edilip çeviri metni text node olarak ekleniyor.

Durum:

- Düşük riskli alan temizlendi.

### 3. Düşük Risk: Bildirim Render'ları

`profile.html` ve `assets/js/notifications.js` bildirim başlığı/içeriği için `escapeHtml`
kullanıyor.

Durum:

- Metin kaçırılıyor.
- `type` değeri class/icon map üzerinden geçiyor veya escape ediliyor.
- Profile notification action ID/count değerleri numeric normalize edildi.

Öneri:

- Şu an blocker değil.
- Yeni notification tipi eklenirse class/icon map allowlist dışına çıkmamalı.

### 4. Düşük Risk: Destek ve Talep Render'ları

`profile.html` ve `admin.html` destek/talep listeleri kullanıcı metinlerini `escapeHtml`
ile render ediyor. Son hata render düzeltmeleri de bu sınıfa eklendi.

Durum:

- `subject`, `message`, `admin_note`, `author_name`, `institution_name` gibi alanlar kaçırılıyor.
- Attachment URL'leri ayrıca URL allowlist yaklaşımına taşınabilir.

Öneri:

- Metin tarafı iyi durumda.
- Ek dosya URL'leri ortak safe URL helper ile ele alınmalı.

### 5. Düşük Risk: Loading, Empty State, Icon Button HTML

Çok sayıda `innerHTML` sadece sabit markup için kullanılıyor:

- spinner/loading durumları
- empty-state metinleri
- icon button içerikleri
- select option template'leri

Durum:

- Kullanıcı/server verisi içermeyen sabit template ise kabul edilebilir.

Öneri:

- Bu kullanımlar refactor önceliği değil.
- Büyük dosya parçalama sırasında DOM helper'lara taşınabilir.

## Güvenli Kullanım Kuralı

Yeni frontend kodunda:

1. Dinamik metin için `textContent` tercih edilir.
2. Template gerekiyorsa her dinamik metin `escapeHtml` ile kaçılır.
3. Inline event argument'ları için `jsStr` veya DOM event listener kullanılır.
4. `href`/`src` için metin kaçışı yetmez; URL allowlist helper kullanılmalıdır.
5. Kullanıcı/server verisi içeren `innerHTML` eklenirse bu dosyadaki audit listesi güncellenir.

## Sıradaki Küçük İş

En düşük riskli iyileştirme:

- `safeFileUrl` / `safeDisplayUrl` helper'ını ortak bir frontend helper'a çıkarmak.
- Önce `assets/js/auth.js` avatar URL'leri ve `profile.html` paylaşılan dosya `href` render'ı
  bu helper'a bağlanmalı.

Bu değişiklik davranışı bozmadan güvenliği artırır; geçersiz URL'de mevcut fallback veya placeholder
gösterilmelidir.
