# KVKK and Data Security Baseline

Bu belge LibEdge'in KVKK, veri gizliliği ve teknik güvenlik açısından güncel teknik
baseline'ını özetler. Hukuki görüş yerine teknik uyum ve operasyon checklist'i olarak
kullanılmalıdır. Production öncesinde nihai aydınlatma metni, sözleşmeler ve veri işleyen
şartları ayrıca hukuk danışmanı ile gözden geçirilmelidir.

**Son teknik senkronizasyon:** 7 Eylül 2026

## 1. Veri Kategorileri

| Veri sınıfı | Örnekler | Risk |
|---|---|---|
| Kimlik ve iletişim | Ad soyad, e-posta, telefon | Kişisel veri |
| Kurum bilgisi | Kurum adı, kurum ID, rol, bölüm | Kişisel/kurumsal veri |
| Kimlik doğrulama | Şifre hash'i, reset token hash'i, JWT cookie | Hassas güvenlik verisi |
| Abonelik/erişim | Ürün abonelikleri, erişim türleri | Kişisel davranış verisi |
| Dosya metadata | Dosya adı, mime type, yükleyen kullanıcı, paylaşım kayıtları | Kişisel veri içerebilir |
| Destek kayıtları | Ticket, reply, attachment | Kişisel veri içerebilir |
| AI kullanım verisi | Sorgu hash'i, öneri, ürün eşleşmeleri, kullanım limiti | Profil çıkarımı riski |
| Harici servis credential | Airtable/API secret vb. | Çok hassas secret |

Eski RA/proxy runtime kodu aktif uygulamadan çıkarılmıştır. Migration geçmişinde legacy RA
tabloları/kolonları bulunabilir; bunlar production veri kaybı riskini önlemek için otomatik
olarak fiziksel silinmemiştir.

## 2. Auth ve Şifre Kontrolleri

- Kullanıcı şifreleri PBKDF2 + random salt + SHA-256 ile saklanır.
- Timing-safe karşılaştırma kullanılır.
- Eski unsalted SHA-256 hash'leri başarılı login sonrası lazy-rehash ile PBKDF2 formatına yükseltilir.
- Yeni şifreler legacy SHA-256 formatında üretilmez.
- Password reset kayıtlarında ham token yerine SHA-256 hash saklanır.
- Auth cookie'leri HttpOnly, Secure, SameSite=Lax olarak çalışır.
- State-changing `POST/PUT/PATCH/DELETE` isteklerinde origin allowlist uygulanır.
- Refresh token replay/revocation kontrolleri aktiftir.

## 3. Kayıt ve Açık Rıza

Kayıt API'si `kvkk_consent` alanını zorunlu boolean olarak doğrular ve yalnız `true`
olduğunda kayıt oluşturur. Kullanıcı kaydında onay durumu ile birlikte onay zamanı, versiyonu,
IP ve user-agent metadata'sı tutulur.

**Durum: CLOSED / uygulanmış.**

## 4. Çerez ve Yerel Tercihler

7 Eylül 2026 kod taramasında Google Analytics, Google Tag Manager, Clarity, Plausible veya
Umami gibi aktif analytics tracker bulunmamıştır. Bu nedenle gerçekte var olmayan bir CMP
veya analytics rızası akışı kullanıcıya sunulmaz.

- Auth/session cookie'leri zorunlu güvenlik/oturum işlevi içindir.
- Dil tercihi kullanıcı etkileşimiyle `localStorage` içinde saklanır.
- `cookies.html` mevcut gerçek davranışla eşleştirilmiştir; aktif olmayan Google Analytics/CMP
  kullanılıyormuş gibi ifade kaldırılmıştır.
- Yeni analytics veya marketing tracker eklenirse non-essential consent mekanizması ayrıca
  uygulanmadan production'a alınmamalıdır.

**Durum: CLOSED mevcut sistem için.**

## 5. Veri Saklama ve Cleanup

| Veri | Saklama / davranış | Uygulanma |
|---|---|---|
| Aktif kullanıcı hesabı | Hesap aktif olduğu sürece | uygulama |
| Password reset token kayıtları | süre bitimi sonrası cleanup | `cleanupExpiredPasswordResets` |
| Refresh token expired/revoked | cleanup | `cleanupOldRefreshTokens` |
| Product request | 2 yıl sonra kullanıcı bağlantısını kaldırma | `anonymizeOldProductRequests` |
| AI usage logs | 90 gün cleanup | `cleanupOldAiUsageLogs` |
| Kullanıcı silme talebi | merkezi D1 privacy trigger | migration `0047_user_deletion_integrity.sql` |
| Ticket attachment purge | privacy queue + scheduled R2 consumer | `backend/src/privacy/r2-purge.js` |

