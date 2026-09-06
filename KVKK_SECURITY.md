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

- Başarılı legacy login sonrası hash mutlaka PBKDF2 formatına yükseltilmeli ✅ (`backend/src/index.js` login route'unda lazy-rehash aktif).
- Yeni şifrelerde legacy SHA-256 asla üretilmemeli ✅ (`hashPassword` yalnız PBKDF2 üretir).

Legacy hash takibi (KVKK-02, 2026-05-24):

- Admin endpoint `GET /api/admin/legacy-passwords/stats` (super admin) kalan legacy hash sayısını ve 180+ gün login olmayan stale hesap sayısını döner. E-posta açığa çıkmaz.
- Legacy hash tespiti: `password_hash NOT LIKE '%:%'` (PBKDF2 hash'leri `saltHex:hashHex` formatındadır).
- Strateji: organik yükseltme (login = otomatik PBKDF2). Stale hesaplar production'a geçişten önce ayrıca değerlendirilir (force reset email veya manuel iptal).

### Reset Token

`password_resets` tablosu ham reset token saklamaz. Token'ın SHA-256 hash'i saklanır.

Kontroller:

- `token_hash` unique
- Süre sonu (`expires_at`)
- Kullanım zamanı (`used_at`)

### Harici Erişim Bilgileri

Harici sistemlerde kullanılan erişim bilgileri plaintext olarak loglanmamalı ve
yalnız yetkili admin ekranlarında kontrollü şekilde yönetilmelidir.

Kontroller:

- Plaintext credential GET endpoint'lerinde dönmez.
- Admin UI sadece gerekli maskeleme/durum bilgisini gösterir.
- PUT sırasında gelen hassas değerler kalıcı loglara yazılmaz.

## 3. Production Öncesi Zorunlu Kontroller

- [x] Privacy policy kayıtlı kullanıcı, RA, AI, dosya ve abonelik verilerini kapsayacak şekilde güncellendi.
- [ ] Açık rıza / aydınlatma metni kullanıcı kayıt akışına bağlandı.
- [ ] Çerez yönetimi ve analitik rızası ayrıştırıldı.
- [x] Veri saklama süreleri belirlendi ve cleanup cron job'ları yazıldı (2026-05-24).
- [ ] Kullanıcının hesap/veri silme talebi için operasyon prosedürü yazıldı.
- [ ] Admin erişimleri rol bazlı ve loglanabilir hale getirildi.
- [ ] Production secrets Cloudflare secret olarak tutuluyor; repoda secret yok.
- [x] Legacy SHA-256 şifre hash migration stratejisi: lazy-rehash + admin stats endpoint (KVKK-02, 2026-05-24).
- [ ] RA credential ve egress secret plaintext export mümkün değil.
- [ ] D1 export/backupları şifreli ve erişim kontrollü saklanıyor.
- [ ] AI araçlarına gönderilecek inputlar için veri minimizasyonu uygulanıyor.

## 4. Veri Saklama Süreleri (Kararlaştırıldı 2026-05-24)

Retention süreleri ve uygulanan cleanup yöntemi:

| Veri | Saklama | Uygulanma |
|---|---:|---|
| Aktif kullanıcı hesabı | Hesap aktif olduğu sürece | — |
| Silinen/pasif kullanıcı hesabı | 30-90 gün içinde anonimleştirme | Manuel prosedür (§6) |
| Password reset token kayıtları | 30 gün (süre bitimi sonrası) | `cleanupExpiredPasswordResets` cron |
| Refresh token (expired/revoked) | 30 gün | `cleanupOldRefreshTokens` cron |
| Product request kayıtları | 2 yıl sonra user_id NULL (anonimleştirme) | `anonymizeOldProductRequests` cron |
| AI usage logs | 90 gün | `cleanupOldAiUsageLogs` cron |
| Publisher credential | Abonelik/entegrasyon aktif olduğu sürece | — |

Tüm cron job'ları `backend/src/index.js` `scheduled()` handler'ında, `*/5 * * * *` tetiklemesinde çalışır. Yasal gereklilik değişirse retention sabitleri (`*_RETENTION_SECONDS`) güncellenmelidir.

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

## 10. Kurum Sözleşmesi İçin Erişim ve Loglama Açıklaması

Kurum sözleşmeleri, LibEdge'in kullanıcı hesabı, abonelik görünürlüğü, doğrudan
erişim bağlantıları, SSO/kurumsal giriş yönlendirmeleri, dosya paylaşımı, destek
ve güvenlik kayıtları için işlediği verileri açıkça tarif etmelidir. Yayıncı
credential veya kullanıcı şifresi plaintext olarak loglanmamalıdır.

## 11. Açık Teknik İşler

- [x] `privacy.html` kayıtlı kullanıcı, AI, dosya paylaşımı ve kurum aboneliği modelini kapsayacak şekilde güncellendi.
- [x] Kayıt akışı KVKK Aydınlatma/Gizlilik/Kullanım Şartları açık onayına bağlandı; onay zamanı, versiyonu, IP ve user-agent metadata'sı `users` tablosunda saklanır.
- [ ] Legacy SHA-256 şifre hash'leri için rapor/migration hazırlanacak.
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
