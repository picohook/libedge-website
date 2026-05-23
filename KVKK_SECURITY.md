# KVKK and Data Security Baseline

Bu belge LibEdge'in KVKK, veri gizliliği ve teknik güvenlik açısından mevcut
durumunu, hedef kontrollerini ve açık işleri özetler. Hukuki metin yerine teknik
uyum checklist'i olarak düşünülmelidir; production öncesi hukuk danışmanı ile
nihai aydınlatma metni ve sözleşmeler ayrıca gözden geçirilmelidir.

## 1. Veri Kategorileri

LibEdge aşağıdaki veri sınıflarını işler:

| Veri sınıfı | Örnekler | Risk |
|---|---|---|
| Kimlik ve iletişim | Ad soyad, e-posta, telefon | Kişisel veri |
| Kurum bilgisi | Kurum adı, kurum ID, rol, bölüm | Kişisel/kurumsal veri |
| Kimlik doğrulama | Şifre hash'i, reset token hash'i, JWT cookie | Hassas güvenlik verisi |
| Abonelik/erişim | Ürün abonelikleri, RA erişim yetkileri | Kişisel davranış verisi |
| RA logları | Kullanıcı, kurum, ürün, hedef host/path, zaman, IP hash | İşlem güvenliği/veri minimizasyonu gerekli |
| Publisher credential | Kurumsal publisher kullanıcı adı/şifresi | Çok hassas secret |
| Dosya metadata | Dosya adı, mime type, yükleyen kullanıcı, paylaşım kayıtları | Kişisel veri içerebilir |
| AI kullanım verisi | Sorgu, öneri, ürün eşleşmeleri, kullanım limiti | Profil çıkarımı riski |

## 2. Mevcut Teknik Kontroller

### Şifreler

`backend/src/index.js` içinde kullanıcı şifreleri PBKDF2 + random salt ile saklanır.

Mevcut format:

```text
saltHex:hashHex
```

Kontroller:

- Random 16 byte salt
- PBKDF2
- SHA-256
- Timing-safe karşılaştırma
- Eski unsalted SHA-256 hash desteği yalnız migration/rehash için

Hedef:

- Başarılı legacy login sonrası hash mutlaka PBKDF2 formatına yükseltilmeli.
- Yeni şifrelerde legacy SHA-256 asla üretilmemeli.

### Reset Token

`password_resets` tablosu ham reset token saklamaz. Token'ın SHA-256 hash'i saklanır.

Kontroller:

- `token_hash` unique
- Süre sonu (`expires_at`)
- Kullanım zamanı (`used_at`)

### Publisher ve Egress Secret

`backend/src/ra/crypto.js` AES-256-GCM kullanır.

Şifreli saklanan alanlar:

- `institution_subscriptions.ra_credential_enc`
- `institution_ra_settings.egress_secret_enc`
- `ra_user_credentials.credential_enc`

Kontroller:

- Master key `RA_CREDS_MASTER_KEY` wrangler secret olarak tutulur.
- Plaintext credential GET endpoint'lerinde dönmez.
- Admin UI sadece `has_credential` gösterir.
- PUT sırasında plaintext request body'den alınır ve hemen encrypted forma çevrilir.

### RA Access Logs

RA issue-token akışında IP adresi ham olarak saklanmaz; SHA-256 çıktısının kısa prefix'i
`ip_hash` alanına yazılır.

Mevcut log alanları:

```text
user_id
institution_id
product_slug
target_host
target_path
ip_hash
ts
```

Bu loglar işlem güvenliği ve denetim amacıyla tutulur.

### Frontend Output Encoding

Kullanıcı, kurum, dosya, destek talebi, hata mesajı veya upstream/server kaynaklı metin
tarayıcıda varsayılan olarak HTML değil metin kabul edilir.

Kontroller:

