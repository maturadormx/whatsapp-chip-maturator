# Runbook operacional de observabilidade

Este runbook cobre a ativação e a operação básica da stack de observabilidade do projeto.

## Serviços

- Aplicação: `http://localhost:3000`
- Health: `http://localhost:3000/live`, `http://localhost:3000/ready`, `http://localhost:3000/health`
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Grafana: `http://localhost:3001`

## Subida da stack

```bash
docker compose -f docker-compose.operations.yml up --build
```

## Validação inicial

### 1. Health checks

```bash
curl http://localhost:3000/live
curl http://localhost:3000/ready
curl http://localhost:3000/health
```

Esperado:

- `/live` -> `200`
- `/ready` -> `200` quando runtime estiver pronto
- `/health` -> `200` com `status: healthy`

### 2. Prometheus

```bash
curl http://localhost:9090/-/ready
curl http://localhost:3000/internal/metrics
```

Esperado:

- Prometheus pronto
- endpoint da aplicação expondo métricas padrão e customizadas

### 3. Grafana

Login padrão:

- usuário: `admin`
- senha: `admin`

Esperado:

- datasource Prometheus provisionado
- dashboards Queue, Worker, Pipeline, Scheduler e DLQ disponíveis

## Alertas configurados

- `WorkerStopped`
- `QueueGrowing`
- `DlqHasJobs`
- `PipelineFailureRateHigh`
- `SchedulerStopped`

## Incidentes comuns

### `worker_running == 0`

1. verificar logs da aplicação
2. verificar conectividade com Redis
3. validar `REDIS_URL`
4. reiniciar a aplicação

### `queue_pending_observations` crescendo

1. verificar se o scheduler está publicando
2. verificar se o worker está consumindo
3. validar throughput da pipeline
4. inspecionar DLQ e falhas do worker

### `dlq_current_size > 0`

1. abrir dashboard DLQ
2. verificar logs do `BullMQAdapter`
3. identificar payload falho
4. decidir reprocessamento ou descarte

### taxa de falha da pipeline > 5%

1. abrir dashboard Pipeline
2. correlacionar com logs e spans
3. isolar regressão em rule engine, execution ou persistence

## Sprint 0

Para evidências e auditoria objetiva:

```bash
pwsh ./scripts/certification/coleta-evidencias.ps1
python auditoria.py --log sprint0-evidencias.log --app-logs sprint0-app.log
```

Critério de saída:

- `🟢 GO`
