param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Ask($Label, $Default = "") {
    if ($Default) {
        $value = Read-Host "$Label [$Default]"
        if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
        return $value.Trim()
    }
    return (Read-Host $Label).Trim()
}

Write-Host ""
Write-Host "LibEdge RA Egress kurulumu" -ForegroundColor Cyan
Write-Host "Bu script .env olusturur ve Docker servislerini baslatir." -ForegroundColor Gray
Write-Host ""

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker bulunamadi. Once Docker Desktop kurup acin:" -ForegroundColor Yellow
    Write-Host "https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    exit 1
}

$composeOk = $false
try {
    docker compose version | Out-Null
    $composeOk = $true
} catch {
    $composeOk = $false
}
if (!$composeOk) {
    Write-Host "Docker Compose kullanilamiyor. Docker Desktop acik mi kontrol edin." -ForegroundColor Yellow
    exit 1
}

$envPath = Join-Path $PSScriptRoot ".env"
if (!(Test-Path $envPath)) {
    Write-Host ".env bulunamadi; simdi olusturulacak." -ForegroundColor Cyan
    $tunnelToken = Ask "TUNNEL_TOKEN"
    $egressSecret = Ask "EGRESS_SHARED_SECRET"
    $apiUrl = Ask "LIBEDGE_API_URL" "https://form-handler-staging.agursel.workers.dev"
    $serviceKey = Ask "LIBEDGE_SERVICE_KEY (yoksa bos birakabilirsiniz)" ""
    $allowedHosts = Ask "ALLOWED_HOST_REGEX" "^(www\.jove\.com|jove\.com|cdn\.jove\.com|player\.jove\.com|assets\.jove\.com)$"

    @(
        "TUNNEL_TOKEN=$tunnelToken",
        "EGRESS_SHARED_SECRET=$egressSecret",
        "LIBEDGE_API_URL=$apiUrl",
        "LIBEDGE_SERVICE_KEY=$serviceKey",
        "ALLOWED_HOST_REGEX=$allowedHosts"
    ) | Set-Content -LiteralPath $envPath -Encoding UTF8
    Write-Host ".env olusturuldu." -ForegroundColor Green
} else {
    Write-Host ".env bulundu; mevcut degerler kullanilacak." -ForegroundColor Green
}

Push-Location $PSScriptRoot
try {
    if ($SkipBuild) {
        docker compose up -d
    } else {
        docker compose up --build -d
    }

    Write-Host ""
    Write-Host "Servisler baslatildi." -ForegroundColor Green
    docker compose ps
    Write-Host ""
    Write-Host "Son kontrol:" -ForegroundColor Cyan
    Write-Host "  docker compose logs --tail 80 cloudflared"
    Write-Host "  docker compose logs --tail 80 ra-egress"
    Write-Host ""
    Write-Host "Ardindan LibEdge admin panelinde 'Tuneli Test Et' butonuna basin." -ForegroundColor Cyan
} finally {
    Pop-Location
}
