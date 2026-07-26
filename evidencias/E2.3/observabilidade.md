# E2.3 â€” Observabilidade

## Dashboards provisionados

[
    {
        "title":  "WhatsApp Chip Maturator",
        "uid":  "dfsvtyammf0u8c"
    },
    {
        "title":  "DLQ",
        "uid":  "dlq-dashboard"
    },
    {
        "title":  "Pipeline",
        "uid":  "pipeline-dashboard"
    },
    {
        "title":  "Queue",
        "uid":  "queue-dashboard"
    },
    {
        "title":  "Scheduler",
        "uid":  "scheduler-dashboard"
    },
    {
        "title":  "Worker",
        "uid":  "worker-dashboard"
    }
]

## Checklist operacional

| Pergunta | Fonte | EvidÃªncia |
|---|---|---|
| Quantos jobs estÃ£o pendentes? | Grafana Queue / Prometheus | queue_pending_observations 0 |
| Worker estÃ¡ ativo? | Grafana Worker / Prometheus | worker_running 1 |
| Jobs processados pelo worker? | Grafana Worker / Prometheus | worker_jobs_processed_total 0 |
| Jobs falhos do worker? | Grafana Worker / Prometheus | worker_jobs_failed_total 0 |
| Pipeline iniciou? | Grafana Pipeline / Prometheus | pipeline_started_total 1 |
| Pipeline completou? | Grafana Pipeline / Prometheus | pipeline_completed_total 0 |
| Pipeline falhou? | Grafana Pipeline / Prometheus | pipeline_failed_total 0 |
| Scheduler executou? | Grafana Scheduler / Prometheus | scheduler_runs_total 4 |
| Scheduler publicou jobs? | Grafana Scheduler / Prometheus | scheduler_jobs_published_total 4 |
| DLQ atual? | Grafana DLQ / Prometheus | dlq_current_size 1 |

## ConclusÃ£o

As perguntas operacionais acima podem ser respondidas por dashboards provisionados e mÃ©tricas expostas em /internal/metrics, sem depender de docker logs, edis-cli, mysql ou grep em logs para leitura rotineira.
