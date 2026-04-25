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

## Kısa Notlar

- `commit` sadece yerel kayıttır.
- `push origin` commit'leri GitHub'daki remote branch'e yollar.
- `push` tek başına her zaman deploy anlamına gelmez.
- Pages preview testlerinde `main` hash deploy'ları production environment binding'leriyle çalışabilir.
- Preview environment doğrulaması için tercih edilen hat: `staging-preview.libedge-website.pages.dev`
- Asıl staging doğrulaması için hat: `staging.libedge-website.pages.dev`
