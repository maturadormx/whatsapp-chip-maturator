param(
  [string]$AppUrl = "http://127.0.0.1:3000",
  [string]$GrafanaUrl = "http://127.0.0.1:3002",
  [string]$OutputFile = ".\evidencias\E2.3\observabilidade.md"
)

function Get-MetricLine {
  param([string]$MetricName)
  $line = curl.exe -s "$AppUrl/internal/metrics" | Select-String -Pattern "^$MetricName " | Select-Object -First 1
  if (-not $line) { return "N/D" }
  return $line.Line
}

Remove-Item -Force $OutputFile -ErrorAction SilentlyContinue

$dashboards = Invoke-RestMethod -Method Get -Uri "$GrafanaUrl/api/search?query=" -Headers @{ Authorization = "Basic YWRtaW46YWRtaW4=" } -TimeoutSec 15

$pending = Get-MetricLine "queue_pending_observations"
$workerRunning = Get-MetricLine "worker_running"
$workerProcessed = Get-MetricLine "worker_jobs_processed_total"
$workerFailed = Get-MetricLine "worker_jobs_failed_total"
$pipelineStarted = Get-MetricLine "pipeline_started_total"
$pipelineCompleted = Get-MetricLine "pipeline_completed_total"
$pipelineFailed = Get-MetricLine "pipeline_failed_total"
$schedulerRuns = Get-MetricLine "scheduler_runs_total"
$schedulerPublished = Get-MetricLine "scheduler_jobs_published_total"
$dlqCurrent = Get-MetricLine "dlq_current_size"

$content = @"
# E2.3 — Observabilidade

## Dashboards provisionados

$(($dashboards | Select-Object title, uid | ConvertTo-Json -Depth 4))

## Checklist operacional

| Pergunta | Fonte | Evidência |
|---|---|---|
| Quantos jobs estão pendentes? | Grafana Queue / Prometheus | $pending |
| Worker está ativo? | Grafana Worker / Prometheus | $workerRunning |
| Jobs processados pelo worker? | Grafana Worker / Prometheus | $workerProcessed |
| Jobs falhos do worker? | Grafana Worker / Prometheus | $workerFailed |
| Pipeline iniciou? | Grafana Pipeline / Prometheus | $pipelineStarted |
| Pipeline completou? | Grafana Pipeline / Prometheus | $pipelineCompleted |
| Pipeline falhou? | Grafana Pipeline / Prometheus | $pipelineFailed |
| Scheduler executou? | Grafana Scheduler / Prometheus | $schedulerRuns |
| Scheduler publicou jobs? | Grafana Scheduler / Prometheus | $schedulerPublished |
| DLQ atual? | Grafana DLQ / Prometheus | $dlqCurrent |

## Conclusão

As perguntas operacionais acima podem ser respondidas por dashboards provisionados e métricas expostas em `/internal/metrics`, sem depender de `docker logs`, `redis-cli`, `mysql` ou `grep` em logs para leitura rotineira.
"@

$content | Set-Content -Path $OutputFile -Encoding UTF8
Write-Host "Validação de observabilidade salva em $OutputFile"
