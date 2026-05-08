param(
    [string]$OutputDir = "dist/ra-egress-laptop-kit",
    [switch]$Zip
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
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
    Copy-Item -LiteralPath (Join-Path $repoRoot "ra-browser/$file") -Destination (Join-Path $target "ra-browser/$file")
}

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
