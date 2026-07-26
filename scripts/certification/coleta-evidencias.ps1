param(
  [string]$AppUrl = "http://127.0.0.1:3000",
  [string]$MetricsPath = "/internal/metrics",
  [string]$OutputFile = ".\sprint0-evidencias.log",
  [string]$AppLogPath = ".\sprint0-app.log",
  [string]$ComposeFile = ".\docker-compose.operations.yml"
)

function Write-Section {
  param(
    [string]$Title,
    [string]$Content
  )
  Add-Content -Path $OutputFile -Value "`n=== $Title ==="
  Add-Content -Path $OutputFile -Value $Content
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue
"Sprint 0 - coleta de evidências" | Set-Content -Path $OutputFile -Encoding UTF8

Write-Section "DOCKER COMPOSE PS" ((docker compose -f $ComposeFile ps) 2>&1 | Out-String)

docker compose -f $ComposeFile restart app | Out-Null
Start-Sleep -Seconds 8

try {
  $pong = docker exec whatsapp-chip-maturator-redis redis-cli ping 2>&1 | Out-String
  Write-Section "REDIS PING" $pong
} catch {
  Write-Section "REDIS PING" $_.Exception.Message
}

try {
  $appLogs = docker logs --since 2m whatsapp-chip-maturator-app 2>&1 | Out-String
  $appLogs | Set-Content -Path $AppLogPath -Encoding UTF8
  Write-Section "APP LOGS" $appLogs
} catch {
  $message = $_.Exception.Message
  $message | Set-Content -Path $AppLogPath -Encoding UTF8
  Write-Section "APP LOGS" $message
}

try {
  $before = Invoke-WebRequest -Uri "$AppUrl$MetricsPath" -UseBasicParsing -TimeoutSec 10
  Write-Section "METRICS BEFORE" $before.Content
} catch {
  Write-Section "METRICS BEFORE" $_.Exception.Message
}

try {
  $body = @{
    source = "coleta-evidencias"
    eventType = "test.event"
    payload = @{
      run = (Get-Date).ToString("s")
    }
  } | ConvertTo-Json -Compress
  $accepted = Invoke-RestMethod -Method Post -Uri "$AppUrl/api/inbound/events" -ContentType "application/json" -Body $body
  Write-Section "INBOUND EVENT" ($accepted | ConvertTo-Json -Compress)
} catch {
  Write-Section "INBOUND EVENT" $_.Exception.Message
}

Write-Section "NPM TEST" ((npm test) 2>&1 | Out-String)
Write-Section "NPM BUILD" ((docker build -t whatsapp-chip-maturator-audit .) 2>&1 | Out-String)

Start-Sleep -Seconds 35

try {
  $after = Invoke-WebRequest -Uri "$AppUrl$MetricsPath" -UseBasicParsing -TimeoutSec 10
  Write-Section "METRICS AFTER" $after.Content
} catch {
  Write-Section "METRICS AFTER" $_.Exception.Message
}

Write-Host "Evidências salvas em $OutputFile"