- Toast ve error mesajları mümkünse DOM node + `textContent` ile oluşturulur.
- HTML template zorunluysa kullanıcı/server kaynaklı her metin `escapeHtml` ile kaçılır.
- Dosya preview gibi `src`/`href` üreten akışlarda URL değeri allowlist mantığıyla kontrol edilir; geçersiz veya tehlikeli scheme'ler render edilmez.
- `innerHTML` kullanımı sadece sabit template veya açıkça sanitize edilmiş veriyle sınırlı tutulur.

8 Mayıs 2026'da `admin.html` ve `profile.html` içinde toast, support error ve file preview tarafında bu prensiplere uygun sertleştirme yapıldı. Kalan `innerHTML` kullanımları periyodik güvenlik taramasının parçasıdır.

## 3. Production Öncesi Zorunlu Kontroller

- [x] Privacy policy kayıtlı kullanıcı, RA, AI, dosya ve abonelik verilerini kapsayacak şekilde güncellendi.
- [ ] Açık rıza / aydınlatma metni kullanıcı kayıt akışına bağlandı.
- [ ] Çerez yönetimi ve analitik rızası ayrıştırıldı.
- [ ] Veri saklama süreleri belirlendi.
- [ ] Kullanıcının hesap/veri silme talebi için operasyon prosedürü yazıldı.
- [ ] Admin erişimleri rol bazlı ve loglanabilir hale getirildi.
- [ ] Production secrets Cloudflare secret olarak tutuluyor; repoda secret yok.
- [ ] Legacy SHA-256 şifre hash sayısı ölçüldü ve migration planlandı.
- [ ] RA credential ve egress secret plaintext export mümkün değil.
- [ ] D1 export/backupları şifreli ve erişim kontrollü saklanıyor.
- [ ] AI araçlarına gönderilecek inputlar için veri minimizasyonu uygulanıyor.

## 4. Veri Saklama Önerisi

Başlangıç retention önerisi:

| Veri | Önerilen saklama |
|---|---:|
| Aktif kullanıcı hesabı | Hesap aktif olduğu sürece |
| Silinen/pasif kullanıcı hesabı | Yasal gereklilik yoksa 30-90 gün içinde anonimleştirme |
| RA access logs | 180 gün |
| Auth/rate-limit logları | 30-90 gün |
| Password reset token kayıtları | Süre bitiminden sonra 7-30 gün içinde temizlik |
| Product request kayıtları | Talep sonuçlandıktan sonra 2 yıl veya anonimleştirme |
| AI usage logs | 90 gün, sonra aggregate/anonymous |
| Publisher credential | Abonelik/entegrasyon aktif olduğu sürece |

Bu süreler hukuki danışmanlıkla netleştirilmelidir.

## 5. AI Araçları İçin KVKK İlkeleri

Ücretsiz AI araçları ve öneri sistemi kişisel veri işleme riskini artırır.

Kurallar:

- AI sağlayıcısına gereksiz kişisel veri gönderilmez.
- Kullanıcı adı, e-posta, telefon, ham IP, credential, JWT, cookie gönderilmez.
- Kullanıcı sorgusu ürün/katalog eşleşmesi için gerekiyorsa minimum bağlamla gönderilir.
- AI cevabı otomatik karar olarak kullanılmaz; öneri/yardım niteliğindedir.
- Kullanıcıya AI kullanımında verinin nasıl işlendiği açıklanır.
- Kurum sözleşmelerinde AI veri aktarımı ayrıca belirtilir.
- Mümkünse katalog eşleştirme önce yerel/kural tabanlı yapılır, AI yalnız açıklama ve sıralama için kullanılır.

Önerilen AI log modeli:

```text
ai_usage_logs
- id
- user_id nullable
- anonymous_id nullable
- tool
- input_hash
- output_hash
- tokens_estimate
- created_at
```

Ham prompt/output saklanacaksa ayrıca açık iş amacı, retention ve erişim kontrolü
tanımlanmalıdır.

## 6. Veri Sahibi Hakları

