param(
  [string]$ComposeFile = ".\docker-compose.operations.yml",
  [string]$OutputFile = ".\evidencias\E2.5\disposable.log"
)

function Write-Section {
  param([string]$Title, [string]$Content)
  Add-Content -Path $OutputFile -Value "`n=== $Title ==="
  Add-Content -Path $OutputFile -Value $Content
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue
"E2.5 - Ambiente descartável" | Set-Content -Path $OutputFile -Encoding UTF8

Write-Section "DOWN -V" ((docker compose -f $ComposeFile down -v) 2>&1 | Out-String)
Write-Section "UP CERTIFICATION STACK" ((& ".\scripts\start-certification-stack.ps1" -ComposeFile $ComposeFile) 2>&1 | Out-String)
Start-Sleep -Seconds 35
Write-Section "READY" ((curl.exe -s http://127.0.0.1:3000/ready) 2>&1 | Out-String)
Write-Section "METRICS" ((curl.exe -s http://127.0.0.1:3000/internal/metrics | Select-Object -First 30) 2>&1 | Out-String)

Write-Host "Validação de ambiente descartável salva em $OutputFile"
