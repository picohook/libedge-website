param(
  [string]$ManifestPath = ".\backups\r2-object-keys.txt",
  [string]$TempRoot = ".\backups\r2-copy-temp",
  [switch]$KeepTempFiles
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ManifestPath)) {
  throw "Manifest bulunamadı: $ManifestPath"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$wranglerScript = Join-Path $repoRoot "node_modules\wrangler\bin\wrangler.js"

if (-not (Test-Path $wranglerScript)) {
  throw "Wrangler bulunamadı: $wranglerScript"
}

New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

$keys = Get-Content -Path $ManifestPath |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ }

$success = 0
$failed = New-Object System.Collections.Generic.List[string]

foreach ($key in $keys) {
  $localPath = Join-Path $TempRoot ($key -replace '/', '\')
  $localDir = Split-Path -Parent $localPath
  if ($localDir) {
    New-Item -ItemType Directory -Force -Path $localDir | Out-Null
  }

  Write-Host "Copying $key" -ForegroundColor Cyan

  try {
    & node $wranglerScript r2 object get ("libedge-files-staging/" + $key) --file $localPath --remote --env staging
    if ($LASTEXITCODE -ne 0) {
      throw "staging get failed"
    }

    & node $wranglerScript r2 object put ("libedge-files/" + $key) --file $localPath --remote --env production
    if ($LASTEXITCODE -ne 0) {
      throw "production put failed"
    }

    $success++

    if (-not $KeepTempFiles) {
      Remove-Item -LiteralPath $localPath -Force -ErrorAction SilentlyContinue
    }
  } catch {
    $failed.Add($key)
    Write-Warning "Kopyalanamadı: $key"
  }
}

$failedPath = Join-Path (Split-Path -Parent $ManifestPath) "r2-copy-failed.txt"
$summaryPath = Join-Path (Split-Path -Parent $ManifestPath) "r2-copy-summary.txt"

$failed | Set-Content -Path $failedPath -Encoding UTF8
@(
  "Toplam: $($keys.Count)"
  "Başarılı: $success"
  "Hatalı: $($failed.Count)"
) | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "Tamamlandı." -ForegroundColor Green
Write-Host "Başarılı: $success / $($keys.Count)"
Write-Host "Hatalı liste: $failedPath"
Write-Host "Özet: $summaryPath"
