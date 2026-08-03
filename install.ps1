# Bootstrap Windows (PowerShell 5+ / 7+).
#   irm https://raw.githubusercontent.com/0PValencia/orquesta/master/install.ps1 | iex
$ErrorActionPreference = "Stop"
$Repo = if ($env:ORQUESTA_SKILLS_REPO) { $env:ORQUESTA_SKILLS_REPO } else { "0PValencia/orquesta" }
$Branch = if ($env:ORQUESTA_SKILLS_BRANCH) { $env:ORQUESTA_SKILLS_BRANCH } else { "master" }
$Raw = "https://raw.githubusercontent.com/$Repo/$Branch/install.mjs"

Write-Host "Orquesta skills — instalador" -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Falta Node.js LTS: https://nodejs.org/" -ForegroundColor Yellow
  exit 1
}
Write-Host "> Node $(node -v)"

$local = Join-Path $PSScriptRoot "install.mjs"
if ($PSScriptRoot -and (Test-Path $local)) {
  Write-Host "> install.mjs local"
  & node $local @args
  exit $LASTEXITCODE
}

Write-Host "> descargando menú interactivo…"
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("orquesta-install-" + [guid]::NewGuid().ToString() + ".mjs")
try {
  Invoke-WebRequest -Uri $Raw -OutFile $tmp -UseBasicParsing -TimeoutSec 60
  Write-Host "> abriendo menú (flechas / Enter)…"
  & node $tmp @args
  exit $LASTEXITCODE
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
} finally {
  if (Test-Path $tmp) { Remove-Item -Force $tmp -ErrorAction SilentlyContinue }
}