KVKK Madde 11 kapsamındaki talepler için operasyonel akış:

1. Talep `privacy@libedge.com` veya `info@libedge.com` üzerinden alınır.
2. Kimlik doğrulama yapılır.
3. Kullanıcının verileri şu kaynaklarda aranır:
   - `users`
   - `subscriptions`
   - `institution_subscriptions` bağlantıları
   - `ra_access_logs`
   - `product_requests`
   - `ai_usage_logs`
   - file/share/notification tabloları
4. Silme, düzeltme veya export talebi kayda alınır.
5. Yasal saklama yükümlülüğü yoksa veri silinir veya anonimleştirilir.
6. Talep sonucu kullanıcıya yazılı iletilir.

## 7. R2 Dosya Silme ve Anonimleştirme Prosedürü

R2 içinde iki dosya sınıfı vardır:

- `files/{sha256-prefix}/...`: merkezi dosya kütüphanesi. Aynı dosya birden fazla kurum/kullanıcı referansında kullanılabilir.
- Yönetilen görsel/ek dosya prefixleri: `announcement-covers/`, `institution-logos/`, `product-logos/`, `product-card-backgrounds/`, `avatars/`, ticket attachment gibi uygulama tarafından üretilen ekler.

Silme ilkeleri:

1. Merkezi dosyalarda önce D1 referansları kontrol edilir:
   - `collection_files`
   - `user_collection_files`
2. Aktif referans varsa yalnız ilgili referans pasifleştirilir veya silinir; R2 objesi korunur.
3. Aktif referans kalmadığında `files` satırı ve ilgili R2 objesi silinir.
4. Logo/avatar/cover gibi tekil varlıklarda eski obje yalnız uygulamanın yönettiği allowlist prefixindeyse silinir. Harici URL veya beklenmeyen prefix silinmez.
5. Kullanıcı silme/anonimleştirme talebinde:
   - Kullanıcı profili ve avatarı kaldırılır.
   - Kullanıcının özel dosya referansları ve bildirim/paylaşım kayıtları incelenir.
   - Kurumsal dosyalar başka kullanıcılara veya kuruma hizmet veriyorsa doğrudan silinmez; kişisel veri içeren `display_name`, not veya paylaşım kaydı anonimleştirilir.
6. R2 objesinin fiziksel silinmesi audit log'a metadata olarak yazılır; dosya içeriği, public URL, token veya R2 key audit log'a yazılmaz.
7. D1 export/backupları ve R2 yedekleri ayrı saklama takvimine tabidir. Veri sahibi talebinde canlı sistem silindikten sonra backup içindeki kopyalar ilk normal backup retention döngüsünde düşürülür; acil hukuki talep varsa manuel purge planı açılır.

Operasyonel kontrol listesi:

- Silinecek kayıt için `file_id`, `collection_file.id`, `user_collection_files.id` ve varsa kullanıcı/kurum bağlamı belirlenir.
- Aktif referans sayısı doğrulanır.
- R2 silme yalnız `FILES_BUCKET` bağlıysa ve obje uygulama tarafından yönetiliyorsa yapılır.
- İşlem sonucu admin audit log veya talep dosyasına metadata olarak kaydedilir.

## 8. Admin ve Yetki Modeli

Minimum hedef:

- Super admin tüm kurumları yönetebilir.
- Kurum admini yalnız kendi kurumunu ve kullanıcılarını görebilir.
- RA credential plaintext hiçbir admin ekranında gösterilmez.
- Access logs admin ekranında amaca uygun filtreyle gösterilir.
- Admin işlemleri audit log'a metadata olarak yazılır; secret, password, ham prompt veya dosya içeriği loglanmaz.

Önerilen audit tablosu:

```text
admin_audit_logs
- id
- actor_user_id
- actor_role
- action
- target_type
- target_id
- metadata_json
- ip_hash
- created_at
```

## 9. Veri İşleyen ve Alt Sağlayıcı Envanteri

