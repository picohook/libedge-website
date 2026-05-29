param(
    [string]$OutputDir = "dist/ra-egress-laptop-kit",
    [switch]$Zip
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$gitCommit = "unknown"
try {
    $gitCommit = (git -C $repoRoot rev-parse --short HEAD 2>$null).Trim()
    if (-not $gitCommit) { $gitCommit = "unknown" }
} catch {
    $gitCommit = "unknown"
}

$target = Join-Path $repoRoot $OutputDir
$targetParent = Split-Path -Parent $target
$resolvedParent = if (Test-Path $targetParent) {
    Resolve-Path $targetParent
} else {
    New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
    Resolve-Path $targetParent
}

if (-not ([string]$resolvedParent).StartsWith([string]$repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputDir repo disinda olamaz: $OutputDir"
}

if (Test-Path $target) {
    $resolvedTarget = Resolve-Path $target
    if (-not ([string]$resolvedTarget).StartsWith([string]$repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Silinecek hedef repo disinda gorunuyor: $resolvedTarget"
    }
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "ra-egress") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target "ra-browser") | Out-Null

$egressFiles = @(
    "Dockerfile",
    "docker-compose.yml",
    ".env.example",
    "go.mod",
    "go.sum",
    "main.go",
    "README.md",
    "LAPTOP_KURULUM.md",
    "KURULUM-BASLAT.ps1"
)

foreach ($file in $egressFiles) {
    Copy-Item -LiteralPath (Join-Path $repoRoot "ra-egress/$file") -Destination (Join-Path $target "ra-egress/$file")
}

$browserFiles = @(
    "Dockerfile",
    "package.json",
    "package-lock.json",
    "server.js"
)

foreach ($file in $browserFiles) {
    $source = Join-Path $repoRoot "ra-browser/$file"
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $target "ra-browser/$file")
    }
}

$browserServer = Join-Path $target "ra-browser/server.js"
if (-not (Test-Path $browserServer)) {
    throw "ra-browser/server.js pakete kopyalanamadi"
}

$browserServerText = Get-Content -LiteralPath $browserServer -Raw
foreach ($marker in @(
    "wiley-cold-bootstrap=1",
    "doc-cold-bootstrap-cookieless",
    "x-ra-browser-cold-bootstrap-cookieless"
)) {
    if (-not $browserServerText.Contains($marker)) {
        throw "ra-browser/server.js beklenen Wiley marker'ini icermiyor: $marker"
    }
}

$generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
@"
LibEdge RA Egress Laptop Kit
Generated-At: $generatedAt
Source-Commit: $gitCommit
Wiley-Cold-Bootstrap: present

Runtime sanity check:
docker compose logs --tail 30 ra-browser

Expected ra-browser startup marker:
Chromium launched (channel=chrome, wiley-cold-bootstrap=1)
"@ | Set-Content -LiteralPath (Join-Path $target "KIT-MANIFEST.txt") -Encoding UTF8

@"
# LibEdge RA Egress Laptop Paketi

Bu klasoru kurumda acik kalacak laptop'a kopyalayin.

En kolay kurulum:

```powershell
cd ra-egress
.\KURULUM-BASLAT.ps1
```

Bu pakette gercek `.env`, tunnel token, egress secret, backup veya binary dosya yoktur.
Degerleri kurulum sirasinda girmeniz gerekir.
"@ | Set-Content -LiteralPath (Join-Path $target "BENI_OKU.md") -Encoding UTF8

if ($Zip) {
    $zipPath = "$target.zip"
    if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Compress-Archive -LiteralPath $target -DestinationPath $zipPath
    Write-Host "Paket hazir: $zipPath" -ForegroundColor Green
} else {
    Write-Host "Paket hazir: $target" -ForegroundColor Green
}
