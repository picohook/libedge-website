# Task Queue
*Owned by Architect. Builder and Reviewer read only the Active Step.*

---

## Active Step

Step: Scopus-01 — Scopus RA stabilizasyonu
Owner: Builder
Status: monitoring (Cloudflare block bekleniyor)
Rollback: 🟢 Worker rollback + ra-browser rebuild

---

## Queue

### Completed — Proxy / RA

- [x] Step 03 — Review Emerald, generalize WAF publisher handling → ra_waf_browser flag ✅
- [x] Step 04 — ra-browser Playwright/Chromium service → Emerald ✅
- [x] Step 05 — CABI CF Bot Management bypass → Cleared 2026-05-19
  - playwright-extra + stealth + SwiftShader. Sub-resource cache via page.on('response').
  - cf_clearance in D1 KV. Migration 0036 applied.
  - Remaining: [ra-debug]* log lines in proxy Worker — remove before production.

### Completed — Website (staging only)

- [x] Website-A — Individual tools admin: 93 araç, 13 kategori, affiliate yönetimi, filter/sort
- [x] Website-B — Profile dashboard: mozaik görünüm, kategori filtresi, kart detay modal
- [x] Website-C — LibEdge katalog + öneri sistemi (is_libedge_catalog, product_recommendations)
- [x] Website-D — Admin sidebar: sticky, collapsible, mobile-friendly
- [x] Website-E — Three Man Team protocol kurulumu

### Website — Upcoming

- [x] W-01 — tools.html login gate → **Cleared 2026-05-21** — waitForAuth() gate, openLoginModal() CTA
- [x] W-02 — Website → Production sync → **Cleared 2026-05-21** — 0037+0038 applied, 93 tools + 12 catalog products synced, Pages + Worker deployed. Richard: CLEAR.
- [x] W-02 — Website → Production: staging DB'yi prod'a taşı — **Done 2026-05-21**

### New Feature

- [ ] W-03 — Workflows AI Wizard: AI arama kutusunu step-by-step akademik görev rehberine dönüştür
  - Önce tasarım (Arch + Project Owner), sonra brief → Bob
  - Rollback: 🟢 Code

### RA / Proxy — Upcoming

- [ ] Scopus-01 — Scopus RA stabilizasyonu — **monitoring 2026-05-22**
  - Search ✅, arama sonuçları ✅, makale sayfası yükleniyor ✅
  - ScienceDirect full text (PDF dahil) ✅
  - Kalan: doc-details 403 (ra-browser Referer fix build edildi, test bekliyor)
  - Kalan: React #418/#423 hydration flash (kabul edilebilir, recover oluyor)
  - Kalan: Scopus Cloudflare hard block — test trafiği yüzünden, 30-60 dk bekle
  - Ray ID: 9ff982fc7d6a240d (Elsevier whitelist talebi için)
  - NOT: ra_waf_browser=1 Playwright trafiği fingerprint riski — blok tekrarlanırsa 0'a çek
  - Rollback: 🟢 Worker + ra-browser

- [ ] Step 06 — Wiley persistent sessions: ra-browser'da publisher bazlı persistent session pool
  - Kök neden: assetBrowserFetch yeni context açıyor, cookie taşınmıyor
  - Çözüm: hostname bazlı context pool, ilk yükleme context'ini asset fetch'lerde tekrar kullan
  - Rollback: 🟢 Code (ra-browser + Worker deploy)

- [ ] Step 07 — Production Proxy Worker deploy
  - Blocker: libedge.com domain cutover (Step Prod-04'ten sonra)
  - Rollback: 🟢 Worker rollback

### Production Readiness (sırayla)

- [x] Prod-01 — Production migration preflight → **Done 2026-05-21** — W-02 ile tamamlandı (0037+0038 applied)

- [x] Prod-02 — Per-institution encrypted egress secrets → **Done 2026-05-21**
  - egress_secret_enc admin panelden selmiye.com için set edildi (has_secret=1)
  - DEFAULT_SECRET fallback egress-client.js'den kaldırıldı (3 lokasyon)
  - Proxy Worker henüz production'a deploy edilmedi (Step 07'yi bekliyor)
  - Rollback: 🟡 D1 data (admin panel → secret temizle)

