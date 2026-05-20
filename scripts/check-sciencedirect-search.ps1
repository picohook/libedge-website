param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [string]$Query = "nanotube",

  [ValidateSet("chrome", "edge")]
  [string]$Browser = "chrome",

  [string]$ComposeDir = "",

  [int]$TimeoutMs = 45000,

  [switch]$KeepOpen
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir "check-sciencedirect-search.mjs"

$argsList = @(
  $nodeScript,
  "--url", $Url,
  "--query", $Query,
  "--browser", $Browser,
  "--timeout", "$TimeoutMs"
)

if ($ComposeDir) {
  $argsList += @("--compose-dir", $ComposeDir)
}

if ($KeepOpen) {
  $argsList += "--keep-open"
}

node @argsList
