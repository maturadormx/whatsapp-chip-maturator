param(
  [string]$ComposeFile = ".\docker-compose.operations.yml",
  [string]$OutputDir = ".\evidencias\E2.6"
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

for ($i = 1; $i -le 3; $i++) {
  $logFile = Join-Path $OutputDir "rodada-$i.log"
  Remove-Item -Force $logFile -ErrorAction SilentlyContinue
  "Rodada $i" | Set-Content -Path $logFile -Encoding UTF8
  try {
    $downOutput = docker compose -f $ComposeFile down -v 2>&1 | Out-String
  } catch {
    $downOutput = $_ | Out-String
  }
  Add-Content -Path $logFile -Value $downOutput
  Add-Content -Path $logFile -Value ((& '.\scripts\start-certification-stack.ps1' -ComposeFile $ComposeFile) 2>&1 | Out-String)
  Start-Sleep -Seconds 45
  Add-Content -Path $logFile -Value ((docker compose -f $ComposeFile ps) 2>&1 | Out-String)
  Add-Content -Path $logFile -Value ((curl.exe -s http://127.0.0.1:3000/health) 2>&1 | Out-String)
  Add-Content -Path $logFile -Value ((& '.\scripts\validate-fluxos.ps1') 2>&1 | Out-String)
}

Write-Host "Certificação final salva em $OutputDir"