- [x] Prod-03 — egress-allowed-hosts institution scoping → **Done 2026-05-21**
  - egress-allowed-hosts.js: institution_id query param zorunlu, institution_subscriptions JOIN eklendi
  - ra-egress/main.go: LIBEDGE_INSTITUTION_ID env var, refreshDynamicHosts imzası güncellendi
  - Staging + production deploy edildi. Ra-egress agent'ı için LIBEDGE_INSTITUTION_ID=<kurumID> env var eklenmeli.
  - Rollback: 🟢 `wrangler rollback --env production`

- [x] Prod-04 — CABI durumu netleştir → **N/A 2026-05-21**
  - CABI staging ve production'da ra_enabled=1, ra_waf_browser=1. Step 05 tamamlandı.
  - "0037_disable_cabi_ra.sql" migration'ı yok — stale not. Aksiyon gerekmez.

- [x] Prod-05 — Admin RA sağlık ekranı → **Done 2026-05-21**
  - Stale heartbeat uyarısı (>15 dk → amber badge + "bayat" etiketi)
  - Tunnels sekmesi 60 sn auto-refresh
  - ra_debug_events 30 günden eski kayıtlar cron'da temizleniyor
  - Staging deploy edildi

- [x] Prod-06 — Pilot smoke test → **Cleared 2026-05-21** — API, egress, proxy, araçlar, admin, mobil hepsi OK

- [ ] Prod-07 — libedge.com domain cutover — **ERTELENDI** (ileride yapılacak)
  - TTL 48 saat önce 60s'ye indir (şu an 1800s)
  - proxy.selmiye.com → proxy.libedge.com
  - *.selmiye.com → *.libedge.com (wildcard)
  - Rollback: 🔴🔴 DNS revert (TTL-dependent)

- [ ] Step 07 — Production Proxy Worker deploy (Prod-07 sonrası) — **ERTELENDI**

### Infrastructure & Quality

- [x] Infra-01 — GitHub Actions CI → **Zaten vardı** — `.github/workflows/ci.yml` lint + test + syntax check, staging + main branch'e push/PR'da çalışıyor

- [ ] Infra-02 — Monitoring / Alerting
  - Tunnel düşünce haberdar ol: Better Stack (ücretsiz) veya Cloudflare Tail Worker → R2/mail
  - Hedef: tunnel down → 5 dakika içinde bildirim
  - Rollback: 🟢 Code

### KVKK (3 acil madde)

- [ ] KVKK-01 — Açık rıza metni kayıt formuna eklenecek (1 saat)
- [ ] KVKK-02 — Legacy SHA-256 password hash → PBKDF2 migrate (2 saat)
- [ ] KVKK-03 — Veri saklama süreleri belirle + cleanup job yaz (4 saat)

### Pre-Launch (canlıya geçmeden hemen önce)

- [ ] Launch-01 — `backend/src/index.js` modüllere bölünecek
  - `routes/` klasörü zaten var, her route kendi dosyasına
  - Helper fonksiyonlar da ayrılacak
  - Rollback: 🟢 Git

---

## Dependency Rules

- Step N+1 does not start until Step N is cleared or explicitly deferred by Architect.
- Builder does not write code unless Active Step is `ready-for-builder` or `building`.
- Reviewer does not review unless Active Step is `ready-for-review` or `reviewing`.
- Production deploys require Project Owner approval after review.
- 🔴 category steps require DB export checkpoint before starting.

---

## Status Values

- `planned` — Architect is still scoping.
- `ready-for-builder` — brief is complete.
- `building` — Builder owns the step.
- `monitoring` — Execution Monitor is running checks.
- `ready-for-review` — Builder has handed off and monitor report exists.
- `reviewing` — Reviewer owns the step.
- `blocked` — Architect decision or Project Owner decision required.
- `cleared` — Reviewer cleared the step.
- `deployed` — Architect deployed and logged the result.
