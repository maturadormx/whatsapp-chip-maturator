param(
  [string]$ComposeFile = ".\docker-compose.operations.yml",
  [switch]$ForceNoBuild
)

if ($ForceNoBuild) {
  $fallback = docker compose -f $ComposeFile up -d --no-build 2>&1 | Out-String
  Write-Output $fallback
  exit 0
}

$buildOutput = docker compose -f $ComposeFile up -d --build 2>&1 | Out-String
Write-Output $buildOutput

if ($buildOutput -match "TLS handshake timeout" -or $buildOutput -match "failed to resolve source metadata") {
  $appImagePresent = $false
  try {
    & docker image inspect "whatsapp-chip-maturator-app" *> $null
    $appImagePresent = $true
  } catch {
    $appImagePresent = $false
  }

  if (-not $appImagePresent) {
    throw "Build falhou por dependência externa e não há imagem local para fallback."
  }

  Write-Output "`n[FALLBACK] Reutilizando imagem local existente com --no-build."
  $fallback = docker compose -f $ComposeFile up -d --no-build 2>&1 | Out-String
  Write-Output $fallback
}
