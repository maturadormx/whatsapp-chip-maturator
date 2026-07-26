param(
  [string]$ComposeFile = ".\docker-compose.operations.yml",
  [string]$OutputFile = ".\evidencias\E2.1\reproducibility.log"
)

function Write-Section {
  param([string]$Title, [string]$Content)
  Add-Content -Path $OutputFile -Value "`n=== $Title ==="
  Add-Content -Path $OutputFile -Value $Content
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue
"E2.1 - Reprodutibilidade" | Set-Content -Path $OutputFile -Encoding UTF8

Write-Section "DOWN -V" ((docker compose -f $ComposeFile down -v) 2>&1 | Out-String)
Write-Section "UP CERTIFICATION STACK" ((& ".\scripts\start-certification-stack.ps1" -ComposeFile $ComposeFile) 2>&1 | Out-String)

Start-Sleep -Seconds 35

Write-Section "DOCKER COMPOSE PS" ((docker compose -f $ComposeFile ps) 2>&1 | Out-String)
Write-Section "HEALTH" ((curl.exe -s http://127.0.0.1:3000/health) 2>&1 | Out-String)
Write-Section "READY" ((curl.exe -s http://127.0.0.1:3000/ready) 2>&1 | Out-String)
Write-Section "LIVE" ((curl.exe -s http://127.0.0.1:3000/live) 2>&1 | Out-String)
Write-Section "METRICS HEAD" ((curl.exe -s http://127.0.0.1:3000/internal/metrics | Select-Object -First 40) 2>&1 | Out-String)
Write-Section "REDIS PING" ((docker exec whatsapp-chip-maturator-redis redis-cli ping) 2>&1 | Out-String)
Write-Section "PROM READY" ((curl.exe -s -i http://127.0.0.1:9090/-/ready) 2>&1 | Out-String)
Write-Section "GRAFANA HEALTH" ((curl.exe -s http://127.0.0.1:3002/api/health) 2>&1 | Out-String)

Write-Host "Validação de reprodutibilidade salva em $OutputFile"