Bu liste operasyonel envanterdir; sözleşme ve aydınlatma metni hazırlığında hukuki
kontrolle kesinleştirilmelidir.

| Sağlayıcı | Kullanım amacı | Veri kategorisi | Not / kontrol |
|---|---|---|---|
| Cloudflare | Pages, Workers, D1, KV, R2, DNS/SSL, rate limit/session altyapısı | Kullanıcı hesabı, kurum/abonelik verisi, dosya metadata ve R2 objeleri, RA/session metadata, IP/header metadata | Ana altyapı sağlayıcısı. Secrets Cloudflare secret olarak tutulur; D1/R2 backup erişimi sınırlı olmalı. |
| GitHub | Kaynak kod, issue/PR, CI/CD ve deployment hazırlığı | Normalde production kişisel verisi yok; commit/PR içinde test verisi veya log parçası sızmamalı | Repo secret'ları GitHub Secrets/Actions seviyesinde tutulmalı; kişisel veri içeren export/log commitlenmez. |
| Resend | Transactional e-posta, password reset ve RA alert e-postaları | Alıcı e-posta adresi, kullanıcı adı/selamlama, reset linki veya alert içeriği | E-postada minimum veri kullanılır; reset token TTL kısa, token hash DB'de saklanır. |
| Airtable | Kurum/contact sync, form ve CRM operasyonları | Kurum adı/domain/şehir, contact e-posta/ad/unvan, form başvuruları | Sync yönü ve conflict stratejisi açık tutulmalı; gereksiz kişisel veri Airtable'a gönderilmemeli. |
| AI sağlayıcısı (TBD) | Ücretsiz AI araçları, ürün keşfi/öneri yardımcıları | Minimum kullanıcı girdisi, katalog metadata'sı, hashlenmiş kullanım logları | Sağlayıcı seçilmeden DPA, veri saklama, model training opt-out ve bölge koşulları netleştirilmeli. Ham prompt/output varsayılan olarak saklanmaz. |

Minimum kontrol listesi:

- Her sağlayıcı için sözleşme/DPA veya hizmet şartı bağlantısı kayıt altında tutulur.
- Production secret ve API key'ler repoda tutulmaz.
- Dış sağlayıcıya gönderilen payload örnekleri release öncesi gözden geçirilir.
- Sağlayıcı değişikliği privacy policy ve kurum sözleşmesi etkisi açısından değerlendirilir.
- Veri sahibi talebinde hangi sağlayıcıda arama/silme yapılacağı operasyon dosyasına eklenir.

## 10. Kurum Sözleşmesi İçin RA Egress ve Loglama Açıklaması

Aşağıdaki metin kurumsal sözleşme, ek protokol veya teknik hizmet eki için
başlangıç taslağıdır; hukuk kontrolünden geçirilmeden nihai metin sayılmaz.

### Uzaktan Erişim Hizmeti

LibEdge Uzaktan Erişim (RA) hizmeti, yetkili kurum kullanıcılarının kurum ağı
dışından abonelikli yayıncı kaynaklarına erişebilmesi için proxy ve kurum egress
tüneli altyapısı kullanır. Yayıncıya giden trafik, ilgili kurum için yapılandırılan
egress agent üzerinden kurum internet çıkışına yönlendirilebilir. Bu yapı,
yayıncıların IP tabanlı erişim kontrolleriyle uyum sağlamak için kullanılır.

### Kurum Egress Agent

- Egress agent kurumun belirlediği sunucu veya VM üzerinde çalışır.
- Agent yalnız LibEdge proxy tarafından HMAC imzalı isteklerle çağrılır.
- Agent inbound publisher credential veya kullanıcı parolasını plaintext olarak
  LibEdge paneline geri göndermez.
- Kurum egress endpoint ve secret bilgileri LibEdge tarafında secret/şifreli alan
  olarak tutulur; admin ekranlarında plaintext gösterilmez.