Scheduled görevler Worker entrypoint `backend/src/worker.js` üzerinden mevcut API scheduled
handler'ı ile birlikte çalışır.

## 6. Kullanıcı Silme / Anonimleştirme Politikası

`0047_user_deletion_integrity.sql` içindeki merkezi `BEFORE DELETE ON users` trigger,
self-service ve admin silmelerinin aynı privacy policy'yi uygulamasını sağlar.

### Silinen hesap-özel veriler

- subscriptions
- newsletter_subscriptions
- user_profile_links
- refresh_tokens
- password_resets
- ra_user_credentials (legacy sensitive records)
- announcement reactions/comments
- notifications
- user collections ve ilgili private paylaşım kayıtları
- kullanıcının support ticket kayıtları
- `ai_usage_logs` kullanıcı-linked satırları
- legacy `ra_link_audit_findings`

### Anonimleştirilen / kullanıcı bağlantısı kaldırılan kayıtlar

- product_requests → `user_id = NULL`
- affiliate_clicks → user/referer/user-agent temizliği
- form_submissions → name/email/subject/message/admin_note/user_id temizliği
- shared/institutional content creator/uploader alanları → `NULL`
- başka kullanıcının ticket'ındaki reply author → `NULL`
- audit log actor → `NULL`, kullanıcı/ticket PII snapshot'ları redakte edilir

Paylaşılan/kurumsal içerik yalnız hesabı silinen kullanıcı tarafından oluşturuldu diye fiziksel
olarak silinmez; sahiplik/creator bağlantısı kaldırılır.

### Staging E2E doğrulaması

Sentetik staging kullanıcısı gerçek D1 üzerinde oluşturulup silinmiştir. Kullanıcı ve abonelik
kayıtlarının silindiği, form kaydının korunarak kişisel alanlarının temizlendiği doğrulanmıştır.

**D1 kullanıcı silme/anonimleştirme: CLOSED.**

## 7. R2 Privacy Purge

Support ticket attachment referansları kullanıcı silinmeden önce `privacy_r2_purge_queue`
içine alınır. Scheduled consumer yalnız `ticket-attachments/` allowlist prefix'ini fiziksel
R2 silmeye kabul eder. Beklenmeyen key/prefix silinmez ve hata queue kaydına yazılır.

Gerçek staging R2 üzerinde sentetik attachment oluşturulmuş, queue'ya eklenmiş, scheduled
consumer tarafından işlenmiş ve objenin fiziksel olarak artık bulunmadığı doğrulanmıştır.

**Privacy R2 purge: CLOSED.**

## 8. Admin Audit ve Yetki

`admin_action_logs` ve merkezi `recordAdminAction(...)` altyapısı aktiftir. Kullanıcı, ürün,
abonelik, kurum, dosya, duyuru, sync ve destek gibi kritik admin işlemlerinin önemli bölümü audit
metadata'sı üretir.

Audit loglarda secret, password, dosya içeriği veya hassas ham credential tutulmamalıdır.
Kullanıcı silme policy'si audit event'i korurken kişisel snapshot'ları redakte eder ve actor
ilişkisini kaldırır.

**Admin audit altyapısı: uygulanmış; yeni admin feature'ları eklenirken audit kapsamı korunmalıdır.**

## 9. Secrets ve Production Guardrails

- Secret/API key değerleri repoya yazılmaz.
- Local secrets `.dev.vars` ile tutulur.
- Production Worker deploy'u `wrangler.toml` içindeki required-secret sözleşmesiyle kritik
  secret'lar eksikse fail-closed durur.
- Production için en az `JWT_SECRET`, `RESEND_API_KEY`, `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`
  beklenir.
- `.github/workflows/production-preflight.yml` secret değerlerini göstermeden isim/varlık
  kontrolü yapar; ayrıca D1, Time Travel, R2, KV ve production config dry-run erişimini kontrol eder.
- Production preflight read-only'dir; migration/deploy yapmaz.

