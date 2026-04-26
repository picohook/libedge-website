# ra-egress/tunnel-provision.ps1
#
# Kalıcı Cloudflare Named Tunnel kurulumu — TEK SEFERLIK çalıştır.
#
# Ne yapar:
#   1) cloudflared yüklü değilse winget ile kurar
#   2) Cloudflare hesabına login olur (browser açılır)
#   3) Named tunnel oluşturur (zaten varsa atlar)
#   4) DNS route ekler: EgressHost → tunnel
#   5) Tunnel token'ı alır ve .env dosyasına yazar
#   6) docker compose up -d ile ra-egress + cloudflared başlatır
#   7) Staging D1'e kalıcı egress_endpoint yazar
#
# Quick Tunnel farkı: URL hiç değişmez, Docker restart'ta otomatik bağlanır.
#
# Kullanım (libedge-website repo kökünden):
#   Set-ExecutionPolicy -Scope Process Bypass
#   .\ra-egress\tunnel-provision.ps1
#   .\ra-egress\tunnel-provision.ps1 -TunnelName "sabanciuniv-ra" -EgressHost "ra-egress-sabanciuniv.selmiye.com"

param(
    # Cloudflare'de görünecek tünel adı — kurum bazlı adlandırma önerilir
    [string]$TunnelName   = "libedge-ra-egress",

    # Kalıcı egress hostname (selmiye.com wildcard içinde)
    [string]$EgressHost   = "ra-egress.selmiye.com",

    # ra-egress container'ın dinleyeceği iç port (docker-compose.yml ile eşleşmeli)
    [string]$LocalPort    = "8080",

    # ra-egress kaynak dizini
    [string]$RaEgressDir  = "$PSScriptRoot",

    # Wrangler ortamı (D1 güncellemesi için)
    [string]$WranglerEnv  = "staging",

    # D1 güncellemesi için libedge-website repo dizini
    [string]$LibEdgeRepo  = "C:\Users\OWNER\Documents\GitHub\libedge-website",

    # D1 veritabanı adı
    [string]$D1Name       = "libedge-db",

    # D1 güncelleme yapma (sadece tunnel kur)
    [switch]$SkipD1
)

$ErrorActionPreference = "Stop"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
    Write-Host ("─" * 60) -ForegroundColor DarkGray
}
function OK   { param($m) Write-Host "    ✓ $m" -ForegroundColor Green  }
function INFO { param($m) Write-Host "    · $m" -ForegroundColor Gray   }
function WARN { param($m) Write-Host "    ⚠ $m" -ForegroundColor Yellow }
function FAIL { param($m) Write-Host "    ✗ $m" -ForegroundColor Red; exit 1 }

# ── 1) cloudflared ───────────────────────────────────────────────────────────
Write-Step 1 "cloudflared kontrol"

if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    WARN "cloudflared bulunamadı — winget ile kuruluyor..."
    winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
}
$ver = & cloudflared --version 2>&1 | Select-Object -First 1
OK "cloudflared hazır: $ver"

# ── 2) Login ─────────────────────────────────────────────────────────────────
Write-Step 2 "Cloudflare hesabına giriş"

$certPath = "$env:USERPROFILE\.cloudflared\cert.pem"
if (Test-Path $certPath) {
    OK "Zaten giriş yapılmış (cert.pem mevcut)"
} else {
    INFO "Browser açılıyor — selmiye.com domain'ine yetkili hesapla giriş yap..."
    & cloudflared tunnel login
    if (!(Test-Path $certPath)) { FAIL "Login başarısız — cert.pem oluşmadı." }
    OK "Login tamam"
}

# ── 3) Tunnel oluştur (idempotent) ───────────────────────────────────────────
Write-Step 3 "Named tunnel: '$TunnelName'"

$tunnelList = & cloudflared tunnel list --output json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
$existing   = @($tunnelList) | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1

if ($existing) {
    $tunnelId = $existing.id
    OK "Zaten mevcut: $tunnelId"
} else {
    INFO "Yeni tunnel oluşturuluyor..."
    $out = & cloudflared tunnel create $TunnelName 2>&1
    $tunnelId = ($out | Select-String '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}').Matches[0].Value
    if (!$tunnelId) {
        $out | ForEach-Object { Write-Host "  $_" }
        FAIL "Tunnel ID parse edilemedi."
    }
    OK "Oluşturuldu: $tunnelId"
}

# ── 4) DNS route ─────────────────────────────────────────────────────────────
Write-Step 4 "DNS route: $EgressHost → tunnel"

$dnsOut = & cloudflared tunnel route dns $TunnelName $EgressHost 2>&1
if ($dnsOut -match "already exists|INF") {
    OK "DNS kaydı mevcut veya oluşturuldu: $EgressHost → $tunnelId.cfargotunnel.com"
} else {
    INFO "DNS çıktısı: $($dnsOut -join ' ')"
    WARN "DNS kaydını Cloudflare panelinden kontrol et (CNAME: $EgressHost → $tunnelId.cfargotunnel.com)"
}

# ── 5) Tunnel token al ───────────────────────────────────────────────────────
Write-Step 5 "Tunnel token alınıyor"

$tunnelToken = & cloudflared tunnel token $TunnelName 2>&1 | Where-Object { $_ -match '^ey' } | Select-Object -First 1
if (!$tunnelToken) {
    # Alternatif: token doğrudan tunnel JSON'dan base64 encode edilmiş hali
    $tunnelToken = (& cloudflared tunnel token $TunnelName 2>&1 | Select-String 'ey\S+').Matches[0].Value
}
if (!$tunnelToken) { FAIL "Tunnel token alınamadı. 'cloudflared tunnel token $TunnelName' çıktısını kontrol et." }

