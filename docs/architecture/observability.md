# Observability

Este documento formaliza a convenção de observabilidade do projeto antes da expansão de métricas do D3.2.

## Spans

Árvore base de tracing:

```text
scheduler.run
└── queue.publish
    └── worker.processBatch
        ├── repository.claimPending
        └── pipeline.process
            ├── repository.save
            ├── execution.execute
            └── eventStore.append
```

## Convenção de nomes

- Spans: verbo + alvo, em `snake_case` por domínio lógico
- Eventos de span: passado curto e descritivo, por exemplo `job_published`, `rules_evaluated`
- Métricas Prometheus: `snake_case`, com sufixos padrão como `_total`, `_seconds`, `_bytes`

## Atributos obrigatórios

- `observation.id`
- `observation.type`
- `queue.job_id`
- `queue.job_type`
- `worker.id` quando aplicável
- `scheduler.interval_ms` quando aplicável

## Cardinalidade

Não usar labels dinâmicas de alta cardinalidade em métricas:

- IDs
- stack trace
- mensagens de erro completas
- hostname variável por request

Esses dados devem ir para logs ou eventos de span, não para labels Prometheus.

## Métricas D3.2

A Entrega 1 do D3.2 estabelece apenas:

- registry singleton
- default metrics do Node.js
- endpoint `/internal/metrics`

Métricas de domínio e fila entram nas entregas seguintes.

## Métricas D3.2 completas

### Queue

- `queue_jobs_published_total`
- `queue_jobs_consumed_total`
- `queue_pending_observations`
- `queue_active_jobs`
- `queue_failed_jobs`
- `queue_delayed_jobs`
- `queue_wait_seconds`

### Pipeline

- `pipeline_started_total`
- `pipeline_completed_total`
- `pipeline_failed_total`
- `pipeline_processing_seconds`

### Worker

- `worker_jobs_processed_total`
- `worker_jobs_failed_total`
- `worker_running`
- `worker_batch_processing_seconds`

### Scheduler

- `scheduler_runs_total`
- `scheduler_jobs_published_total`
- `scheduler_publish_failures_total`

### DLQ

- `dlq_jobs_total`
- `dlq_current_size`
