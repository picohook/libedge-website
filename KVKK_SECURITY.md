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

## 3. Production Öncesi Zorunlu Kontroller

- [ ] Privacy policy kayıtlı kullanıcı, RA, AI, dosya ve abonelik verilerini kapsayacak şekilde güncellendi.
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

## 7. Admin ve Yetki Modeli

Minimum hedef:

- Super admin tüm kurumları yönetebilir.
- Kurum admini yalnız kendi kurumunu ve kullanıcılarını görebilir.
- RA credential plaintext hiçbir admin ekranında gösterilmez.
- Access logs admin ekranında amaca uygun filtreyle gösterilir.
- Admin işlemleri ileride audit log'a yazılmalıdır.

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

## 8. Açık Teknik İşler

- [ ] `privacy.html` kayıtlı kullanıcı, RA, AI, dosya paylaşımı ve kurum aboneliği modelini kapsayacak şekilde güncellenecek.
- [ ] Legacy SHA-256 şifre hash'leri için rapor/migration hazırlanacak.
- [ ] `ra_access_logs` için retention cleanup job eklenecek.
- [ ] `password_resets` için expired cleanup job eklenecek.
- [ ] `product_requests` ve `ai_usage_logs` migration'larında privacy-by-design uygulanacak.
- [ ] Admin audit log eklenecek.
- [ ] R2 dosya silme/anonimleştirme prosedürü belgelenecek.
- [ ] Cloudflare, GitHub, e-posta sağlayıcıları ve AI sağlayıcıları için veri işleyen listesi çıkarılacak.
- [ ] Kurum sözleşmelerine RA egress ve loglama açıklaması eklenecek.

## 9. Uygulama Prensipleri

- Plaintext şifre veya credential saklanmaz.
- Geri döndürülebilir şifreleme yalnız gerçekten ihtiyaç olan secret'larda kullanılır.
- Kullanıcı şifreleri yalnız hash + salt olarak tutulur.
- Loglarda ham IP yerine hash/pseudonym kullanılır.
- AI araçlarında veri minimizasyonu varsayılandır.
- Yeni her tablo için veri sınıfı, saklama süresi ve silme davranışı tanımlanır.
- Production debug header/logları kişisel veri sızdırmayacak şekilde kapatılır.
