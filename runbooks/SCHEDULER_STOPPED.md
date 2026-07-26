# SCHEDULER_STOPPED

## Detecção

- Alerta `SchedulerStopped` ativo.
- Dashboard `Scheduler` sem incremento em `scheduler_runs_total`.

## Diagnóstico

1. Verifique se a aplicação está no ar:
   `curl http://localhost:3000/live`
2. Verifique métricas do scheduler:
   `curl http://localhost:3000/internal/metrics | findstr scheduler_`
3. Inspecione logs do app:
   `docker logs --tail 150 whatsapp-chip-maturator-app`

## Mitigação

1. Reinicie a aplicação:
   `docker compose -f docker-compose.operations.yml restart app`
2. Aguarde pelo menos um intervalo do scheduler.
3. Revalide as métricas:
   `curl http://localhost:3000/internal/metrics | findstr scheduler_runs_total`

## Validação

- `scheduler_runs_total` volta a incrementar.
- `scheduler_jobs_published_total` volta a incrementar.
- `queue_jobs_published_total` acompanha as execuções do scheduler.

## Escalonamento

- Se o app estiver saudável mas o scheduler não voltar, tratar como incidente da runtime de observação e investigar bootstrap do runtime/feature flags.
