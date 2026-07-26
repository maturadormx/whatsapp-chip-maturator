param(
  [string]$AppUrl = "http://127.0.0.1:3000",
  [string]$OutputFile = ".\evidencias\E2.4\chaos.log"
)

function Write-Section {
  param([string]$Title, [string]$Content)
  Add-Content -Path $OutputFile -Value "`n=== $Title ==="
  Add-Content -Path $OutputFile -Value $Content
}

function Ensure-StackUp {
  docker compose -f .\docker-compose.operations.yml up -d | Out-Null
  Start-Sleep -Seconds 20
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue
"E2.4 - Chaos controlado" | Set-Content -Path $OutputFile -Encoding UTF8

Ensure-StackUp
Write-Section "STACK BEFORE" ((docker compose -f .\docker-compose.operations.yml ps) 2>&1 | Out-String)

Write-Section "APP STOP" ((docker stop whatsapp-chip-maturator-app) 2>&1 | Out-String)
Start-Sleep -Seconds 70
Write-Section "ALERTS AFTER APP STOP" ((curl.exe -s http://127.0.0.1:9090/api/v1/alerts) 2>&1 | Out-String)
Write-Section "APP START" ((docker start whatsapp-chip-maturator-app) 2>&1 | Out-String)
Start-Sleep -Seconds 20
Write-Section "READY AFTER APP START" ((curl.exe -s "$AppUrl/ready") 2>&1 | Out-String)

Write-Section "MYSQL STOP" ((docker stop whatsapp-chip-maturator-mysql) 2>&1 | Out-String)
Start-Sleep -Seconds 10
try {
  $body = @{ source = "e2-chaos"; eventType = "test.event"; payload = @{ mode = "mysql-down" } } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri "$AppUrl/api/inbound/events" -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
  Write-Section "POST DURING MYSQL DOWN" "unexpected_success"
} catch {
  Write-Section "POST DURING MYSQL DOWN" $_.Exception.Message
}
Write-Section "MYSQL START" ((docker start whatsapp-chip-maturator-mysql) 2>&1 | Out-String)
Start-Sleep -Seconds 25
Write-Section "HEALTH AFTER MYSQL START" ((curl.exe -s "$AppUrl/health") 2>&1 | Out-String)
Write-Section "STACK AFTER" ((docker compose -f .\docker-compose.operations.yml ps) 2>&1 | Out-String)

Write-Host "Validação de chaos salva em $OutputFile"