OK "Token alındı (ilk 12 char): $($tunnelToken.Substring(0, [Math]::Min(12, $tunnelToken.Length)))..."

# ── 6) .env dosyası yaz ──────────────────────────────────────────────────────
Write-Step 6 ".env dosyası yazılıyor"

$envFile = Join-Path $RaEgressDir ".env"
$envContent = @"
# ra-egress .env — kalıcı tunnel kurulumu
# Üretim tarihi: $(Get-Date -Format "yyyy-MM-dd HH:mm")
# Bu dosyayı git'e commit ETME.

TUNNEL_TOKEN=$tunnelToken
EGRESS_SHARED_SECRET=$(if (Test-Path $envFile) { (Get-Content $envFile | Where-Object { $_ -match '^EGRESS_SHARED_SECRET=' }) -replace '^EGRESS_SHARED_SECRET=','' } else { [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) })
ALLOWED_HOST_REGEX=^(www\.jove\.com|jove\.com|cdn\.jove\.com|player\.jove\.com|assets\.jove\.com)`$
"@

$envContent | Set-Content $envFile -Encoding UTF8
OK ".env yazıldı: $envFile"

# EGRESS_SHARED_SECRET değerini al (D1 güncellemesi için)
$egressSecret = (Get-Content $envFile | Where-Object { $_ -match '^EGRESS_SHARED_SECRET=' }) -replace '^EGRESS_SHARED_SECRET=',''

# ── 7) Docker Compose başlat ─────────────────────────────────────────────────
Write-Step 7 "docker compose up --build -d"

Push-Location $RaEgressDir
try {
    & docker compose up --build -d
    if ($LASTEXITCODE -ne 0) { FAIL "docker compose başlatılamadı." }
} finally {
    Pop-Location
}

Start-Sleep -Seconds 3

# Sağlık kontrolü — cloudflared üzerinden değil, direkt container'a
try {
    $h = Invoke-RestMethod -Uri "http://localhost:$LocalPort/health" -TimeoutSec 8
    OK "ra-egress container sağlıklı (ts=$($h.ts))"
} catch {
    WARN "ra-egress health check başarısız — docker logs ra-egress kontrol et."
}

# Tunnel bağlantısı için biraz bekle
Write-Host ""
INFO "Tunnel bağlantısı bekleniyor (10 sn)..."
Start-Sleep -Seconds 10

try {
    $h2 = Invoke-RestMethod -Uri "https://$EgressHost/health" -TimeoutSec 10
    OK "Tunnel aktif: https://$EgressHost/health → ts=$($h2.ts)"
} catch {
    WARN "Tunnel henüz hazır değil — 30-60 sn içinde otomatik bağlanır."
    INFO "Test komutu: curl https://$EgressHost/health"
}

# ── 8) D1 güncelle (kalıcı egress_endpoint) ─────────────────────────────────
if (!$SkipD1) {
    Write-Step 8 "D1 egress_endpoint kalıcı güncelleme"

    if (!(Test-Path $LibEdgeRepo)) {
        WARN "LibEdge repo bulunamadı: $LibEdgeRepo — D1 güncellemesi atlandı."
        WARN "Elle çalıştır:"
        Write-Host "    cd $LibEdgeRepo" -ForegroundColor White
        Write-Host "    npx wrangler d1 execute $D1Name --env $WranglerEnv --command `"UPDATE institution_ra_settings SET egress_endpoint='https://$EgressHost', enabled=1, tunnel_status='healthy' WHERE institution_id=1`"" -ForegroundColor White
    } else {
        Push-Location $LibEdgeRepo
        try {
            $sql = "UPDATE institution_ra_settings SET egress_endpoint='https://$EgressHost', enabled=1, tunnel_status='healthy', updated_at=unixepoch() WHERE institution_id=1"
            & npx wrangler d1 execute $D1Name --env $WranglerEnv --command $sql 2>&1 | ForEach-Object { INFO $_ }

            # Güncellemeyi doğrula
            $check = & npx wrangler d1 execute $D1Name --env $WranglerEnv --json `
                --command "SELECT institution_id, egress_endpoint, enabled, tunnel_status FROM institution_ra_settings WHERE institution_id=1" 2>&1
            $row = ($check | ConvertFrom-Json -ErrorAction SilentlyContinue)[0].results[0]
            if ($row) {
                OK "D1 güncellendi: institution_id=$($row.institution_id) egress=$($row.egress_endpoint) enabled=$($row.enabled)"
            }
        } finally {
            Pop-Location
        }
    }
}

# ── Özet ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  TUNNEL KALICI OLARAK KURULDU" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host @"

  Tunnel adı   : $TunnelName
  Tunnel ID    : $tunnelId
  Egress URL   : https://$EgressHost   ← KALICI, DEĞIŞMEZ

  Sonraki seferler için tek komut:
    cd $RaEgressDir
    docker compose up -d     ← tunnel otomatik bağlanır

  D1 egress_endpoint artık sabit:
    https://$EgressHost

  Test:
    curl https://$EgressHost/health

  Docker yönetim:
    docker compose logs -f cloudflared   ← tunnel logları
    docker compose logs -f ra-egress     ← egress logları
    docker compose down                   ← durdur
    docker compose up -d                  ← tekrar başlat (URL değişmez)

"@ -ForegroundColor White
