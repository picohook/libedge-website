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

## Güncel Stabilizasyon Durumu — 7 Eylül 2026

- Auth/cookie/origin: CLOSED
- Mobile off-canvas navigation: CLOSED
- `/api/products` staging erişimi: CLOSED
- Admin audit altyapısı: uygulanmış
- KVKK kullanıcı silme ve anonimleştirme: staging D1 E2E SUCCESS
- Privacy R2 purge: staging R2 E2E SUCCESS
- Çerez/analytics policy uyumu: CLOSED; aktif analytics tracker yok
- Final canlı staging smoke: AUTH + FILES + FRONTEND SUCCESS
- Production D1 preflight/rollback guardrail: uygulanmış
- Production Infrastructure Preflight: uygulanmış, production geçişinde manuel çalıştırılacak
- Staging henüz freeze edilmemiştir; geliştirme devam eder.
