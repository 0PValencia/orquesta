# Bootstrap Windows (PowerShell 5+ / PowerShell 7).
# Un comando:
#   irm https://raw.githubusercontent.com/0PValencia/orquesta/master/install.ps1 | iex
#
# Requiere Node.js LTS: https://nodejs.org/

$ErrorActionPreference = "Stop"
$Repo = if ($env:ORQUESTA_SKILLS_REPO) { $env:ORQUESTA_SKILLS_REPO } else { "0PValencia/orquesta" }
$Branch = if ($env:ORQUESTA_SKILLS_BRANCH) { $env:ORQUESTA_SKILLS_BRANCH } else { "master" }
$Raw = "https://raw.githubusercontent.com/$Repo/$Branch/install.mjs"

function Test-Node {
  try {
    $null = Get-Command node -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Node)) {
  Write-Host "Necesitas Node.js (LTS). Instala desde https://nodejs.org/ y vuelve a ejecutar el comando." -ForegroundColor Yellow
  exit 1
}

# Si existe install.mjs local (clone), usarlo
$local = Join-Path $PSScriptRoot "install.mjs"
if (Test-Path $local) {
  & node $local @args
  exit $LASTEXITCODE
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("orquesta-install-" + [guid]::NewGuid().ToString() + ".mjs")
try {
  Invoke-WebRequest -Uri $Raw -OutFile $tmp -UseBasicParsing
  & node $tmp @args
  exit $LASTEXITCODE
} finally {
  if (Test-Path $tmp) { Remove-Item -Force $tmp }
}
