param(
  [string]$ComposeFile = ".\docker-compose.operations.yml",
  [string]$PrometheusUrl = "http://127.0.0.1:9090",
  [string]$AlertmanagerUrl = "http://127.0.0.1:9093",
  [string]$GrafanaUrl = "http://127.0.0.1:3002",
  [string]$AppUrl = "http://127.0.0.1:3000",
  [string]$OutputFile = ".\alertas-validacao.log"
)

function Write-Section {
  param([string]$Title, [string]$Content)
  Add-Content -Path $OutputFile -Value "`n=== $Title ==="
  Add-Content -Path $OutputFile -Value $Content
}

function Get-FiringAlerts {
  try {
    $response = Invoke-RestMethod -Method Get -Uri "$PrometheusUrl/api/v1/alerts" -TimeoutSec 10
    return @($response.data.alerts | Where-Object { $_.state -eq "firing" } | Select-Object -ExpandProperty labels | Select-Object -ExpandProperty alertname)
  } catch {
    return @()
  }
}

function Wait-ForAlert {
  param(
    [string]$AlertName,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $alerts = Get-FiringAlerts
    if ($alerts -contains $AlertName) {
      return $true
    }
    Start-Sleep -Seconds 5
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Publish-QueueJobs {
  param([int]$Count = 6)

  $script = "const { Queue } = require('bullmq'); const IORedis = require('ioredis'); const connection = new IORedis('redis://127.0.0.1:6379', { maxRetriesPerRequest: null }); const queue = new Queue('observation-runtime', { connection }); (async () => { for (let i = 0; i < $Count; i += 1) { await queue.add('PROCESS_PENDING_BATCH', { id: 'manual-' + Date.now() + '-' + i, type: 'PROCESS_PENDING_BATCH', payload: { batchSize: 5 }, metadata: { source: 'alert-validation', workerId: 'manual' }, createdAt: new Date().toISOString() }, { attempts: 2, backoff: { type: 'exponential', delay: 500 }, removeOnComplete: 100, removeOnFail: 50 }); } await queue.close(); await connection.quit(); })().catch(async (error) => { console.error(error); try { await queue.close(); } catch {} try { await connection.quit(); } catch {} process.exit(1); });"
  node -e $script | Out-Null
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue
"Validação de alertas" | Set-Content -Path $OutputFile -Encoding UTF8

Write-Section "STACK UP" ((docker compose -f $ComposeFile up -d --build) 2>&1 | Out-String)
Start-Sleep -Seconds 15
Invoke-WebRequest -Method Post -Uri "$PrometheusUrl/-/reload" -UseBasicParsing -TimeoutSec 10 | Out-Null
Start-Sleep -Seconds 10

Write-Section "GRAFANA SEARCH" ((Invoke-RestMethod -Method Get -Uri "$GrafanaUrl/api/search?query=" -Headers @{ Authorization = "Basic YWRtaW46YWRtaW4=" } -TimeoutSec 10 | ConvertTo-Json -Depth 6) 2>&1 | Out-String)
Write-Section "ALERTS BASELINE" (((Get-FiringAlerts) -join "`n"))

# PipelineFailureRateHigh
docker stop whatsapp-chip-maturator-mysql | Out-Null
Start-Sleep -Seconds 5
try {
  $body = @{ source = "alert-validation"; eventType = "test.event"; payload = @{ fail = "mysql-down" } } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri "$AppUrl/api/inbound/events" -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
  Write-Section "PIPELINE FAILURE REQUEST" "unexpected_success"
} catch {
  Write-Section "PIPELINE FAILURE REQUEST" $_.Exception.Message
}
$pipelineFailure = Wait-ForAlert -AlertName "PipelineFailureRateHigh" -TimeoutSeconds 90
Write-Section "PIPELINE FAILURE ALERT" ("PipelineFailureRateHigh=" + $pipelineFailure)

# QueueGrowing + DlqHasJobs
Publish-QueueJobs -Count 8
Start-Sleep -Seconds 40
$queueGrowing = Wait-ForAlert -AlertName "QueueGrowing" -TimeoutSeconds 60
$dlqHasJobs = Wait-ForAlert -AlertName "DlqHasJobs" -TimeoutSeconds 90
Write-Section "QUEUE/DLQ ALERTS" ("QueueGrowing=" + $queueGrowing + "`nDlqHasJobs=" + $dlqHasJobs)
Write-Section "METRICS DURING MYSQL DOWN" ((Invoke-WebRequest -Uri "$AppUrl/internal/metrics" -UseBasicParsing -TimeoutSec 10).Content)

docker start whatsapp-chip-maturator-mysql | Out-Null
Start-Sleep -Seconds 20
docker compose -f $ComposeFile restart app | Out-Null
Start-Sleep -Seconds 20
Write-Section "POST-RECOVERY READY" ((Invoke-WebRequest -Uri "$AppUrl/ready" -UseBasicParsing -TimeoutSec 10).Content)

# WorkerStopped + SchedulerStopped
docker stop whatsapp-chip-maturator-app | Out-Null
Start-Sleep -Seconds 70
$workerStopped = Wait-ForAlert -AlertName "WorkerStopped" -TimeoutSeconds 30
$schedulerStopped = Wait-ForAlert -AlertName "SchedulerStopped" -TimeoutSeconds 30
Write-Section "WORKER/SCHEDULER ALERTS" ("WorkerStopped=" + $workerStopped + "`nSchedulerStopped=" + $schedulerStopped)

docker start whatsapp-chip-maturator-app | Out-Null
Start-Sleep -Seconds 20
Write-Section "FINAL READY" ((Invoke-WebRequest -Uri "$AppUrl/ready" -UseBasicParsing -TimeoutSec 10).Content)
Write-Section "FINAL ALERTS" (((Get-FiringAlerts) -join "`n"))

Write-Host "Validação de alertas salva em $OutputFile"