**Kod/guardrail durumu: CLOSED. Gerçek production preflight production geçiş gününde çalıştırılacaktır.**

## 10. D1 Backup / Recovery

Production migration apply öncesi:

1. migration listesi alınır,
2. kritik şemalar doğrulanır,
3. D1 Time Travel bookmark bilgisi alınır,
4. migration ancak bundan sonra uygulanır.

Production kişisel veri export'u rutin GitHub Actions artifact'ı olarak tutulmaz. D1 recovery
öncelikle forward-fix veya gerektiğinde Cloudflare D1 Time Travel ile yapılır.

Ayrıntı: `PRODUCTION_MIGRATION_PLAN.md`.

## 11. Veri İşleyen / Alt Sağlayıcı Envanteri

| Sağlayıcı | Amaç | Ana kontrol |
|---|---|---|
| Cloudflare | Pages, Workers, D1, KV, R2, DNS/SSL | secrets ve production kaynak ayrımı, Time Travel/preflight |
| GitHub | kaynak kod ve CI/CD | production kişisel veri export/log commitlenmez; secrets GitHub Secrets |
| Resend | transactional e-posta/reset/alert | minimum e-posta verisi, kısa token TTL |
| Airtable | kurum/contact sync ve CRM operasyonları | minimum payload, secret PAT |
| AI sağlayıcısı (TBD) | AI araçları/öneri | sağlayıcı seçilmeden DPA, retention, training opt-out ve bölge şartları doğrulanmalı |

## 12. AI Veri Minimizasyonu

- Kullanıcı adı, e-posta, telefon, ham IP, credential, JWT veya cookie AI sağlayıcısına gönderilmez.
- Katalog eşleştirmesi için minimum bağlam kullanılır.
- Ham prompt/output saklanacaksa ayrıca açık iş amacı, retention ve erişim kontrolü tanımlanır.
- AI cevabı otomatik karar yerine öneri/yardım niteliğinde kalır.

## 13. Production Öncesi Zorunlu Kontroller

- [x] Privacy policy güncel veri modelini kapsıyor.
- [x] Kayıt akışı KVKK onayına bağlı.
- [x] Mevcut çerez/analytics davranışı politika ile eşleştirildi.
- [x] Retention cleanup job'ları uygulanmış.
- [x] Kullanıcı silme/anonimleştirme merkezi policy ile uygulanmış ve staging E2E doğrulanmış.
- [x] Ticket attachment R2 privacy purge staging E2E doğrulanmış.
- [x] Admin audit altyapısı mevcut.
- [x] Legacy şifre lazy-rehash stratejisi mevcut.
- [x] Production D1 migration preflight + Time Travel guardrail mevcut.
- [x] Production required-secret guardrail ve read-only infrastructure preflight mevcut.
- [ ] Production Infrastructure Preflight production geçiş gününde gerçek kaynaklara karşı çalıştırılacak.
- [ ] Production Pages/Worker/D1/R2/KV final smoke ve DNS/custom-domain doğrulaması production geçiş gününde yapılacak.
- [ ] Nihai hukuki metinler/DPA/sağlayıcı şartları hukuk danışmanı ile doğrulanacak.

## 14. Açık Teknik İşler

- [ ] Yeni admin feature'larında audit kapsamı korunacak; gerektiğinde health/ops özeti P2 olarak eklenebilir.
- [ ] Backend `index.js` monolit refactor yalnız ayrı ve kontrollü çalışma olarak ele alınacak; production blocker değildir.
- [ ] Frontend URL-helper/fallback tekrarları P2 cleanup olarak ele alınabilir.
- [ ] Analytics/marketing entegrasyonu eklenirse consent management yeniden açılacaktır.

## 15. Uygulama Prensipleri

- Plaintext kullanıcı şifresi saklanmaz.
- Secret değerleri loglanmaz veya response ile geri verilmez.
- Kullanıcı şifreleri yalnız hash + salt olarak tutulur.
- Yeni her tablo için veri sınıfı, saklama süresi ve silme davranışı tanımlanır.
- Kullanıcı silme ile paylaşılan/kurumsal içerik gereksiz yere fiziksel olarak silinmez.
- R2 fiziksel silme yalnız allowlist edilmiş yönetilen key prefix'lerinde yapılır.
- Production debug/log çıktıları kişisel veri sızdırmayacak şekilde tutulur.
