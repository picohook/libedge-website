# Workflow

LibEdge repo'sunda günlük çalışma için kısa akış:

## Şema

```text
Dosya değişti
  -> git status / git diff
  -> ilgili ekran veya akışı test et
  -> git add ...
  -> git commit -m "..."
  -> git branch --show-current
  -> git push origin <branch>
  -> staging / preview / deploy sonucu kontrol et
```

## Ne Zaman Ne Yapılır

| Durum | Yapılacak |
|---|---|
| AI veya sen dosya değiştirdi | `git status --short` |
| Tam olarak ne değiştiğini görmek istiyorsun | `git diff --name-only` ve gerekirse `git diff` |
| Davranışı doğrulamak istiyorsun | staging veya preview üzerinde smoke test |
| Değişikliği yerelde güvenle kaydetmek istiyorsun | `git add ...` + `git commit -m "..."` |
| Değişikliği GitHub'a göndermek istiyorsun | `git push origin <branch>` |
| Hangi branch'te olduğunu bilmiyorsun | `git branch --show-current` |
| Staging benzeri Pages testi yapmak istiyorsun | `staging-preview` branch preview kullan |
| Asıl staging hattını güncellemek istiyorsun | `staging` hattına deploy/push yap |
| Riskli hattı kontrol etmek istiyorsun | `main` öncesi diff + branch + test mutlaka kontrol et |
| Production migration/deploy istiyorsun | Önce migration listesi + plan + smoke/rollback notu hazırla |
| Frontend HTML/JS güvenlik değişikliği yaptın | Inline script parse kontrolü + `git diff --check`; kullanıcı/server verisi `innerHTML` içine ham girmemeli |

## Kısa Notlar

- `commit` sadece yerel kayıttır.
- `push origin` commit'leri GitHub'daki remote branch'e yollar.
- `push` tek başına her zaman deploy anlamına gelmez.
- Pages preview testlerinde `main` hash deploy'ları production environment binding'leriyle çalışabilir.
- Preview environment doğrulaması için tercih edilen hat: `staging-preview.libedge-website.pages.dev`
- Asıl staging doğrulaması için hat: `staging.libedge-website.pages.dev`
- Production D1, staging D1 ile aynı migration seviyesinde olmayabilir. `apply` çalıştırmadan önce mutlaka `list` ile bekleyen migration'lar okunur ve `PRODUCTION_MIGRATION_PLAN.md` güncellenir.
- 19 Mayıs 2026 itibarıyla staging ve production D1 aynı migration seviyesinde (`0035` dahil hepsi uygulandı). Bir sonraki migration eklendiğinde sadece production'a uygulanması gerekecek.
- Auth/refresh-token değişikliklerinde login smoke testi sadece yanlış şifre 401'i değil, başarılı login + `/api/user/profile` kontrolünü de kapsamalıdır.
- `admin.html` / `profile.html` gibi inline script içeren dosyalarda değişiklik sonrası en azından parse kontrolü yapılır. Güvenlik değişikliklerinde `innerHTML` kullanımının kaynağı ayrıca okunur.