- Kurum, egress agent'ın çalıştığı ortamın ağ, erişim ve işletim sistemi güvenliğinden
  sorumludur.

### Loglama ve Veri Minimizasyonu

RA erişim logları güvenlik, hata ayıklama, yetki denetimi ve hizmet kalitesi amacıyla
tutulur. Varsayılan log alanları:

- kullanıcı id
- kurum id
- ürün/publisher slug
- hedef host/path
- zaman damgası
- upstream status/latency gibi teknik metrikler
- ham IP yerine kısa hash/pseudonym (`ip_hash`)

RA loglarında publisher sayfa içeriği, kullanıcı şifresi, JWT, cookie veya credential
plaintext saklanmaz. RA access log retention başlangıç politikası 180 gündür; hukuki
ve sözleşmesel gerekliliklere göre güncellenebilir.

### Kurum ve LibEdge Sorumlulukları

- Kurum, RA kapsamındaki kullanıcıların yetkilendirilmesinden ve kurum içi kullanım
  kurallarını kullanıcılarına duyurmaktan sorumludur.
- LibEdge, RA secret'larını ve erişim loglarını yetki kontrollü şekilde işler.
- Yayıncı lisans koşulları kurum ve yayıncı arasındaki sözleşmeye tabidir; RA
  altyapısı bu koşulların teknik uygulanmasına yardımcı olur.
- Olay incelemesi veya veri sahibi talebi halinde ilgili RA logları, retention süresi
  içinde kurumla kontrollü şekilde paylaşılabilir.

## 11. Açık Teknik İşler

- [x] `privacy.html` kayıtlı kullanıcı, RA, AI, dosya paylaşımı ve kurum aboneliği modelini kapsayacak şekilde güncellendi.
- [x] Kayıt akışı KVKK Aydınlatma/Gizlilik/Kullanım Şartları açık onayına bağlandı; onay zamanı, versiyonu, IP ve user-agent metadata'sı `users` tablosunda saklanır.
- [ ] Legacy SHA-256 şifre hash'leri için rapor/migration hazırlanacak.
- [x] `ra_access_logs` için 180 günlük retention cleanup job'u eklendi.
- [x] `password_resets` için expired/used kayıt cleanup job'u eklendi.
- [x] `product_requests` ve `ai_usage_logs` migration'larında privacy-by-design uygulandı.
- [x] Admin audit log ürün, abonelik, kurum ve kullanıcı yönetimi için eklendi.
- [x] Admin audit log kapsamı sync, duyuru AI ve toplu klasör paylaşımı operasyonlarına genişletildi.
- [x] Admin audit log kapsamı destek ticket status/reply operasyonlarına genişletildi.
- [x] Admin audit log kapsamı çekirdek dosya yükleme/silme operasyonları için genişletildi.
- [x] R2 dosya silme/anonimleştirme prosedürü belgelendi.
- [x] Cloudflare, GitHub, e-posta sağlayıcıları ve AI sağlayıcıları için veri işleyen listesi çıkarıldı.
- [x] Kurum sözleşmeleri için RA egress ve loglama açıklaması taslağı eklendi.
- [ ] Frontend `innerHTML` audit'i release öncesi tekrarlanacak; kullanıcı/server verisi içeren her render noktası `textContent`, `escapeHtml` veya güvenli URL helper ile doğrulanacak.

## 12. Uygulama Prensipleri

- Plaintext şifre veya credential saklanmaz.
- Geri döndürülebilir şifreleme yalnız gerçekten ihtiyaç olan secret'larda kullanılır.
- Kullanıcı şifreleri yalnız hash + salt olarak tutulur.
- Loglarda ham IP yerine hash/pseudonym kullanılır.
- AI araçlarında veri minimizasyonu varsayılandır.
- Yeni her tablo için veri sınıfı, saklama süresi ve silme davranışı tanımlanır.
- Production debug header/logları kişisel veri sızdırmayacak şekilde kapatılır.
