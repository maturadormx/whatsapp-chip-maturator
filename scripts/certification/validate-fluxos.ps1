param(
  [string]$AppUrl = "http://127.0.0.1:3000",
  [string]$OutputFile = ".\evidencias\E2.2\fluxos.log"
)

function Write-Section {
  param([string]$Title, [string]$Content)
  Add-Content -Path $OutputFile -Value "`n=== $Title ==="
  Add-Content -Path $OutputFile -Value $Content
}

function Get-MetricValue {
  param([string]$MetricName)
  $line = curl.exe -s "$AppUrl/internal/metrics" | Select-String -Pattern "^$MetricName " | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line.Line -split '\s+')[-1]
}

function Get-JsonMetricSnapshot {
  $metrics = curl.exe -s "$AppUrl/internal/metrics"
  $names = @(
    "queue_jobs_published_total",
    "queue_jobs_consumed_total",
    "worker_jobs_processed_total",
    "worker_jobs_failed_total",
    "worker_running",
    "pipeline_started_total",
    "pipeline_completed_total",
    "pipeline_failed_total",
    "scheduler_runs_total",
    "scheduler_jobs_published_total",
    "scheduler_publish_failures_total",
    "dlq_jobs_total",
    "dlq_current_size"
  )
  $snapshot = [ordered]@{}
  foreach ($name in $names) {
    $line = $metrics | Select-String -Pattern "^$name " | Select-Object -First 1
    $snapshot[$name] = if ($line) { ($line.Line -split '\s+')[-1] } else { "" }
  }
  return ($snapshot | ConvertTo-Json -Compress)
}

function Wait-ForReady {
  param([int]$TimeoutSeconds = 180)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-RestMethod -Method Get -Uri "$AppUrl/ready" -TimeoutSec 5
      if ($response.ok -eq $true) {
        return
      }
    } catch {}
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)

  throw "Aplicação não ficou ready em ${TimeoutSeconds}s"
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue
"E2.2 - Matriz de fluxos" | Set-Content -Path $OutputFile -Encoding UTF8

Wait-ForReady

$beforePublished = Get-MetricValue "queue_jobs_published_total"
$beforePipeline = Get-MetricValue "pipeline_started_total"
$beforeScheduler = Get-MetricValue "scheduler_runs_total"
Write-Section "BEFORE" (Get-JsonMetricSnapshot)

$body = @{ source = "e2-test"; eventType = "test.event"; payload = @{ chip = "5511999999999"; origin = "validate-fluxos" } } | ConvertTo-Json -Compress
$postResult = Invoke-RestMethod -Method Post -Uri "$AppUrl/api/inbound/events" -ContentType "application/json" -Body $body
Write-Section "POST EVENT" ($postResult | ConvertTo-Json -Compress)

Start-Sleep -Seconds 12

$afterPublished = Get-MetricValue "queue_jobs_published_total"
$afterPipeline = Get-MetricValue "pipeline_started_total"
$afterScheduler = Get-MetricValue "scheduler_runs_total"
Write-Section "AFTER" (Get-JsonMetricSnapshot)

if ($beforePipeline -eq $afterPipeline) {
  throw "pipeline_started_total não incrementou após inbound direto"
}

if ($beforePublished -eq $afterPublished -and $beforeScheduler -eq $afterScheduler) {
  Write-Section "QUEUE PATH NOTE" "O endpoint inbound é direto para a pipeline. O caminho assíncrono queue/worker depende do scheduler interno e não do POST."
}

Write-Section "INVALID PAYLOAD" ((curl.exe -s -i -X POST "$AppUrl/api/inbound/events" -H "Content-Type: application/json" --data-binary '{"source":""}' ) 2>&1 | Out-String)

Write-Section "RESTART APP" ((docker restart whatsapp-chip-maturator-app) 2>&1 | Out-String)
Start-Sleep -Seconds 20
Write-Section "HEALTH AFTER APP" ((curl.exe -s "$AppUrl/health") 2>&1 | Out-String)

Write-Section "RESTART REDIS" ((docker restart whatsapp-chip-maturator-redis) 2>&1 | Out-String)
Start-Sleep -Seconds 15
Write-Section "REDIS PING" ((docker exec whatsapp-chip-maturator-redis redis-cli ping) 2>&1 | Out-String)

Write-Section "RESTART MYSQL" ((docker restart whatsapp-chip-maturator-mysql) 2>&1 | Out-String)
Start-Sleep -Seconds 25
Write-Section "HEALTH AFTER MYSQL" ((curl.exe -s "$AppUrl/health") 2>&1 | Out-String)
Write-Section "FINAL METRICS" (Get-JsonMetricSnapshot)

Write-Host "Validação de fluxos salva em $OutputFile"
